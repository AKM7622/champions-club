/**
 * In-memory brute force & rate limiting manager
 * Tracks failed authentication attempts per IP address and per user account identifier.
 */

interface RateLimitRecord {
  failedAttempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15-minute sliding monitoring window
const LOCKOUT_MS = 15 * 60 * 1000; // 15-minute lockout duration

class RateLimiter {
  private attempts: Map<string, RateLimitRecord> = new Map();

  constructor() {
    // Opportunistic cleanup of expired records every 5 minutes
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.cleanup(), 5 * 60 * 1000).unref?.();
    }
  }

  /**
   * Check if a key is currently rate-limited (locked out).
   */
  public check(key: string): {
    allowed: boolean;
    remainingAttempts: number;
    retryAfterSeconds: number;
  } {
    const now = Date.now();
    const record = this.attempts.get(key);

    if (!record) {
      return { allowed: true, remainingAttempts: MAX_ATTEMPTS, retryAfterSeconds: 0 };
    }

    // Check if lockout has expired
    if (record.lockedUntil) {
      if (now < record.lockedUntil) {
        const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
        return {
          allowed: false,
          remainingAttempts: 0,
          retryAfterSeconds,
        };
      } else {
        // Lockout expired, reset record
        this.attempts.delete(key);
        return { allowed: true, remainingAttempts: MAX_ATTEMPTS, retryAfterSeconds: 0 };
      }
    }

    // Check if window has elapsed
    if (now - record.firstAttemptAt > WINDOW_MS) {
      this.attempts.delete(key);
      return { allowed: true, remainingAttempts: MAX_ATTEMPTS, retryAfterSeconds: 0 };
    }

    const remaining = Math.max(0, MAX_ATTEMPTS - record.failedAttempts);
    return {
      allowed: remaining > 0,
      remainingAttempts: remaining,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Record a failed login attempt for a key.
   */
  public recordFailure(key: string): {
    allowed: boolean;
    remainingAttempts: number;
    retryAfterSeconds: number;
  } {
    const now = Date.now();
    let record = this.attempts.get(key);

    if (!record || now - record.firstAttemptAt > WINDOW_MS) {
      record = {
        failedAttempts: 1,
        firstAttemptAt: now,
        lockedUntil: null,
      };
      this.attempts.set(key, record);
      return {
        allowed: true,
        remainingAttempts: MAX_ATTEMPTS - 1,
        retryAfterSeconds: 0,
      };
    }

    record.failedAttempts += 1;

    if (record.failedAttempts >= MAX_ATTEMPTS) {
      record.lockedUntil = now + LOCKOUT_MS;
      const retryAfterSeconds = Math.ceil(LOCKOUT_MS / 1000);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds,
      };
    }

    return {
      allowed: true,
      remainingAttempts: MAX_ATTEMPTS - record.failedAttempts,
      retryAfterSeconds: 0,
    };
  }

  /**
   * Reset rate limit state on successful authentication.
   */
  public reset(key: string): void {
    this.attempts.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    this.attempts.forEach((record, key) => {
      if (record.lockedUntil && now > record.lockedUntil) {
        this.attempts.delete(key);
      } else if (now - record.firstAttemptAt > WINDOW_MS) {
        this.attempts.delete(key);
      }
    });
  }
}

// Global singleton instance
const globalForRateLimiter = globalThis as unknown as { authRateLimiter?: RateLimiter };
export const authRateLimiter = globalForRateLimiter.authRateLimiter || new RateLimiter();
if (process.env.NODE_ENV !== "production") globalForRateLimiter.authRateLimiter = authRateLimiter;
export default authRateLimiter;

