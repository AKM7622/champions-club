import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PlanTier } from "@prisma/client";
import { getUserFromSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function verifyOwnerAccess(req: NextRequest) {
  // Check header first (populated by edge middleware)
  const headerRole = req.headers.get("x-user-role");
  const headerUserId = req.headers.get("x-user-id");

  if (headerRole) {
    if (headerRole === "OWNER") {
      return { authorized: true, userId: headerUserId, role: "OWNER" };
    }
    return { authorized: false, status: 403, error: "Forbidden: Modifying membership plans requires OWNER permissions." };
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

  if (user.role !== "OWNER") {
    return { authorized: false, status: 403, error: "Forbidden: Modifying membership plans requires OWNER permissions." };
  }

  return { authorized: true, userId: user.id, role: user.role };
}

export async function getPlans(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tier = searchParams.get("tier") as PlanTier | null;

    if (tier && !Object.values(PlanTier).includes(tier as PlanTier)) {
      return NextResponse.json(
        { success: false, error: `Invalid membership tier filter '${tier}'. Valid tiers: ${Object.values(PlanTier).join(", ")}` },
        { status: 400 }
      );
    }

    const where: any = {};
    if (tier) {
      where.tier = tier;
    }

    const plans = await prisma.membershipPlan.findMany({
      where,
      orderBy: { monthlyFee: "desc" },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return NextResponse.json({ success: true, plans });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function updatePlan(req: NextRequest) {
  try {
    const auth = await verifyOwnerAccess(req);
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    }

    const body = await req.json();
    const {
      id,
      tier,
      name,
      description,
      monthlyFee,
      courtDiscountPercent,
      shopDiscountPercent,
      barDiscountPercent,
      maxDailyBookings,
      perks,
      color,
    } = body;

    if (!id && !tier) {
      return NextResponse.json(
        { success: false, error: "Either plan id or tier is required to update a membership plan." },
        { status: 400 }
      );
    }

    if (id !== undefined && (typeof id !== "string" || !id.trim())) {
      return NextResponse.json(
        { success: false, error: "Plan id must be a valid non-empty string." },
        { status: 400 }
      );
    }

    if (tier !== undefined && !Object.values(PlanTier).includes(tier as PlanTier)) {
      return NextResponse.json(
        { success: false, error: `Invalid membership plan tier '${tier}'. Valid tiers: ${Object.values(PlanTier).join(", ")}` },
        { status: 400 }
      );
    }

    // Locate the plan
    const existing = await prisma.membershipPlan.findUnique({
      where: id ? { id: id.trim() } : { tier: tier as PlanTier },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Membership plan not found." },
        { status: 404 }
      );
    }

    const updateData: any = {};

    // Validate and update fields
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return NextResponse.json({ success: false, error: "Plan name cannot be empty." }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (monthlyFee !== undefined) {
      const numMonthlyFee = Number(monthlyFee);
      if (isNaN(numMonthlyFee) || numMonthlyFee < 0) {
        return NextResponse.json(
          { success: false, error: "Monthly fee must be a non-negative number." },
          { status: 400 }
        );
      }
      updateData.monthlyFee = numMonthlyFee;
    }

    if (courtDiscountPercent !== undefined) {
      const numCourt = Number(courtDiscountPercent);
      if (isNaN(numCourt) || numCourt < 0 || numCourt > 100) {
        return NextResponse.json(
          { success: false, error: "Court booking discount must be between 0% and 100%." },
          { status: 400 }
        );
      }
      updateData.courtDiscountPercent = numCourt;
    }

    if (shopDiscountPercent !== undefined) {
      const numShop = Number(shopDiscountPercent);
      if (isNaN(numShop) || numShop < 0 || numShop > 100) {
        return NextResponse.json(
          { success: false, error: "Shop discount must be between 0% and 100%." },
          { status: 400 }
        );
      }
      updateData.shopDiscountPercent = numShop;
    }

    if (barDiscountPercent !== undefined) {
      const numBar = Number(barDiscountPercent);
      if (isNaN(numBar) || numBar < 0 || numBar > 100) {
        return NextResponse.json(
          { success: false, error: "Bar discount must be between 0% and 100%." },
          { status: 400 }
        );
      }
      updateData.barDiscountPercent = numBar;
    }

    if (maxDailyBookings !== undefined) {
      const numBookings = Math.floor(Number(maxDailyBookings));
      if (isNaN(numBookings) || numBookings < 1) {
        return NextResponse.json(
          { success: false, error: "Max daily bookings must be at least 1." },
          { status: 400 }
        );
      }
      updateData.maxDailyBookings = numBookings;
    }

    if (perks !== undefined) {
      let perksArray: string[] = [];
      if (Array.isArray(perks)) {
        perksArray = perks.map((p) => String(p).trim()).filter(Boolean);
      } else if (typeof perks === "string") {
        perksArray = perks
          .split(/\r?\n|,/)
          .map((p) => p.trim())
          .filter(Boolean);
      }
      updateData.perks = perksArray;
    }

    if (color !== undefined && typeof color === "string") {
      updateData.color = color.trim();
    }

    // If description is explicitly provided and name wasn't provided, use description as name
    if (description !== undefined && typeof description === "string" && !updateData.name && description.trim()) {
      updateData.name = description.trim();
    }

    const updatedPlan = await prisma.membershipPlan.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      plan: updatedPlan,
      message: `Membership plan '${updatedPlan.name}' successfully updated.`,
    });
  } catch (error: any) {
    console.error("Plan update error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update membership plan" },
      { status: 500 }
    );
  }
}
