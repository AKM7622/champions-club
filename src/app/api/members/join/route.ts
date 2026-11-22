import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  PlanTier,
  MemberStatus,
  PaymentMethod,
  TransactionType,
  TransactionCategory,
  UserRole,
} from "@prisma/client";
import { addMonths } from "date-fns";
import { PricingCalculator } from "@/lib/pricing";
import { hashPassword, createSession, SESSION_COOKIE_NAME } from "@/lib/auth";
import { validatePasswordStrength } from "@/lib/password-validator";
import { logAuthEvent } from "@/lib/audit";
import { validateEmail } from "@/lib/email-validator";

// Helper to find collision-free memberNumber
async function getNextMemberNumber(tier: PlanTier): Promise<string> {
  const tierPrefix =
    tier === PlanTier.GOLD
      ? "CC-1"
      : tier === PlanTier.SILVER
      ? "CC-2"
      : "CC-3";
  const count = await prisma.member.count();
  let suffix = count + 1;
  let candidate = `${tierPrefix}${String(suffix).padStart(3, "0")}`;
  while (await prisma.member.findUnique({ where: { memberNumber: candidate } })) {
    suffix++;
    candidate = `${tierPrefix}${String(suffix).padStart(3, "0")}`;
  }
  return candidate;
}

export async function POST(req: NextRequest) {
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || "unknown";

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

    const {
      name,
      email,
      phone,
      password,
      planTier,
      durationMonths = 1,
      paymentMethod = PaymentMethod.UPI,
      notes,
    } = body;

    // 1. Validate required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Full Name is required." },
        { status: 400 }
      );
    }

    if (!email || typeof email !== "string" || !email.trim()) {
      return NextResponse.json(
        { success: false, error: "Email address is required." },
        { status: 400 }
      );
    }

    const emailValidation = await validateEmail(email.trim());
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

    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json(
        { success: false, error: "Phone number is required." },
        { status: 400 }
      );
    }

    if (!password || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Password is required to create your Member account." },
        { status: 400 }
      );
    }

    if (password.length > 128) {
      return NextResponse.json(
        { success: false, error: "Password must not exceed 128 characters." },
        { status: 400 }
      );
    }

    if (!planTier) {
      return NextResponse.json(
        { success: false, error: "Membership plan tier is required." },
        { status: 400 }
      );
    }

    // 2. Validate Plan Tier
    const normalizedTier = typeof planTier === "string" ? planTier.toUpperCase() : planTier;
    if (!Object.values(PlanTier).includes(normalizedTier as PlanTier)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid membership tier '${planTier}'. Valid tiers are ${Object.values(PlanTier).join(", ")}.`,
        },
        { status: 400 }
      );
    }

    // 3. Validate Password Security Requirements
    const pwdValidation = validatePasswordStrength(password);
    if (!pwdValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: pwdValidation.errorMessage || "Password must be at least 8 characters and include uppercase, lowercase, and numeric characters.",
        },
        { status: 400 }
      );
    }

    // 4. Validate Duration (clamped 1 to 60 months)
    const rawDuration = Number(durationMonths);
    const validDuration = Math.min(60, Math.max(1, Math.floor(isNaN(rawDuration) ? 1 : rawDuration)));

    // 5. Validate Payment Method
    if (paymentMethod && !Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid payment method '${paymentMethod}'. Valid methods: ${Object.values(PaymentMethod).join(", ")}.`,
        },
        { status: 400 }
      );
    }
    const resolvedPaymentMethod: PaymentMethod = (paymentMethod as PaymentMethod) || PaymentMethod.UPI;

    // 6. Check if email already registered as User or Member
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "An account with this email address already exists. Please sign in or use another email.",
        },
        { status: 400 }
      );
    }

    const existingMember = await prisma.member.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    });
    if (existingMember) {
      return NextResponse.json(
        {
          success: false,
          error: "A member profile with this email address already exists.",
        },
        { status: 400 }
      );
    }

    // 7. Look up Plan in database
    const plan = await prisma.membershipPlan.findUnique({
      where: { tier: normalizedTier as PlanTier },
    });
    if (!plan) {
      return NextResponse.json(
        { success: false, error: `Membership plan for tier ${normalizedTier} not found in database.` },
        { status: 404 }
      );
    }

    // 8. Calculate membership fee via PricingCalculator
    const feeCalculation = PricingCalculator.calculateMembershipFee({
      monthlyFee: plan.monthlyFee,
      durationMonths: validDuration,
      tier: plan.tier,
    });
    const membershipFee = feeCalculation.finalPrice;

    // 9. Hash password with bcrypt
    const hashedPassword = await hashPassword(password);

    // 10. Dates calculation
    const now = new Date();
    const expiryDate = addMonths(now, validDuration);

    // 11. Execute DB Transaction with concurrency retry loop
    let memberNumber = await getNextMemberNumber(plan.tier);
    let attempts = 0;
    const maxAttempts = 5;
    let result: { member: any; user: any; transaction: any } | null = null;

    while (attempts < maxAttempts) {
      try {
        result = await prisma.$transaction(async (tx) => {
          // Step A: Create Member record
          const member = await tx.member.create({
            data: {
              memberNumber,
              name: name.trim(),
              email: normalizedEmail,
              phone: phone.trim(),
              planTier: plan.tier,
              startDate: now,
              expiryDate,
              status: MemberStatus.ACTIVE,
              notes: notes ? String(notes).slice(0, 500) : "Enrolled directly via Champions Club Public Website",
            },
            include: { plan: true },
          });

          // Step B: Create User account linked to Member
          const user = await tx.user.create({
            data: {
              email: normalizedEmail,
              password: hashedPassword,
              name: name.trim(),
              role: UserRole.MEMBER,
              memberId: member.id,
            },
            include: {
              member: {
                include: { plan: true },
              },
            },
          });

          // Step C: Write MEMBERSHIP_FEE entry to unified Transaction ledger
          const refNo = `TXN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Date.now()
            .toString()
            .slice(-4)}${Math.floor(1000 + Math.random() * 9000)}`;

          const transaction = await tx.transaction.create({
            data: {
              referenceNo: refNo,
              type: TransactionType.MEMBERSHIP_FEE,
              category: TransactionCategory.MEMBERSHIP,
              amount: membershipFee,
              paymentMethod: resolvedPaymentMethod,
              memberId: member.id,
              notes: `Public Online Enrollment: ${plan.name} (${validDuration} mo) paid via ${resolvedPaymentMethod}`,
            },
          });

          return { member, user, transaction };
        });
        break; // Successfully committed!
      } catch (txErr: any) {
        if (txErr?.code === "P2002") {
          const target = txErr?.meta?.target;
          const isMemberNumberCollision =
            (Array.isArray(target) && target.includes("memberNumber")) ||
            (typeof target === "string" && target.includes("memberNumber"));

          if (isMemberNumberCollision) {
            attempts++;
            memberNumber = await getNextMemberNumber(plan.tier);
            continue;
          }

          const isEmailCollision =
            (Array.isArray(target) && target.includes("email")) ||
            (typeof target === "string" && target.includes("email"));

          if (isEmailCollision) {
            return NextResponse.json(
              {
                success: false,
                error: "An account with this email address already exists. Please sign in or use another email.",
              },
              { status: 400 }
            );
          }
        }
        throw txErr;
      }
    }

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Failed to generate unique member identifier. Please try again." },
        { status: 500 }
      );
    }

    // 13. Create authenticated session for instant seamless portal access
    const session = await createSession(result.user.id, UserRole.MEMBER, true);

    // 14. Audit log event
    await logAuthEvent({
      eventType: "LOGIN_SUCCESS",
      userId: result.user.id,
      email: result.user.email,
      ipAddress,
      userAgent,
      details: `Public online enrollment completed. New member ${result.member.memberNumber} (${plan.tier})`,
    });

    // 15. Return JSON response and set session cookie
    const response = NextResponse.json({
      success: true,
      member: result.member,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        member: result.user.member,
      },
      transaction: result.transaction,
      feeCalculation,
      message: `Welcome to The Champions Club, ${result.member.name}! Your membership number is ${result.member.memberNumber}.`,
    });

    response.cookies.set(SESSION_COOKIE_NAME, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: session.expiresAt,
      maxAge: session.maxAgeSeconds,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Public member enrollment error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to complete membership enrollment" },
      { status: 500 }
    );
  }
}
