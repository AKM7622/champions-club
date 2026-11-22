import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getUserFromSessionToken,
  SESSION_COOKIE_NAME,
  verifyPassword,
  hashPassword,
} from "@/lib/auth";
import { validatePasswordStrength } from "@/lib/password-validator";
import { logAuthEvent } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication required to change password." },
        { status: 401 }
      );
    }

    const sessionUser = await getUserFromSessionToken(token);
    if (!sessionUser) {
      return NextResponse.json(
        { success: false, error: "Session invalid or expired. Please sign in again." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { success: false, error: "Current password, new password, and confirmation are all required." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { success: false, error: "New password and confirmation do not match." },
        { status: 400 }
      );
    }

    // Validate password complexity
    const validation = validatePasswordStrength(newPassword);
    if (!validation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: validation.errorMessage || "Password does not meet complexity requirements.",
        },
        { status: 400 }
      );
    }

    // Retrieve database user with existing password hash
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    });

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: "User account not found." },
        { status: 404 }
      );
    }

    // Verify current password
    const isCurrentValid = await verifyPassword(currentPassword, dbUser.password);
    if (!isCurrentValid) {
      return NextResponse.json(
        { success: false, error: "Current password is incorrect." },
        { status: 401 }
      );
    }

    // Prevent reusing the exact same password
    const isSamePassword = await verifyPassword(newPassword, dbUser.password);
    if (isSamePassword) {
      return NextResponse.json(
        { success: false, error: "New password cannot be identical to your current password." },
        { status: 400 }
      );
    }

    // Hash new password and update in database
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { password: newHash },
    });

    // Record audit event
    await logAuthEvent({
      eventType: "PASSWORD_CHANGE",
      userId: dbUser.id,
      email: dbUser.email,
      ipAddress,
      userAgent,
      details: "Password successfully changed by user",
    });

    return NextResponse.json({
      success: true,
      message: "Your password has been securely updated.",
    });
  } catch (error: any) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update password." },
      { status: 500 }
    );
  }
}
