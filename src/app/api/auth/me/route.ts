import { NextRequest, NextResponse } from "next/server";
import { getUserFromSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({
        success: false,
        user: null,
      });
    }

    const user = await getUserFromSessionToken(token);

    if (!user) {
      return NextResponse.json({
        success: false,
        user: null,
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        staff: user.staff,
        member: user.member,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, user: null, error: error.message },
      { status: 500 }
    );
  }
}
