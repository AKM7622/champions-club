import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { addMonths } from "date-fns";
import { PaymentMethod, TransactionCategory, TransactionType, PlanTier, MemberStatus } from "@prisma/client";
import { PricingCalculator } from "@/lib/pricing";
import { getUserFromSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

async function verifyStaffAccess(req: NextRequest) {
  // Check header first (populated by edge middleware)
  const headerRole = req.headers.get("x-user-role");
  const headerUserId = req.headers.get("x-user-id");

  if (headerRole) {
    if (headerRole === "OWNER" || headerRole === "FRONT_DESK") {
      return { authorized: true, userId: headerUserId, role: headerRole };
    }
    return { authorized: false, status: 403, error: "Forbidden: Member management requires FRONT_DESK or OWNER role." };
  }

  // Check cookie session
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return { authorized: false, status: 401, error: "Unauthorized: Please log in to proceed." };
  }

  const user = await getUserFromSessionToken(token);
  if (!user) {
    return { authorized: false, status: 401, error: "Unauthorized: Invalid or expired session." };
  }

  if (user.role !== "OWNER" && user.role !== "FRONT_DESK") {
    return { authorized: false, status: 403, error: "Forbidden: Member management requires FRONT_DESK or OWNER role." };
  }

  return { authorized: true, userId: user.id, role: user.role };
}

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
    const auth = await verifyStaffAccess(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const {
      action,
      planTier,
      tier,
      newTier,
      targetTier: customTier,
      durationMonths = 1,
      paymentMethod = PaymentMethod.UPI,
      discountPercent = 0,
      transactionId,
      notes,
    } = body;

    const member = await prisma.member.findUnique({
      where: { id: params.id },
      include: { plan: true },
    });

    if (!member) {
      return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });
    }

    if (action === "RENEW") {
      const selectedTier = (planTier || tier || newTier || customTier || member.planTier) as PlanTier;

      if (!Object.values(PlanTier).includes(selectedTier)) {
        return NextResponse.json(
          { success: false, error: `Invalid membership plan tier '${selectedTier}'. Valid tiers: ${Object.values(PlanTier).join(", ")}` },
          { status: 400 }
        );
      }

      const numDuration = Math.floor(Number(durationMonths));
      if (isNaN(numDuration) || numDuration < 1) {
        return NextResponse.json(
          { success: false, error: "Renewal duration must be at least 1 month." },
          { status: 400 }
        );
      }

      const targetPlan = await prisma.membershipPlan.findUnique({
        where: { tier: selectedTier },
      });

      if (!targetPlan) {
        return NextResponse.json(
          { success: false, error: "Target membership plan configuration not found." },
          { status: 404 }
        );
      }

      // Calculate dynamic price via PricingCalculator
      const feeCalculation = PricingCalculator.calculateMembershipFee({
        monthlyFee: targetPlan.monthlyFee,
        durationMonths: numDuration,
        tier: targetPlan.tier,
        discountPercent: Number(discountPercent) || 0,
      });

      const renewalFee = feeCalculation.finalPrice;

      const now = new Date();
      const currentExpiry = new Date(member.expiryDate);
      const isCurrentExpiryValid = !isNaN(currentExpiry.getTime());
      const baseDate = isCurrentExpiryValid && currentExpiry > now ? currentExpiry : now;
      const newExpiryDate = addMonths(baseDate, numDuration);

      const isTierChanged = member.planTier !== targetPlan.tier;
      const defaultNotes = isTierChanged
        ? `Membership Tier Switch & Renewal: ${member.planTier} -> ${targetPlan.tier} (${targetPlan.name}, +${numDuration} month(s))`
        : `Membership Renewal: ${targetPlan.name} (+${numDuration} month(s))`;

      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.member.update({
          where: { id: member.id },
          data: {
            planTier: targetPlan.tier,
            expiryDate: newExpiryDate,
            status: MemberStatus.ACTIVE,
          },
          include: { plan: true },
        });

        let transaction = null;

        if (transactionId) {
          transaction = await tx.transaction.findUnique({
            where: { id: transactionId },
          });
          if (transaction) {
            transaction = await tx.transaction.update({
              where: { id: transaction.id },
              data: {
                memberId: member.id,
                notes: notes || defaultNotes,
              },
            });
          }
        }

        if (!transaction) {
          const refNo = `TXN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}${Math.floor(
            1000 + Math.random() * 9000
          )}`;

          transaction = await tx.transaction.create({
            data: {
              referenceNo: refNo,
              type: TransactionType.MEMBERSHIP_FEE,
              category: TransactionCategory.MEMBERSHIP,
              amount: renewalFee,
              paymentMethod: (paymentMethod as PaymentMethod) || PaymentMethod.UPI,
              memberId: member.id,
              notes: notes || defaultNotes,
            },
          });
        }

        return { member: updated, transaction };
      });

      return NextResponse.json({
        success: true,
        member: result.member,
        transaction: result.transaction,
        feeCalculation,
        message: isTierChanged
          ? `Membership switched from ${member.planTier} to ${result.member.plan.name} and extended until ${result.member.expiryDate.toISOString().split("T")[0]}.`
          : `Membership extended until ${result.member.expiryDate.toISOString().split("T")[0]}.`,
      });
    }

    return NextResponse.json({ success: false, error: "Unsupported action. Expected action 'RENEW'." }, { status: 400 });
  } catch (error: any) {
    console.error("Member patch error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to update member" }, { status: 500 });
  }
}
