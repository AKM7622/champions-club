import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PlanTier, MemberStatus, PaymentMethod, TransactionType, TransactionCategory } from "@prisma/client";
import { addMonths } from "date-fns";
import { PricingCalculator } from "@/lib/pricing-calculator";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const tier = searchParams.get("tier") as PlanTier | null;
    const status = searchParams.get("status") as MemberStatus | null;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { memberNumber: { contains: search, mode: "insensitive" } },
      ];
    }
    if (tier) where.planTier = tier;
    if (status) where.status = status;

    const members = await prisma.member.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        plan: true,
        _count: {
          select: {
            courtBookings: true,
            shopOrders: true,
            barTabs: true,
            transactions: true,
          },
        },
      },
    });

    // Dynamically calculate status based on actual expiry
    const membersWithComputedStatus = members.map((m) => {
      const computedStatus = PricingCalculator.getMembershipStatus(m.expiryDate);
      return {
        ...m,
        computedStatus,
        isExpiringSoon: computedStatus === "EXPIRING_SOON",
      };
    });

    return NextResponse.json({ success: true, members: membersWithComputedStatus });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, phone, planTier, durationMonths = 1, notes, paymentMethod = PaymentMethod.UPI } = body;

    if (!name || !email || !phone || !planTier) {
      return NextResponse.json(
        { success: false, error: "Name, email, phone, and membership plan tier are required." },
        { status: 400 }
      );
    }

    const plan = await prisma.membershipPlan.findUnique({
      where: { tier: planTier as PlanTier },
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: "Invalid membership plan tier." }, { status: 400 });
    }

    const now = new Date();
    const expiryDate = addMonths(now, durationMonths);
    const membershipFee = plan.monthlyFee * durationMonths;

    // Generate unique member number
    const count = await prisma.member.count();
    const tierPrefix = planTier === PlanTier.GOLD ? "CC-1" : planTier === PlanTier.SILVER ? "CC-2" : "CC-3";
    const memberNumber = `${tierPrefix}${String(count + 1).padStart(3, "0")}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create member
      const member = await tx.member.create({
        data: {
          memberNumber,
          name,
          email,
          phone,
          planTier: planTier as PlanTier,
          startDate: now,
          expiryDate,
          status: MemberStatus.ACTIVE,
          notes,
        },
        include: { plan: true },
      });

      // 2. Write to unified ledger
      const refNo = `TXN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

      const transaction = await tx.transaction.create({
        data: {
          referenceNo: refNo,
          type: TransactionType.MEMBERSHIP_FEE,
          category: TransactionCategory.MEMBERSHIP,
          amount: membershipFee,
          paymentMethod: paymentMethod as PaymentMethod,
          memberId: member.id,
          notes: `New Member Enrollment: ${plan.name} (${durationMonths} month(s))`,
        },
      });

      return { member, transaction };
    });

    return NextResponse.json({
      success: true,
      member: result.member,
      transaction: result.transaction,
      message: `Member ${result.member.name} enrolled with ID ${result.member.memberNumber}.`,
    });
  } catch (error: any) {
    console.error("Member creation error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
