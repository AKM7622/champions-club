import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ProductCategory } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") as ProductCategory | null;
    const search = searchParams.get("search") || "";

    const where: any = {};
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    const products = await prisma.shopProduct.findMany({
      where,
      orderBy: { name: "asc" },
    });

    const productsWithAlerts = products.map((p) => ({
      ...p,
      isLowStock: p.stockQuantity <= p.reorderThreshold,
      deficit: Math.max(0, p.reorderThreshold - p.stockQuantity),
    }));

    return NextResponse.json({ success: true, products: productsWithAlerts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, addedStock } = body;

    if (!productId || !addedStock || addedStock <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid product ID and added stock quantity required" },
        { status: 400 }
      );
    }

    const updated = await prisma.shopProduct.update({
      where: { id: productId },
      data: {
        stockQuantity: { increment: Number(addedStock) },
      },
    });

    return NextResponse.json({
      success: true,
      product: updated,
      message: `Restocked ${updated.name}. New shelf inventory: ${updated.stockQuantity} units.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
