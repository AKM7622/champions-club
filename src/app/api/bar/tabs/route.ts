import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { TabStatus, TableStatus, KitchenStatus } from "@prisma/client";
import { PricingCalculator } from "@/lib/pricing-calculator";
import { startOfDay, endOfDay } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const todayStart = startOfDay(new Date());
    const todayEnd = endOfDay(new Date());

    // 1. Fetch Open Tabs
    const openTabs = await prisma.barTab.findMany({
      where: { status: TabStatus.OPEN },
      include: {
        table: true,
        member: {
          select: { id: true, name: true, memberNumber: true, planTier: true },
        },
        items: {
          include: { menuItem: true },
          orderBy: { orderedAt: "asc" },
        },
      },
      orderBy: { openedAt: "desc" },
    });

    // 2. Fetch Today's Settled Tabs & Earnings for closing time review
    const settledToday = await prisma.barTab.findMany({
      where: {
        status: TabStatus.CLOSED,
        closedAt: { gte: todayStart, lte: todayEnd },
      },
      include: {
        table: true,
        member: true,
        items: { include: { menuItem: true } },
        transaction: true,
      },
      orderBy: { closedAt: "desc" },
    });

    const totalBarEarningsToday = (settledToday || []).reduce(
      (sum, tab) => sum + (tab.finalAmount || 0),
      0
    );

    // 3. Kitchen Queue (All items in PREPARING or READY)
    const kitchenQueue = await prisma.barOrderItem.findMany({
      where: {
        kitchenStatus: { in: [KitchenStatus.PREPARING, KitchenStatus.READY] },
      },
      include: {
        menuItem: true,
        tab: {
          include: {
            table: true,
            member: { select: { name: true, memberNumber: true } },
          },
        },
      },
      orderBy: { orderedAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      openTabs,
      settledToday,
      totalBarEarningsToday,
      kitchenQueue,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, tableId, memberId, guestName, tabId, items } = body;

    // Action A: Open New Tab
    if (action === "OPEN_TAB") {
      if (!tableId) {
        return NextResponse.json({ success: false, error: "Table ID is required" }, { status: 400 });
      }

      // Check if table already has open tab
      const existing = await prisma.barTab.findFirst({
        where: { tableId, status: TabStatus.OPEN },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: "This table already has an active open tab." },
          { status: 400 }
        );
      }

      const table = await prisma.barTable.findUnique({ where: { id: tableId } });
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const tabNumber = `TAB-${String(table?.tableNumber).padStart(2, "0")}-${randomSuffix}`;

      const tab = await prisma.$transaction(async (tx) => {
        const createdTab = await tx.barTab.create({
          data: {
            tabNumber,
            tableId,
            memberId: memberId || null,
            guestName: memberId ? null : guestName || "Bar Guests",
            status: TabStatus.OPEN,
          },
          include: { table: true, member: true },
        });

        await tx.barTable.update({
          where: { id: tableId },
          data: { status: TableStatus.OCCUPIED },
        });

        return createdTab;
      });

      return NextResponse.json({ success: true, tab, message: `Tab ${tab.tabNumber} opened!` });
    }

    // Action B: Add Items to Tab
    if (action === "ADD_ITEMS") {
      if (!tabId || !items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { success: false, error: "Tab ID and items list required" },
          { status: 400 }
        );
      }

      const tab = await prisma.barTab.findUnique({
        where: { id: tabId },
        include: {
          member: { include: { plan: true } },
          items: true,
        },
      });

      if (!tab) {
        return NextResponse.json({ success: false, error: "Tab not found" }, { status: 404 });
      }

      const menuItemIds = items.map((i: any) => i.menuItemId);
      const menuItems = await prisma.barMenuItem.findMany({
        where: { id: { in: menuItemIds } },
      });
      const menuMap = new Map(menuItems.map((m) => [m.id, m]));

      const createdItems = await prisma.$transaction(async (tx) => {
        for (const itemReq of items) {
          const mItem = menuMap.get(itemReq.menuItemId);
          if (!mItem) continue;

          await tx.barOrderItem.create({
            data: {
              tabId: tab.id,
              menuItemId: mItem.id,
              quantity: itemReq.quantity,
              unitPrice: mItem.price,
              totalPrice: mItem.price * itemReq.quantity,
              kitchenStatus: KitchenStatus.PREPARING,
              kitchenNotes: itemReq.kitchenNotes || null,
            },
          });
        }

        // Recalculate bill with all items
        const allItems = await tx.barOrderItem.findMany({
          where: { tabId: tab.id },
        });

        const calculation = PricingCalculator.calculateBarBill({
          items: allItems.map((i) => ({ unitPrice: i.unitPrice, quantity: i.quantity })),
          plan: tab.member?.plan,
        });

        const updatedTab = await tx.barTab.update({
          where: { id: tab.id },
          data: {
            subtotal: calculation.subtotal,
            discountAmount: calculation.discountAmount,
            taxAmount: calculation.taxAmount,
            finalAmount: calculation.finalAmount,
          },
          include: {
            items: { include: { menuItem: true } },
            member: true,
            table: true,
          },
        });

        return updatedTab;
      });

      return NextResponse.json({
        success: true,
        tab: createdItems,
        message: "Items sent to kitchen prep queue!",
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderItemId, kitchenStatus } = body;

    if (!orderItemId || !kitchenStatus) {
      return NextResponse.json(
        { success: false, error: "Order item ID and kitchen status required" },
        { status: 400 }
      );
    }

    const dataToUpdate: any = { kitchenStatus };
    if (kitchenStatus === "READY") dataToUpdate.readyAt = new Date();
    if (kitchenStatus === "SERVED") dataToUpdate.servedAt = new Date();

    const updated = await prisma.barOrderItem.update({
      where: { id: orderItemId },
      data: dataToUpdate,
      include: {
        menuItem: true,
        tab: {
          include: {
            table: true,
            member: { select: { id: true, name: true, memberNumber: true } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      orderItem: updated,
      message: `${updated.menuItem?.name || "Item"} marked as ${kitchenStatus}`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
