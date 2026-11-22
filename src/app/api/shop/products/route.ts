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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      category,
      price,
      stockQuantity = 0,
      reorderThreshold = 5,
      description = "",
      imageUrl,
      sku,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Product name is required." }, { status: 400 });
    }

    if (!category || !Object.values(ProductCategory).includes(category as ProductCategory)) {
      return NextResponse.json(
        { success: false, error: "Valid product category is required." },
        { status: 400 }
      );
    }

    const numPrice = Number(price);
    if (isNaN(numPrice) || numPrice < 0) {
      return NextResponse.json({ success: false, error: "Price must be a non-negative number." }, { status: 400 });
    }

    const stock = Number(stockQuantity);
    if (isNaN(stock) || stock < 0) {
      return NextResponse.json({ success: false, error: "Stock quantity must be a non-negative integer." }, { status: 400 });
    }

    const threshold = Number(reorderThreshold);
    const generatedSku = sku && sku.trim() ? sku.trim() : `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Check SKU duplicate
    const existingSku = await prisma.shopProduct.findUnique({ where: { sku: generatedSku } });
    if (existingSku) {
      return NextResponse.json({ success: false, error: `SKU "${generatedSku}" already exists.` }, { status: 400 });
    }

    const product = await prisma.shopProduct.create({
      data: {
        sku: generatedSku,
        name: name.trim(),
        category: category as ProductCategory,
        price: numPrice,
        stockQuantity: Math.floor(stock),
        reorderThreshold: isNaN(threshold) || threshold < 0 ? 5 : Math.floor(threshold),
        description: description?.trim() || name.trim(),
        imageUrl: imageUrl?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, category, price, stockQuantity, reorderThreshold, description, imageUrl, sku } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Product ID is required." }, { status: 400 });
    }

    const existing = await prisma.shopProduct.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (category !== undefined) {
      if (!Object.values(ProductCategory).includes(category as ProductCategory)) {
        return NextResponse.json({ success: false, error: "Invalid product category." }, { status: 400 });
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
    if (stockQuantity !== undefined) {
      const stock = Number(stockQuantity);
      if (isNaN(stock) || stock < 0) {
        return NextResponse.json({ success: false, error: "Stock quantity must be a non-negative number." }, { status: 400 });
      }
      updateData.stockQuantity = Math.floor(stock);
    }
    if (reorderThreshold !== undefined) {
      const thresh = Number(reorderThreshold);
      updateData.reorderThreshold = isNaN(thresh) || thresh < 0 ? 5 : Math.floor(thresh);
    }
    if (description !== undefined) updateData.description = description.trim();
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl?.trim() || null;
    if (sku !== undefined && sku.trim() !== existing.sku) {
      const skuCheck = await prisma.shopProduct.findUnique({ where: { sku: sku.trim() } });
      if (skuCheck) {
        return NextResponse.json({ success: false, error: `SKU "${sku.trim()}" already exists.` }, { status: 400 });
      }
      updateData.sku = sku.trim();
    }

    const updated = await prisma.shopProduct.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, product: updated });
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
      return NextResponse.json({ success: false, error: "Product ID is required." }, { status: 400 });
    }

    const existing = await prisma.shopProduct.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Product not found." }, { status: 404 });
    }

    const orderCount = await prisma.shopOrderItem.count({ where: { productId: id } });
    if (orderCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete product "${existing.name}": It has ${orderCount} historical order record(s). Please reduce stock to 0 instead.`,
        },
        { status: 400 }
      );
    }

    await prisma.shopProduct.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Product "${existing.name}" removed successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
