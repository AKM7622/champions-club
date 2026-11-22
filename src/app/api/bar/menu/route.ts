import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MenuCategory } from "@prisma/client";

export async function GET(req: NextRequest): Promise<NextResponse>;
export async function GET(): Promise<NextResponse>;
export async function GET(req?: any): Promise<NextResponse> {
  try {
    const includeAll = req?.url ? new URL(req.url).searchParams.get("all") === "true" : true;

    const menuItems = await prisma.barMenuItem.findMany({
      where: includeAll ? {} : { isAvailable: true },
      orderBy: [{ category: "asc" }, { price: "asc" }],
    });

    return NextResponse.json({ success: true, menuItems });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category, price, prepTimeMinutes = 10, isAvailable = true } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Menu item name is required." }, { status: 400 });
    }

    if (!category || !Object.values(MenuCategory).includes(category as MenuCategory)) {
      return NextResponse.json(
        { success: false, error: "Valid menu category is required." },
        { status: 400 }
      );
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return NextResponse.json({ success: false, error: "Price must be a non-negative number." }, { status: 400 });
    }

    const prepTime = Number(prepTimeMinutes);

    const item = await prisma.barMenuItem.create({
      data: {
        name: name.trim(),
        category: category as MenuCategory,
        price: numPrice,
        prepTimeMinutes: isNaN(prepTime) || prepTime < 0 ? 10 : Math.floor(prepTime),
        isAvailable: Boolean(isAvailable),
      },
    });

    return NextResponse.json({ success: true, menuItem: item }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, category, price, prepTimeMinutes, isAvailable } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Menu item ID is required." }, { status: 400 });
    }

    const existing = await prisma.barMenuItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Menu item not found." }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (category !== undefined) {
      if (!Object.values(MenuCategory).includes(category as MenuCategory)) {
        return NextResponse.json({ success: false, error: "Invalid menu category." }, { status: 400 });
      }
      updateData.category = category;
    }
    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice < 0) {
        return NextResponse.json({ success: false, error: "Price must be a non-negative number." }, { status: 400 });
      }
      updateData.price = numPrice;
    }
    if (prepTimeMinutes !== undefined) {
      const prep = Number(prepTimeMinutes);
      updateData.prepTimeMinutes = isNaN(prep) || prep < 0 ? 10 : Math.floor(prep);
    }
    if (isAvailable !== undefined) updateData.isAvailable = Boolean(isAvailable);

    const updated = await prisma.barMenuItem.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, menuItem: updated });
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
      return NextResponse.json({ success: false, error: "Menu item ID is required." }, { status: 400 });
    }

    const existing = await prisma.barMenuItem.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Menu item not found." }, { status: 404 });
    }

    const orderItemsCount = await prisma.barOrderItem.count({ where: { menuItemId: id } });
    if (orderItemsCount > 0) {
      await prisma.barMenuItem.update({ where: { id }, data: { isAvailable: false } });
      return NextResponse.json({
        success: true,
        message: `Menu item "${existing.name}" has ${orderItemsCount} historical order(s); archived as unavailable.`,
      });
    }

    await prisma.barMenuItem.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Menu item "${existing.name}" removed successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
