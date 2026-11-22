import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { LeadStatus, PlanTier, PaymentMethod, MemberStatus, TransactionType, TransactionCategory } from "@prisma/client";
import { addMonths } from "date-fns";
import { validateEmail } from "@/lib/email-validator";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") as LeadStatus | null;

    const where: any = {};
    if (status) where.status = status;

    const leads = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, leads });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
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
    const { name, email, phone, interest, notes, trialDate } = body;

    if (!name || !email || !phone) {
      return NextResponse.json(
        { success: false, error: "Name, email, and phone are required for trial booking." },
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

    const normalizedEmail = (emailValidation.normalizedEmail || (typeof email === "string" ? email.trim() : email)).toLowerCase();

    const lead = await prisma.lead.create({
      data: {
        name: typeof name === "string" ? name.trim() : name,
        email: normalizedEmail,
        phone: typeof phone === "string" ? phone.trim() : phone,
        interest: interest || "General Club Membership & Trial",
        notes: notes || "Submitted via online club portal",
        trialDate: trialDate ? new Date(trialDate) : null,
        status: LeadStatus.NEW,
      },
    });

    return NextResponse.json({
      success: true,
      lead,
      message: "Trial booking inquiry received! Our front desk team will contact you shortly.",
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { leadId, action, quoteAmount, notes, planTier = PlanTier.GOLD } = body;

    if (!leadId) {
      return NextResponse.json({ success: false, error: "Lead ID required" }, { status: 400 });
    }

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
    }

    // Action A: Send Quote
    if (action === "SEND_QUOTE") {
      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: LeadStatus.QUOTE_SENT,
          quoteAmount: Number(quoteAmount) || 6000,
          notes: notes ? `${lead.notes || ""}\n[Quote Sent: ₹${quoteAmount}] ${notes}` : lead.notes,
        },
      });

      return NextResponse.json({
        success: true,
        lead: updated,
        message: `Quote of ₹${quoteAmount} dispatched to ${lead.name} (${lead.email}).`,
      });
    }

    // Action B: Convert to Member & Record in Ledger
    if (action === "CONVERT_TO_MEMBER") {
      const plan = await prisma.membershipPlan.findUnique({
        where: { tier: planTier as PlanTier },
      });

      if (!plan) {
        return NextResponse.json({ success: false, error: "Plan tier not found" }, { status: 400 });
      }

      const now = new Date();
      const count = await prisma.member.count();
      const tierPrefix = planTier === PlanTier.GOLD ? "CC-1" : planTier === PlanTier.SILVER ? "CC-2" : "CC-3";
      let suffix = count + 1;
      let candidate = `${tierPrefix}${String(suffix).padStart(3, "0")}`;
      while (await prisma.member.findUnique({ where: { memberNumber: candidate } })) {
        suffix++;
        candidate = `${tierPrefix}${String(suffix).padStart(3, "0")}`;
      }
      const memberNumber = candidate;

      const result = await prisma.$transaction(async (tx) => {
        // Create member
        const member = await tx.member.create({
          data: {
            memberNumber,
            name: lead.name,
            email: lead.email,
            phone: lead.phone,
            planTier: planTier as PlanTier,
            startDate: now,
            expiryDate: addMonths(now, 1),
            status: MemberStatus.ACTIVE,
            notes: `Converted from online lead (${lead.interest})`,
          },
        });

        // Update lead
        await tx.lead.update({
          where: { id: lead.id },
          data: {
            status: LeadStatus.CONVERTED,
            convertedToId: member.id,
          },
        });

        // Record in ledger
        const refNo = `TXN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}${Math.floor(
          1000 + Math.random() * 9000
        )}`;

        const transaction = await tx.transaction.create({
          data: {
            referenceNo: refNo,
            type: TransactionType.MEMBERSHIP_FEE,
            category: TransactionCategory.MEMBERSHIP,
            amount: plan.monthlyFee,
            paymentMethod: PaymentMethod.UPI,
            memberId: member.id,
            notes: `Converted Online Enquiry to ${plan.name} Member`,
          },
        });

        return { member, transaction };
      });

      return NextResponse.json({
        success: true,
        member: result.member,
        transaction: result.transaction,
        message: `🎉 Success! Welcomed ${result.member.name} as a new ${planTier} member!`,
      });
    }

    // Action C: Contacted or General Update
    if (action === "UPDATE_STATUS") {
      const updated = await prisma.lead.update({
        where: { id: leadId },
        data: {
          status: body.status || LeadStatus.CONTACTED,
          notes: notes ? `${lead.notes || ""}\n${notes}` : lead.notes,
        },
      });

      return NextResponse.json({ success: true, lead: updated });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
