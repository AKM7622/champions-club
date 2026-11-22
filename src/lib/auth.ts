import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "./db";
import { cookies } from "next/headers";
import { addDays } from "date-fns";
import {
  signSessionToken,
  extractRawSessionToken,
} from "./auth-token";

export const SESSION_COOKIE_NAME = "cc_session";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface CreateSessionResult {
  token: string;
  rawToken: string;
  expiresAt: Date;
  maxAgeSeconds: number;
}

/**
 * Creates a database-backed session with signed cookie token and configurable duration.
 * rememberMe = true: 30 days
 * rememberMe = false: 24 hours
 */
export async function createSession(
  userId: string,
  role: string,
  rememberMe: boolean = false
): Promise<CreateSessionResult> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const durationDays = rememberMe ? 30 : 1;
  const expiresAt = addDays(new Date(), durationDays);
  const maxAgeSeconds = durationDays * 24 * 60 * 60;

  // Persist session to PostgreSQL
  await prisma.session.create({
    data: {
      sessionToken: rawToken,
      userId,
      expiresAt,
    },
  });

  // Generate cryptographically signed compound token for high-performance Edge middleware RBAC
  const compoundToken = await signSessionToken({
    sessionToken: rawToken,
    userId,
    role,
    exp: expiresAt.getTime(),
    rememberMe,
  });

  return {
    token: compoundToken,
    rawToken,
    expiresAt,
    maxAgeSeconds,
  };
}

/**
 * Invalidates and deletes a session in the database.
 */
export async function destroySession(tokenString: string): Promise<void> {
  const rawToken = extractRawSessionToken(tokenString);
  if (!rawToken) return;

  await prisma.session.deleteMany({
    where: { sessionToken: rawToken },
  });
}

/**
 * Validates session token against PostgreSQL with sliding session refresh and auto-cleanup.
 */
export async function getUserFromSessionToken(tokenString: string) {
  if (!tokenString) return null;
  const rawToken = extractRawSessionToken(tokenString);
  if (!rawToken) return null;

  // Opportunistic cleanup of expired sessions
  prisma.session
    .deleteMany({
      where: { expiresAt: { lt: new Date() } },
    })
    .catch(() => {});

  const session = await prisma.session.findUnique({
    where: { sessionToken: rawToken },
    include: {
      user: {
        include: {
          staff: true,
          member: {
            include: {
              plan: true,
            },
          },
        },
      },
    },
  });

  if (!session) return null;

  // Check if expired
  const now = new Date();
  if (now > session.expiresAt) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Sliding Session Refresh: If more than half the session lifetime has elapsed, slide forward
  const totalDuration = session.expiresAt.getTime() - session.createdAt.getTime();
  const remaining = session.expiresAt.getTime() - now.getTime();
  if (totalDuration > 0 && remaining < totalDuration / 2) {
    const newExpiresAt = new Date(now.getTime() + totalDuration);
    prisma.session
      .update({
        where: { id: session.id },
        data: { expiresAt: newExpiresAt },
      })
      .catch(() => {});
  }

  return session.user;
}

export async function getCurrentUser() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return getUserFromSessionToken(token);
  } catch (err) {
    return null;
  }
}
