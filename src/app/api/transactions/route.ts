import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PaymentMethod, TransactionCategory, TransactionType } from "@prisma/client";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") as TransactionCategory | null;
    const paymentMethod = searchParams.get("paymentMethod") as PaymentMethod | null;
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    const where: any = {};
    if (category) where.category = category;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    const [transactions, totalStats] = await Promise.all([
      prisma.transaction.findMany({
        where,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          member: {
            select: { id: true, name: true, memberNumber: true, planTier: true },
          },
          courtBooking: {
            include: { court: true },
          },
          shopOrder: true,
          barTab: {
            include: { table: true },
          },
        },
      }),
      prisma.transaction.aggregate({
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      transactions,
      summary: {
        totalRevenue: totalStats._sum.amount || 0,
        totalTransactions: totalStats._count.id || 0,
      },
    });
  } catch (error: any) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type,
      category,
      amount,
      paymentMethod,
      memberId,
      notes,
      courtBookingId,
      shopOrderId,
      barTabId,
    } = body;

    if (!amount || !paymentMethod || !category || !type) {
      return NextResponse.json(
        { success: false, error: "Missing required transaction fields" },
        { status: 400 }
      );
    }

    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const randomSuffix = `${Date.now().toString().slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;
    const referenceNo = `TXN-${yearMonth}-${randomSuffix}`;

    // Execute in transaction to guarantee ledger consistency
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Transaction Ledger Entry
      const transaction = await tx.transaction.create({
        data: {
          referenceNo,
          type: type as TransactionType,
          category: category as TransactionCategory,
          amount: Number(amount),
          paymentMethod: paymentMethod as PaymentMethod,
          memberId: memberId || null,
          notes: notes || `Settlement via ${paymentMethod}`,
        },
      });

      // 2. Link Court Booking if provided
      if (courtBookingId) {
        await tx.courtBooking.update({
          where: { id: courtBookingId },
          data: {
            paymentStatus: "PAID",
            paymentMethod: paymentMethod as PaymentMethod,
            transactionId: transaction.id,
          },
        });
      }

      // 3. Link Shop Order if provided
      if (shopOrderId) {
        await tx.shopOrder.update({
          where: { id: shopOrderId },
          data: {
            paymentStatus: "PAID",
            paymentMethod: paymentMethod as PaymentMethod,
            transactionId: transaction.id,
            status: "COMPLETED",
          },
        });
      }

      // 4. Link & Close Bar Tab if provided
      if (barTabId) {
        const tab = await tx.barTab.update({
          where: { id: barTabId },
          data: {
            status: "CLOSED",
            paymentStatus: "PAID",
            paymentMethod: paymentMethod as PaymentMethod,
            transactionId: transaction.id,
            closedAt: now,
          },
        });

        // Set table to AVAILABLE if no other open tabs exist
        if (tab.tableId) {
          const remainingTabs = await tx.barTab.count({
            where: {
              tableId: tab.tableId,
              status: "OPEN",
            },
          });

          if (remainingTabs === 0) {
            await tx.barTable.update({
              where: { id: tab.tableId },
              data: { status: "AVAILABLE" },
            });
          }
        }
      }

      return transaction;
    });

    return NextResponse.json({
      success: true,
      transaction: result,
      message: `Transaction ${result.referenceNo} successfully recorded in unified ledger.`,
    });
  } catch (error: any) {
    console.error("Ledger transaction error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record transaction" },
      { status: 500 }
    );
  }
}
