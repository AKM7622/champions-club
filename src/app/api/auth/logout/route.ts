import { NextRequest, NextResponse } from "next/server";
import { destroySession, getUserFromSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { logAuthEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      const user = await getUserFromSessionToken(token);
      if (user) {
        await logAuthEvent({
          eventType: "LOGOUT",
          userId: user.id,
          email: user.email,
          ipAddress,
          userAgent,
          details: "User initiated sign out",
        });
      }
      await destroySession(token);
    }

    const response = NextResponse.json({
      success: true,
      message: "Successfully logged out.",
    });

    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to log out" },
      { status: 500 }
    );
  }
}
