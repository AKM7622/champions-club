import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { authRateLimiter } from "@/lib/rate-limiter";
import { logAuthEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const body = await req.json();
    const { email, password, isDemoSwitch = false, rememberMe = false } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email or Member identifier is required." },
        { status: 400 }
      );
    }

    const normalizedIdentifier = email.trim().toLowerCase();
    const ipKey = `ip:${ipAddress}`;
    const idKey = `id:${normalizedIdentifier}`;

    // 1. Check Rate Limiter (Brute Force Defense) for IP and Identifier
    // (Bypass rate limit lock only for instant demo switch if needed, but for standard logins enforce strictly)
    if (!isDemoSwitch) {
      const ipCheck = authRateLimiter.check(ipKey);
      const idCheck = authRateLimiter.check(idKey);

      if (!ipCheck.allowed || !idCheck.allowed) {
        const retryAfterSeconds = Math.max(
          ipCheck.retryAfterSeconds,
          idCheck.retryAfterSeconds
        );
        const retryMinutes = Math.ceil(retryAfterSeconds / 60);

        await logAuthEvent({
          eventType: "RATE_LIMITED",
          email: normalizedIdentifier,
          ipAddress,
          userAgent,
          details: `Rate limit triggered. Lockout for ${retryAfterSeconds}s`,
        });

        return NextResponse.json(
          {
            success: false,
            error: `Too many failed login attempts. Account temporarily locked for security. Please try again in ${retryMinutes} minute${
              retryMinutes > 1 ? "s" : ""
            }.`,
            retryAfter: retryAfterSeconds,
          },
          {
            status: 429,
            headers: {
              "Retry-After": retryAfterSeconds.toString(),
            },
          }
        );
      }
    }

    // 2. Lookup user by email or by memberNumber
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: normalizedIdentifier, mode: "insensitive" } },
          { member: { memberNumber: { equals: normalizedIdentifier, mode: "insensitive" } } },
        ],
      },
      include: {
        staff: true,
        member: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!user) {
      // Record failed attempt in rate limiter
      const ipFail = authRateLimiter.recordFailure(ipKey);
      const idFail = authRateLimiter.recordFailure(idKey);
      const remaining = Math.min(ipFail.remainingAttempts, idFail.remainingAttempts);

      await logAuthEvent({
        eventType: "LOGIN_FAILURE",
        email: normalizedIdentifier,
        ipAddress,
        userAgent,
        details: "Account not found with identifier",
      });

      return NextResponse.json(
        {
          success: false,
          error:
            remaining > 0
              ? `Invalid credentials. (${remaining} attempt${remaining > 1 ? "s" : ""} remaining)`
              : "Too many failed login attempts. Account temporarily locked for security.",
          remainingAttempts: remaining,
        },
        { status: 401 }
      );
    }

    // 3. Verify bcrypt hash (if not quick-demo switch)
    if (!isDemoSwitch) {
      if (!password) {
        return NextResponse.json(
          { success: false, error: "Password is required." },
          { status: 400 }
        );
      }

      const isValid = await verifyPassword(password, user.password);
      if (!isValid) {
        // Record failed attempt in rate limiter
        const ipFail = authRateLimiter.recordFailure(ipKey);
        const idFail = authRateLimiter.recordFailure(idKey);
        const remaining = Math.min(ipFail.remainingAttempts, idFail.remainingAttempts);

        await logAuthEvent({
          eventType: "LOGIN_FAILURE",
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          details: "Invalid password supplied",
        });

        return NextResponse.json(
          {
            success: false,
            error:
              remaining > 0
                ? `Invalid password. Default demo password is password123. (${remaining} attempt${
                    remaining > 1 ? "s" : ""
                  } remaining)`
                : "Too many failed login attempts. Account temporarily locked for security.",
            remainingAttempts: remaining,
          },
          { status: 401 }
        );
      }
    }

    // 4. Reset rate limit counters upon successful authentication
    authRateLimiter.reset(ipKey);
    authRateLimiter.reset(idKey);

    // 5. Create database session with signed cookie token and Remember Me option
    const session = await createSession(user.id, user.role, !!rememberMe);

    // 6. Log successful authentication event
    await logAuthEvent({
      eventType: "LOGIN_SUCCESS",
      userId: user.id,
      email: user.email,
      ipAddress,
      userAgent,
      details: isDemoSwitch
        ? "Demo persona instant sign-in"
        : `Credentials login with rememberMe=${rememberMe}`,
    });

    // 7. Set secure HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staff: user.staff,
        member: user.member,
      },
      message: `Welcome back, ${user.name}!`,
    });

    response.cookies.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: session.expiresAt,
      maxAge: session.maxAgeSeconds,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to log in" },
      { status: 500 }
    );
  }
}
