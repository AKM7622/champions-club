import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const menuItems = await prisma.barMenuItem.findMany({
      where: { isAvailable: true },
      orderBy: [{ category: "asc" }, { price: "asc" }],
    });

    return NextResponse.json({ success: true, menuItems });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
