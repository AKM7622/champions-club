import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const plans = await prisma.membershipPlan.findMany({
      orderBy: { monthlyFee: "desc" },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return NextResponse.json({ success: true, plans });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
