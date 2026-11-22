import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PlanTier, MemberStatus, PaymentMethod, TransactionType, TransactionCategory, UserRole } from "@prisma/client";
import { addMonths } from "date-fns";
import { PricingCalculator } from "@/lib/pricing-calculator";
import { hashPassword, createSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { validatePasswordStrength } from "@/lib/password-validator";
import { validateEmail } from "@/lib/email-validator";

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

// Generate unique member number helper
async function getStaffMemberNumber(tier: PlanTier): Promise<string> {
  const count = await prisma.member.count();
  const tierPrefix = tier === PlanTier.GOLD ? "CC-1" : tier === PlanTier.SILVER ? "CC-2" : "CC-3";
  let suffix = count + 1;
  let candidate = `${tierPrefix}${String(suffix).padStart(3, "0")}`;
  while (await prisma.member.findUnique({ where: { memberNumber: candidate } })) {
    suffix++;
    candidate = `${tierPrefix}${String(suffix).padStart(3, "0")}`;
  }
  return candidate;
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }
    const { name, email, phone, password, planTier, durationMonths = 1, notes, paymentMethod = PaymentMethod.UPI } = body;

    if (!name || !email || !phone || !planTier) {
      return NextResponse.json(
        { success: false, error: "Name, email, phone, and membership plan tier are required." },
        { status: 400 }
      );
    }

    const emailValidation = await validateEmail(typeof email === "string" ? email.trim() : "");
    if (!emailValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error:
            emailValidation.errorCode === "INVALID_SYNTAX"
              ? "Please provide a valid email address."
              : emailValidation.error || "The email domain does not exist or has no active mail servers.",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = (emailValidation.normalizedEmail || email).trim().toLowerCase();

    // Prevent duplicate enrollment with the same email address
    const existingMember = await prisma.member.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (existingMember) {
      return NextResponse.json(
        { success: false, error: "A member profile with this email address already exists." },
        { status: 400 }
      );
    }

    if (password) {
      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      });
      if (existingUser) {
        return NextResponse.json(
          { success: false, error: "A user account with this email address already exists." },
          { status: 400 }
        );
      }
    }

    const plan = await prisma.membershipPlan.findUnique({
      where: { tier: planTier as PlanTier },
    });

    if (!plan) {
      return NextResponse.json({ success: false, error: "Invalid membership plan tier." }, { status: 400 });
    }

    let hashedPassword: string | null = null;
    if (password) {
      const pwdValidation = validatePasswordStrength(password);
      if (!pwdValidation.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: pwdValidation.errorMessage || "Password does not meet complexity requirements.",
          },
          { status: 400 }
        );
      }
      hashedPassword = await hashPassword(password);
    }

    const now = new Date();
    const validDuration = Math.max(1, Math.floor(Number(durationMonths) || 1));
    const expiryDate = addMonths(now, validDuration);
    const feeCalculation = PricingCalculator.calculateMembershipFee({
      monthlyFee: plan.monthlyFee,
      durationMonths: validDuration,
      tier: plan.tier,
    });
    const membershipFee = feeCalculation.finalPrice;

    let memberNumber = await getStaffMemberNumber(planTier as PlanTier);
    let attempts = 0;
    const maxAttempts = 5;
    let result: { member: any; user: any; transaction: any } | null = null;

    while (attempts < maxAttempts) {
      try {
        result = await prisma.$transaction(async (tx) => {
          // 1. Create member
          const member = await tx.member.create({
            data: {
              memberNumber,
              name: name.trim(),
              email: normalizedEmail,
              phone: phone.trim(),
              planTier: planTier as PlanTier,
              startDate: now,
              expiryDate,
              status: MemberStatus.ACTIVE,
              notes,
            },
            include: { plan: true },
          });

          // 2. Create User account if password was provided
          let user = null;
          if (hashedPassword) {
            user = await tx.user.create({
              data: {
                email: normalizedEmail,
                password: hashedPassword,
                name: name.trim(),
                role: UserRole.MEMBER,
                memberId: member.id,
              },
            });
          }

          // 3. Write to unified ledger
          const refNo = `TXN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}${Math.floor(
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
              notes: `Member Enrollment: ${plan.name} (${validDuration} month(s))`,
            },
          });

          return { member, user, transaction };
        });
        break;
      } catch (txErr: any) {
        if (txErr?.code === "P2002") {
          const target = txErr?.meta?.target;
          const isEmailCollision =
            (Array.isArray(target) && target.includes("email")) ||
            (typeof target === "string" && target.includes("email"));

          if (isEmailCollision) {
            return NextResponse.json(
              { success: false, error: "A member profile with this email address already exists." },
              { status: 400 }
            );
          }

          attempts++;
          memberNumber = await getStaffMemberNumber(planTier as PlanTier);
          continue;
        }
        throw txErr;
      }
    }

    if (!result) {
      return NextResponse.json({ success: false, error: "Failed to generate unique member identifier" }, { status: 500 });
    }

    let session = null;
    if (result.user) {
      session = await createSession(result.user.id, UserRole.MEMBER, true);
    }

    const response = NextResponse.json({
      success: true,
      member: result.member,
      user: result.user,
      transaction: result.transaction,
      message: `Member ${result.member.name} enrolled with ID ${result.member.memberNumber}.`,
    });

    if (session) {
      response.cookies.set(SESSION_COOKIE_NAME, session.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        expires: session.expiresAt,
        maxAge: session.maxAgeSeconds,
        path: "/",
      });
    }

    return response;
  } catch (error: any) {
    console.error("Member creation error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
