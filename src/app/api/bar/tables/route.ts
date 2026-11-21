import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const tables = await prisma.barTable.findMany({
      orderBy: { tableNumber: "asc" },
      include: {
        tabs: {
          where: { status: "OPEN" },
          include: {
            member: {
              select: { id: true, name: true, memberNumber: true, planTier: true },
            },
            items: {
              include: { menuItem: true },
              orderBy: { orderedAt: "asc" },
            },
          },
        },
      },
    });

    return NextResponse.json({ success: true, tables });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
