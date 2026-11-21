import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const courts = await prisma.court.findMany({
      orderBy: { name: "asc" },
      include: {
        bookings: {
          where: {
            status: { not: "CANCELLED" },
            startTime: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
          include: {
            member: {
              select: { id: true, name: true, memberNumber: true, planTier: true },
            },
          },
          orderBy: { startTime: "asc" },
        },
      },
    });

    return NextResponse.json({ success: true, courts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
