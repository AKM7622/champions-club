import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { LeaveStatus } from "@prisma/client";

export async function GET() {
  try {
    const leaves = await prisma.leave.findMany({
      orderBy: { createdAt: "desc" },
      include: { staff: true },
    });
    return NextResponse.json({ success: true, leaves });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { leaveId, status } = body;

    if (!leaveId || !status) {
      return NextResponse.json({ success: false, error: "Leave ID and status required" }, { status: 400 });
    }

    const updated = await prisma.leave.update({
      where: { id: leaveId },
      data: { status: status as LeaveStatus },
      include: { staff: true },
    });

    return NextResponse.json({
      success: true,
      leave: updated,
      message: `Leave request for ${updated.staff.name} has been ${status.toLowerCase()}.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
