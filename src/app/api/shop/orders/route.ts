import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { OrderType, OrderStatus, PaymentStatus, PaymentMethod, TransactionType, TransactionCategory } from "@prisma/client";
import { PricingCalculator } from "@/lib/pricing-calculator";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "30", 10);

    const orders = await prisma.shopOrder.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        member: {
          select: { id: true, name: true, memberNumber: true, planTier: true },
        },
        items: {
          include: { product: true },
        },
        transaction: true,
      },
    });

    return NextResponse.json({ success: true, orders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      memberId,
      customerName,
      customerPhone,
      orderType = OrderType.IN_STORE,
      deliveryAddress,
      items, // array of { productId, quantity }
      paymentMethod = PaymentMethod.UPI,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Order must contain at least one item." },
        { status: 400 }
      );
    }

    // Lookup Member Plan if memberId supplied
    let member = null;
    let memberPlan = null;
    if (memberId) {
      member = await prisma.member.findUnique({
        where: { id: memberId },
        include: { plan: true },
      });
      if (member) memberPlan = member.plan;
    }

    const name = member ? member.name : customerName || "Counter Customer";
    const phone = member ? member.phone : customerPhone || "+91 99999 00000";

    const now = new Date();
    const orderNumber = `ORD-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    // Interactive Transaction: Validate Stock -> Decrement Shelf -> Create Order & Items -> Create Ledger Entry
    const orderResult = await prisma.$transaction(async (tx) => {
      // 1. Fetch all requested products and verify single-shelf inventory
      const productIds = items.map((i: any) => i.productId);
      const dbProducts = await tx.shopProduct.findMany({
        where: { id: { in: productIds } },
      });

      const productMap = new Map(dbProducts.map((p) => [p.id, p]));
      const pricingItems: Array<{ unitPrice: number; quantity: number }> = [];
      const orderItemPayloads: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
      }> = [];

      for (const reqItem of items) {
        const prod = productMap.get(reqItem.productId);
        if (!prod) {
          throw new Error(`Product not found: ${reqItem.productId}`);
        }

        if (prod.stockQuantity < reqItem.quantity) {
          throw new Error(
            `Insufficient Stock on Shelf: "${prod.name}" has only ${prod.stockQuantity} available (requested: ${reqItem.quantity}). Single-shelf inventory prevents over-selling.`
          );
        }

        // Decrement stock from shelf
        await tx.shopProduct.update({
          where: { id: prod.id },
          data: { stockQuantity: { decrement: reqItem.quantity } },
        });

        const lineTotal = prod.price * reqItem.quantity;
        pricingItems.push({ unitPrice: prod.price, quantity: reqItem.quantity });
        orderItemPayloads.push({
          productId: prod.id,
          quantity: reqItem.quantity,
          unitPrice: prod.price,
          totalPrice: lineTotal,
        });
      }

      // 2. Shared Pricing Calculator calculation (applies member discount)
      const calculation = PricingCalculator.calculateShopOrder({
        items: pricingItems,
        plan: memberPlan,
      });

      // 3. Create Ledger Entry
      const refNo = `TXN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const transaction = await tx.transaction.create({
        data: {
          referenceNo: refNo,
          type: TransactionType.SHOP_PURCHASE,
          category: TransactionCategory.SHOP,
          amount: calculation.finalPrice,
          paymentMethod: paymentMethod as PaymentMethod,
          memberId: member ? member.id : null,
          notes: `Pro Shop (${orderType}): ${orderNumber} (${calculation.discountPercent}% discount)`,
        },
      });

      // 4. Create Order
      const order = await tx.shopOrder.create({
        data: {
          orderNumber,
          memberId: member ? member.id : null,
          customerName: name,
          customerPhone: phone,
          orderType: orderType as OrderType,
          deliveryAddress: orderType === OrderType.ONLINE_DELIVERY ? deliveryAddress : null,
          status:
            orderType === OrderType.IN_STORE
              ? OrderStatus.COMPLETED
              : OrderStatus.READY_FOR_PICKUP,
          totalBasePrice: calculation.subtotal,
          discountAmount: calculation.discountAmount,
          finalPrice: calculation.finalPrice,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: paymentMethod as PaymentMethod,
          transactionId: transaction.id,
          items: {
            create: orderItemPayloads,
          },
        },
        include: {
          items: { include: { product: true } },
          transaction: true,
        },
      });

      return { order, transaction, calculation };
    });

    return NextResponse.json({
      success: true,
      order: orderResult.order,
      transaction: orderResult.transaction,
      calculation: orderResult.calculation,
      message: `Order ${orderResult.order.orderNumber} placed and ₹${orderResult.calculation.finalPrice} recorded in ledger. Shelf inventory updated!`,
    });
  } catch (error: any) {
    console.error("Shop order error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
