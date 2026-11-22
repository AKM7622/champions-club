import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TableStatus } from "@prisma/client";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tableNumber, name, capacity, status = "AVAILABLE" } = body;

    const num = Number(tableNumber);
    if (isNaN(num) || num <= 0) {
      return NextResponse.json({ success: false, error: "Valid table number is required." }, { status: 400 });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Table name is required." }, { status: 400 });
    }

    const cap = Number(capacity);
    if (isNaN(cap) || cap <= 0) {
      return NextResponse.json({ success: false, error: "Capacity must be a positive integer." }, { status: 400 });
    }

    const existingNum = await prisma.barTable.findUnique({ where: { tableNumber: Math.floor(num) } });
    if (existingNum) {
      return NextResponse.json({ success: false, error: `Table number ${num} already exists.` }, { status: 400 });
    }

    const validStatus = Object.values(TableStatus).includes(status as TableStatus)
      ? (status as TableStatus)
      : TableStatus.AVAILABLE;

    const table = await prisma.barTable.create({
      data: {
        tableNumber: Math.floor(num),
        name: name.trim(),
        capacity: Math.floor(cap),
        status: validStatus,
      },
      include: {
        tabs: { where: { status: "OPEN" } },
      },
    });

    return NextResponse.json({ success: true, table }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, tableNumber, name, capacity, status } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Table ID is required." }, { status: 400 });
    }

    const existing = await prisma.barTable.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Table not found." }, { status: 404 });
    }

    const updateData: any = {};
    if (tableNumber !== undefined) {
      const num = Number(tableNumber);
      if (isNaN(num) || num <= 0) {
        return NextResponse.json({ success: false, error: "Valid table number is required." }, { status: 400 });
      }
      if (Math.floor(num) !== existing.tableNumber) {
        const dup = await prisma.barTable.findUnique({ where: { tableNumber: Math.floor(num) } });
        if (dup) {
          return NextResponse.json({ success: false, error: `Table number ${num} already exists.` }, { status: 400 });
        }
      }
      updateData.tableNumber = Math.floor(num);
    }

    if (name !== undefined) updateData.name = name.trim();
    if (capacity !== undefined) {
      const cap = Number(capacity);
      if (isNaN(cap) || cap <= 0) {
        return NextResponse.json({ success: false, error: "Capacity must be a positive integer." }, { status: 400 });
      }
      updateData.capacity = Math.floor(cap);
    }
    if (status !== undefined) {
      if (!Object.values(TableStatus).includes(status as TableStatus)) {
        return NextResponse.json({ success: false, error: "Invalid table status." }, { status: 400 });
      }
      updateData.status = status;
    }

    const updated = await prisma.barTable.update({
      where: { id },
      data: updateData,
      include: {
        tabs: { where: { status: "OPEN" } },
      },
    });

    return NextResponse.json({ success: true, table: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let id = req.nextUrl?.searchParams?.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch (e) {
        // body not present
      }
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "Table ID is required." }, { status: 400 });
    }

    const existing = await prisma.barTable.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Table not found." }, { status: 404 });
    }

    const openTabsCount = await prisma.barTab.count({
      where: { tableId: id, status: "OPEN" },
    });

    if (openTabsCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete table "${existing.name}": There is an active open tab on this table. Settle or close the tab first.`,
        },
        { status: 400 }
      );
    }

    await prisma.barOrderItem.deleteMany({ where: { tab: { tableId: id } } });
    await prisma.barTab.deleteMany({ where: { tableId: id } });
    await prisma.barTable.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Table "${existing.name}" removed successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
