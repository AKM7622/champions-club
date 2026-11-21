import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addMonths } from "date-fns";
import { PaymentMethod, TransactionCategory, TransactionType } from "@prisma/client";
import { PricingCalculator } from "@/lib/pricing-calculator";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const member = await prisma.member.findUnique({
      where: { id: params.id },
      include: {
        plan: true,
        courtBookings: {
          orderBy: { startTime: "desc" },
          take: 10,
          include: { court: true },
        },
        shopOrders: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            items: { include: { product: true } },
          },
        },
        barTabs: {
          orderBy: { openedAt: "desc" },
          take: 10,
          include: {
            table: true,
            items: { include: { menuItem: true } },
          },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 15,
        },
      },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });
    }

    const computedStatus = PricingCalculator.getMembershipStatus(member.expiryDate);

    return NextResponse.json({
      success: true,
      member: {
        ...member,
        computedStatus,
        isExpiringSoon: computedStatus === "EXPIRING_SOON",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const { action, durationMonths = 1, paymentMethod = PaymentMethod.UPI } = body;

    const member = await prisma.member.findUnique({
      where: { id: params.id },
      include: { plan: true },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });
    }

    if (action === "RENEW") {
      const now = new Date();
      const currentExpiry = new Date(member.expiryDate);
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const newExpiryDate = addMonths(baseDate, durationMonths);
      const renewalFee = member.plan.monthlyFee * durationMonths;

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.member.update({
          where: { id: member.id },
          data: {
            expiryDate: newExpiryDate,
            status: "ACTIVE",
          },
          include: { plan: true },
        });

        const refNo = `TXN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(
          1000 + Math.random() * 9000
        )}`;

        const transaction = await tx.transaction.create({
          data: {
            referenceNo: refNo,
            type: TransactionType.MEMBERSHIP_FEE,
            category: TransactionCategory.MEMBERSHIP,
            amount: renewalFee,
            paymentMethod: paymentMethod as PaymentMethod,
            memberId: member.id,
            notes: `Membership Renewal: ${member.plan.name} (+${durationMonths} month(s))`,
          },
        });

        return { member: updated, transaction };
      });

      return NextResponse.json({
        success: true,
        member: result.member,
        transaction: result.transaction,
        message: `Membership extended until ${result.member.expiryDate.toISOString().split("T")[0]}.`,
      });
    }

    return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
