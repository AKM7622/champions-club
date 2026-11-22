import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db";
import { PricingCalculator } from "../src/lib/pricing";
import { PlanTier, MemberStatus, PaymentMethod, TransactionType, TransactionCategory } from "@prisma/client";
import { GET as getPlansHandler, PUT as putPlansHandler, PATCH as patchPlansHandler } from "../src/app/api/plans/route";
import { GET as getAdminPlansHandler, PUT as putAdminPlansHandler, PATCH as patchAdminPlansHandler } from "../src/app/api/admin/plans/route";
import { PATCH as patchMemberHandler } from "../src/app/api/members/[id]/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/auth-token";
import { addMonths } from "date-fns";

async function runTestSuite() {
  console.log("=== STARTING MEMBERSHIP PLAN CONFIGURATION & RENEWAL TEST SUITE ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  // Set up signed session tokens for test roles
  const ownerToken = await signSessionToken({
    sessionToken: `test-owner-${Date.now()}`,
    userId: "test-owner-id",
    role: "OWNER",
    exp: Date.now() + 3600000,
  });

  const frontDeskToken = await signSessionToken({
    sessionToken: `test-frontdesk-${Date.now()}`,
    userId: "test-frontdesk-id",
    role: "FRONT_DESK",
    exp: Date.now() + 3600000,
  });

  const memberToken = await signSessionToken({
    sessionToken: `test-member-${Date.now()}`,
    userId: "test-member-id",
    role: "MEMBER",
    exp: Date.now() + 3600000,
  });

  // ==========================================
  // [1] PricingCalculator Unit Tests
  // ==========================================
  console.log("\n[1] Testing PricingCalculator (Membership Fee & Custom Durations)...");

  // Standard durations
  const fee1Mo = PricingCalculator.calculateMembershipFee({
    monthlyFee: 6000,
    durationMonths: 1,
    tier: PlanTier.GOLD,
  });
  assert(fee1Mo.basePrice === 6000 && fee1Mo.finalPrice === 6000, "1 month Gold fee is 6000");

  const fee3Mo = PricingCalculator.calculateMembershipFee({
    monthlyFee: 3500,
    durationMonths: 3,
    tier: PlanTier.SILVER,
  });
  assert(fee3Mo.basePrice === 10500 && fee3Mo.finalPrice === 10500, "3 months Silver fee is 10500");

  const fee12Mo = PricingCalculator.calculateMembershipFee({
    monthlyFee: 2200,
    durationMonths: 12,
    tier: PlanTier.JUNIOR,
  });
  assert(fee12Mo.basePrice === 26400 && fee12Mo.finalPrice === 26400, "12 months Junior fee is 26400");

  // Custom durations (e.g. 5 months, 7 months)
  const fee5Mo = PricingCalculator.calculateMembershipFee({
    monthlyFee: 6000,
    durationMonths: 5,
    tier: PlanTier.GOLD,
  });
  assert(fee5Mo.basePrice === 30000 && fee5Mo.finalPrice === 30000, "Custom 5 months Gold fee is 30000");

  const fee7Mo = PricingCalculator.calculateMembershipFee({
    monthlyFee: 3500,
    durationMonths: 7,
    tier: PlanTier.SILVER,
  });
  assert(fee7Mo.basePrice === 24500 && fee7Mo.finalPrice === 24500, "Custom 7 months Silver fee is 24500");

  // Renewal discount calculation
  const feeWithDiscount = PricingCalculator.calculateMembershipFee({
    monthlyFee: 6000,
    durationMonths: 12,
    tier: PlanTier.GOLD,
    discountPercent: 10,
  });
  assert(feeWithDiscount.basePrice === 72000, "12 mo base price is 72000");
  assert(feeWithDiscount.discountAmount === 7200, "10% discount is 7200");
  assert(feeWithDiscount.finalPrice === 64800, "Final price after 10% discount is 64800");

  // Clamping boundary edge cases
  const clampedDuration = PricingCalculator.calculateMembershipFee({
    monthlyFee: 1000,
    durationMonths: 0,
  });
  assert(clampedDuration.durationMonths === 1, "Duration 0 clamped to minimum 1 month");

  const clampedFloatDuration = PricingCalculator.calculateMembershipFee({
    monthlyFee: 3000,
    durationMonths: 2.5,
  });
  assert(clampedFloatDuration.durationMonths === 2 && clampedFloatDuration.finalPrice === 6000, "Float duration 2.5 clamped to 2 months (₹6000)");

  const clampedNegativeDuration = PricingCalculator.calculateMembershipFee({
    monthlyFee: 3000,
    durationMonths: -4,
  });
  assert(clampedNegativeDuration.durationMonths === 1 && clampedNegativeDuration.finalPrice === 3000, "Negative duration clamped to minimum 1 month");

  const clampedNegativeFee = PricingCalculator.calculateMembershipFee({
    monthlyFee: -500,
    durationMonths: 3,
  });
  assert(clampedNegativeFee.monthlyFee === 0 && clampedNegativeFee.finalPrice === 0, "Negative monthly fee clamped to 0");

  const clampedDiscount = PricingCalculator.calculateMembershipFee({
    monthlyFee: 1000,
    durationMonths: 1,
    discountPercent: 150,
  });
  assert(clampedDiscount.discountPercent === 100, "Discount > 100 clamped to 100%");

  // Dynamic pricing with updated rules
  const customPlanRules = {
    tier: PlanTier.GOLD,
    courtDiscountPercent: 80,
    shopDiscountPercent: 25,
    barDiscountPercent: 15,
    maxDailyBookings: 3,
  };

  const courtPrice = PricingCalculator.calculateCourtBooking({
    hourlyRate: 800,
    durationMinutes: 60,
    plan: customPlanRules,
  });
  assert(courtPrice.discountAmount === 640, "80% court discount correctly applied (₹640 off ₹800)");
  assert(courtPrice.finalPrice === 160, "Court final price is ₹160");

  const shopPrice = PricingCalculator.calculateShopOrder({
    items: [{ unitPrice: 2000, quantity: 2 }],
    plan: customPlanRules,
  });
  assert(shopPrice.subtotal === 4000, "Shop subtotal is ₹4000");
  assert(shopPrice.discountAmount === 1000, "25% shop discount correctly applied (₹1000 off ₹4000)");
  assert(shopPrice.finalPrice === 3000, "Shop final price is ₹3000");

  const barPrice = PricingCalculator.calculateBarBill({
    items: [{ unitPrice: 500, quantity: 2 }],
    plan: customPlanRules,
  });
  assert(barPrice.subtotal === 1000, "Bar subtotal is ₹1000");
  assert(barPrice.discountAmount === 150, "15% bar discount correctly applied (₹150 off ₹1000)");

  // ==========================================
  // [2] Membership Plan Configuration API Tests
  // ==========================================
  console.log("\n[2] Testing Membership Plans API (/api/plans & /api/admin/plans)...");

  // GET /api/plans
  const reqGetPlans = new NextRequest("http://localhost:3000/api/plans");
  const resGetPlans = await getPlansHandler(reqGetPlans);
  assert(resGetPlans.status === 200, "GET /api/plans returns HTTP 200");
  const getPlansData = await resGetPlans.json();
  assert(getPlansData.success === true, "GET /api/plans success = true");
  assert(Array.isArray(getPlansData.plans) && getPlansData.plans.length >= 3, "Returns all membership plans");

  // RBAC: Unauthenticated PUT
  const reqUnauthPlan = new NextRequest("http://localhost:3000/api/plans", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier: "GOLD", monthlyFee: 7000 }),
  });
  const resUnauthPlan = await putPlansHandler(reqUnauthPlan);
  assert(resUnauthPlan.status === 401, "Unauthenticated PUT /api/plans returns 401 Unauthorized");

  // RBAC: Non-owner PUT (FRONT_DESK role)
  const reqFrontDeskPlan = new NextRequest("http://localhost:3000/api/plans", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "FRONT_DESK",
      "x-user-id": "fd-1",
    },
    body: JSON.stringify({ tier: "GOLD", monthlyFee: 7000 }),
  });
  const resFrontDeskPlan = await putPlansHandler(reqFrontDeskPlan);
  assert(resFrontDeskPlan.status === 403, "FRONT_DESK role receives 403 Forbidden when modifying plans");

  // Validation: Missing ID and Tier
  const reqMissingId = new NextRequest("http://localhost:3000/api/plans", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "OWNER",
      "x-user-id": "owner-1",
    },
    body: JSON.stringify({ monthlyFee: 7000 }),
  });
  const resMissingId = await putPlansHandler(reqMissingId);
  assert(resMissingId.status === 400, "Missing tier and ID returns 400 Bad Request");

  // Validation: Invalid Plan Tier ("PLATINUM") returns 400 (not 500)
  const reqInvalidTierUpdate = new NextRequest("http://localhost:3000/api/plans", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "OWNER",
      "x-user-id": "owner-1",
    },
    body: JSON.stringify({ tier: "PLATINUM", monthlyFee: 7000 }),
  });
  const resInvalidTierUpdate = await putPlansHandler(reqInvalidTierUpdate);
  assert(resInvalidTierUpdate.status === 400, "Invalid plan tier in PUT returns 400 Bad Request");

  // Validation: Empty Plan ID returns 400
  const reqEmptyIdUpdate = new NextRequest("http://localhost:3000/api/plans", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "OWNER",
      "x-user-id": "owner-1",
    },
    body: JSON.stringify({ id: "   ", monthlyFee: 7000 }),
  });
  const resEmptyIdUpdate = await putPlansHandler(reqEmptyIdUpdate);
  assert(resEmptyIdUpdate.status === 400, "Empty plan ID in PUT returns 400 Bad Request");

  // Validation: Invalid tier in GET filter query parameter
  const reqInvalidFilter = new NextRequest("http://localhost:3000/api/plans?tier=PLATINUM");
  const resInvalidFilter = await getPlansHandler(reqInvalidFilter);
  assert(resInvalidFilter.status === 400, "Invalid tier in GET /api/plans?tier=PLATINUM returns 400 Bad Request");

  // Defense-in-depth on /api/admin/plans GET
  const reqUnauthAdminGet = new NextRequest("http://localhost:3000/api/admin/plans");
  const resUnauthAdminGet = await getAdminPlansHandler(reqUnauthAdminGet);
  assert(resUnauthAdminGet.status === 401, "Unauthenticated GET /api/admin/plans returns 401 Unauthorized");

  const reqFrontDeskAdminGet = new NextRequest("http://localhost:3000/api/admin/plans", {
    headers: {
      "x-user-role": "FRONT_DESK",
      "x-user-id": "fd-1",
    },
  });
  const resFrontDeskAdminGet = await getAdminPlansHandler(reqFrontDeskAdminGet);
  assert(resFrontDeskAdminGet.status === 403, "FRONT_DESK role blocked (403) from GET /api/admin/plans");

  const reqOwnerAdminGet = new NextRequest("http://localhost:3000/api/admin/plans", {
    headers: {
      "x-user-role": "OWNER",
      "x-user-id": "owner-1",
    },
  });
  const resOwnerAdminGet = await getAdminPlansHandler(reqOwnerAdminGet);
  assert(resOwnerAdminGet.status === 200, "OWNER role allowed (200) on GET /api/admin/plans");

  // Validation: Negative monthly fee
  const reqNegativeFee = new NextRequest("http://localhost:3000/api/plans", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "OWNER",
      "x-user-id": "owner-1",
    },
    body: JSON.stringify({ tier: "GOLD", monthlyFee: -500 }),
  });
  const resNegativeFee = await putPlansHandler(reqNegativeFee);
  assert(resNegativeFee.status === 400, "Negative monthly fee returns 400 Bad Request");

  // Validation: Court discount > 100%
  const reqInvalidDiscount = new NextRequest("http://localhost:3000/api/plans", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "OWNER",
      "x-user-id": "owner-1",
    },
    body: JSON.stringify({ tier: "GOLD", courtDiscountPercent: 120 }),
  });
  const resInvalidDiscount = await putPlansHandler(reqInvalidDiscount);
  assert(resInvalidDiscount.status === 400, "Court discount > 100% returns 400 Bad Request");

  // Validation: Max daily bookings < 1
  const reqInvalidBookings = new NextRequest("http://localhost:3000/api/plans", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "OWNER",
      "x-user-id": "owner-1",
    },
    body: JSON.stringify({ tier: "GOLD", maxDailyBookings: 0 }),
  });
  const resInvalidBookings = await putPlansHandler(reqInvalidBookings);
  assert(resInvalidBookings.status === 400, "Max daily bookings < 1 returns 400 Bad Request");

  // Fetch initial Gold plan from DB to capture initial state for clean rollback
  const initialGold = await prisma.membershipPlan.findUnique({
    where: { tier: PlanTier.GOLD },
  });
  assert(initialGold !== null, "Initial Gold plan exists in database");

  // Valid Plan Update by OWNER
  try {
    const reqValidPlanUpdate = new NextRequest("http://localhost:3000/api/plans", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": "OWNER",
        "x-user-id": "owner-1",
      },
      body: JSON.stringify({
        tier: "GOLD",
        name: "Gold Premier All-Access",
        monthlyFee: 6500,
        courtDiscountPercent: 100,
        shopDiscountPercent: 25,
        barDiscountPercent: 25,
        maxDailyBookings: 3,
        perks: ["100% Free Courts", "25% Shop Discount", "25% Bar Discount", "3 Daily Bookings"],
      }),
    });
    const resValidPlanUpdate = await putPlansHandler(reqValidPlanUpdate);
    assert(resValidPlanUpdate.status === 200, "OWNER can update plan with HTTP 200");
    const updateData = await resValidPlanUpdate.json();
    assert(updateData.success === true, "Plan update returns success = true");
    assert(updateData.plan.name === "Gold Premier All-Access", "Plan name updated");
    assert(updateData.plan.monthlyFee === 6500, "Plan monthly fee updated to 6500");
    assert(updateData.plan.shopDiscountPercent === 25, "Plan shop discount updated to 25%");
    assert(updateData.plan.barDiscountPercent === 25, "Plan bar discount updated to 25%");
    assert(updateData.plan.maxDailyBookings === 3, "Plan max daily bookings updated to 3");

    // Verify DB persistence directly with Prisma
    const dbGold = await prisma.membershipPlan.findUnique({
      where: { tier: PlanTier.GOLD },
    });
    assert(dbGold?.monthlyFee === 6500, "PostgreSQL database reflects updated monthly fee (6500)");
    assert(dbGold?.name === "Gold Premier All-Access", "PostgreSQL database reflects updated plan name");
    assert(dbGold?.maxDailyBookings === 3, "PostgreSQL database reflects updated daily booking cap (3)");

    // Test /api/admin/plans route alias
    const reqAdminPlanPatch = new NextRequest("http://localhost:3000/api/admin/plans", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": "OWNER",
        "x-user-id": "owner-1",
      },
      body: JSON.stringify({
        tier: "GOLD",
        monthlyFee: 6200,
      }),
    });
    const resAdminPlanPatch = await patchAdminPlansHandler(reqAdminPlanPatch);
    assert(resAdminPlanPatch.status === 200, "PATCH /api/admin/plans returns 200");
    const adminPatchData = await resAdminPlanPatch.json();
    assert(adminPatchData.plan.monthlyFee === 6200, "/api/admin/plans updated monthly fee to 6200");
  } finally {
    // Always restore Gold plan settings cleanly to seeded defaults
    await prisma.membershipPlan.update({
      where: { tier: PlanTier.GOLD },
      data: {
        name: "Gold All-Access",
        monthlyFee: 6000,
        courtDiscountPercent: 100,
        shopDiscountPercent: 20,
        barDiscountPercent: 20,
        maxDailyBookings: 2,
        color: "amber",
        perks: [
          "100% Free Court Bookings",
          "20% Discount at Pro Gear Shop",
          "20% Discount at Bar & Cafeteria",
          "2 Daily Court Booking Limit",
          "Priority Social Play Access",
          "Free Locker & Towel Service",
        ],
      },
    }).catch(() => {});
    console.log("  ✓ Reset: Restored original Gold plan properties in database");
  }

  // ==========================================
  // [3] Membership Renewal API Tests
  // ==========================================
  console.log("\n[3] Testing Membership Renewal & Tier Switching (/api/members/[id])...");

  // Create a dedicated temporary test member
  const testMemberNumber = `TEST-${Date.now().toString().slice(-5)}`;
  const initialExpiry = new Date();
  initialExpiry.setDate(initialExpiry.getDate() + 3); // expiring in 3 days

  let testMember: any = null;
  let preCreatedTxn: any = null;
  let expiredTestMember: any = null;

  try {
    testMember = await prisma.member.create({
      data: {
        memberNumber: testMemberNumber,
        name: "Integration Test Athlete",
        email: `test.athlete.${Date.now()}@champions.club`,
        phone: "+91 99999 88888",
        planTier: PlanTier.SILVER,
        startDate: new Date(),
        expiryDate: initialExpiry,
        status: MemberStatus.EXPIRING_SOON,
        notes: "Created for renewal integration tests",
      },
      include: { plan: true },
    });
  assert(testMember !== null, `Created test member with ID ${testMember.id} and initial tier SILVER`);

  // RBAC: Member role cannot renew memberships
  const reqMemberRenew = new NextRequest(`http://localhost:3000/api/members/${testMember.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "MEMBER",
      "x-user-id": "mem-1",
    },
    body: JSON.stringify({ action: "RENEW", durationMonths: 1 }),
  });
  const resMemberRenew = await patchMemberHandler(reqMemberRenew, { params: { id: testMember.id } });
  assert(resMemberRenew.status === 403, "MEMBER role blocked (403) from renewing member");

  // Validation: Invalid duration (0)
  const reqInvalidDuration = new NextRequest(`http://localhost:3000/api/members/${testMember.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "FRONT_DESK",
      "x-user-id": "fd-1",
    },
    body: JSON.stringify({ action: "RENEW", durationMonths: 0 }),
  });
  const resInvalidDuration = await patchMemberHandler(reqInvalidDuration, { params: { id: testMember.id } });
  assert(resInvalidDuration.status === 400, "Duration 0 returns 400 Bad Request");

  // Validation: Invalid Tier ("PLATINUM")
  const reqInvalidTier = new NextRequest(`http://localhost:3000/api/members/${testMember.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "FRONT_DESK",
      "x-user-id": "fd-1",
    },
    body: JSON.stringify({ action: "RENEW", planTier: "PLATINUM", durationMonths: 3 }),
  });
  const resInvalidTier = await patchMemberHandler(reqInvalidTier, { params: { id: testMember.id } });
  assert(resInvalidTier.status === 400, "Invalid planTier returns 400 Bad Request");

  // Test Renewal maintaining current tier with standard duration (3 months)
  const silverPlan = await prisma.membershipPlan.findUnique({ where: { tier: PlanTier.SILVER } });
  const expectedSilver3MoFee = (silverPlan?.monthlyFee || 3500) * 3;

  const reqRenewCurrentTier = new NextRequest(`http://localhost:3000/api/members/${testMember.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "FRONT_DESK",
      "x-user-id": "fd-1",
    },
    body: JSON.stringify({
      action: "RENEW",
      durationMonths: 3,
      paymentMethod: PaymentMethod.UPI,
    }),
  });

  const resRenewCurrentTier = await patchMemberHandler(reqRenewCurrentTier, { params: { id: testMember.id } });
  assert(resRenewCurrentTier.status === 200, "Front Desk renewal maintaining tier returns 200");
  const renewCurrentData = await resRenewCurrentTier.json();
  assert(renewCurrentData.success === true, "Renewal response success = true");
  assert(renewCurrentData.member.planTier === "SILVER", "Member retains SILVER tier");
  assert(renewCurrentData.member.status === "ACTIVE", "Member status set to ACTIVE");
  assert(renewCurrentData.transaction !== null, "Transaction ledger entry returned");
  assert(renewCurrentData.transaction.type === TransactionType.MEMBERSHIP_FEE, "Transaction type is MEMBERSHIP_FEE");
  assert(renewCurrentData.transaction.category === TransactionCategory.MEMBERSHIP, "Transaction category is MEMBERSHIP");
  assert(renewCurrentData.transaction.amount === expectedSilver3MoFee, `Transaction amount matches 3 months fee (₹${expectedSilver3MoFee})`);
  assert(renewCurrentData.transaction.paymentMethod === PaymentMethod.UPI, "Transaction payment method is UPI");

  // Verify DB state for current tier renewal
  const dbMemberAfter3Mo = await prisma.member.findUnique({ where: { id: testMember.id } });
  const expectedDate3Mo = addMonths(initialExpiry, 3);
  const diffDays = Math.abs(
    (new Date(dbMemberAfter3Mo!.expiryDate).getTime() - expectedDate3Mo.getTime()) / (1000 * 60 * 60 * 24)
  );
  assert(diffDays < 2, "Member expiryDate correctly extended by 3 months in database");

  // Test Renewal with CUSTOM duration (e.g., 5 months)
  const expectedSilver5MoFee = (silverPlan?.monthlyFee || 3500) * 5;
  const expiryBefore5Mo = new Date(dbMemberAfter3Mo!.expiryDate);

  const reqRenewCustomDuration = new NextRequest(`http://localhost:3000/api/members/${testMember.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "FRONT_DESK",
      "x-user-id": "fd-1",
    },
    body: JSON.stringify({
      action: "RENEW",
      durationMonths: 5,
      paymentMethod: PaymentMethod.CASH,
    }),
  });

  const resRenewCustomDuration = await patchMemberHandler(reqRenewCustomDuration, { params: { id: testMember.id } });
  assert(resRenewCustomDuration.status === 200, "Renewal with custom duration (5 months) returns 200");
  const renewCustomData = await resRenewCustomDuration.json();
  assert(renewCustomData.transaction.amount === expectedSilver5MoFee, `Transaction ledger amount correctly reflects 5 months (₹${expectedSilver5MoFee})`);
  assert(renewCustomData.transaction.paymentMethod === PaymentMethod.CASH, "Transaction recorded with CASH payment method");

  const dbMemberAfter5Mo = await prisma.member.findUnique({ where: { id: testMember.id } });
  const expectedDate5Mo = addMonths(expiryBefore5Mo, 5);
  const diffDays5Mo = Math.abs(
    (new Date(dbMemberAfter5Mo!.expiryDate).getTime() - expectedDate5Mo.getTime()) / (1000 * 60 * 60 * 24)
  );
  assert(diffDays5Mo < 2, "Expiry extended by additional 5 months for custom duration");

  // Test Renewal with TIER SWITCH (e.g. SILVER -> GOLD for 6 months)
  const goldPlan = await prisma.membershipPlan.findUnique({ where: { tier: PlanTier.GOLD } });
  const expectedGold6MoFee = (goldPlan?.monthlyFee || 6000) * 6;
  const expiryBeforeTierSwitch = new Date(dbMemberAfter5Mo!.expiryDate);

  const reqTierSwitchRenew = new NextRequest(`http://localhost:3000/api/members/${testMember.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "FRONT_DESK",
      "x-user-id": "fd-1",
    },
    body: JSON.stringify({
      action: "RENEW",
      planTier: "GOLD",
      durationMonths: 6,
      paymentMethod: PaymentMethod.CARD,
    }),
  });

  const resTierSwitchRenew = await patchMemberHandler(reqTierSwitchRenew, { params: { id: testMember.id } });
  assert(resTierSwitchRenew.status === 200, "Tier switch renewal returns HTTP 200");
  const tierSwitchData = await resTierSwitchRenew.json();
  assert(tierSwitchData.member.planTier === "GOLD", "Member tier successfully switched to GOLD in response");
  assert(tierSwitchData.transaction.amount === expectedGold6MoFee, `Transaction ledger calculated at new Gold rate (₹${expectedGold6MoFee})`);
  assert(tierSwitchData.transaction.paymentMethod === PaymentMethod.CARD, "Transaction recorded with CARD payment method");
  assert(tierSwitchData.transaction.notes.includes("Tier Switch"), "Transaction notes document tier switch");

  // Verify DB state after Tier Switch
  const dbMemberAfterTierSwitch = await prisma.member.findUnique({
    where: { id: testMember.id },
    include: { plan: true },
  });
  assert(dbMemberAfterTierSwitch?.planTier === PlanTier.GOLD, "Database reflects new planTier = GOLD");
  assert(dbMemberAfterTierSwitch?.plan.name === goldPlan?.name, "Member is now bound to Gold All-Access plan in database");

  // Test linking with an existing transactionId (simulating POS checkout modal link)
  preCreatedTxn = await prisma.transaction.create({
    data: {
      referenceNo: `POS-TEST-${Date.now()}`,
      type: TransactionType.MEMBERSHIP_FEE,
      category: TransactionCategory.MEMBERSHIP,
      amount: 6000,
      paymentMethod: PaymentMethod.UPI,
      notes: "POS Terminal Pre-Settlement",
    },
  });

  const reqLinkTxn = new NextRequest(`http://localhost:3000/api/members/${testMember.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "FRONT_DESK",
      "x-user-id": "fd-1",
    },
    body: JSON.stringify({
      action: "RENEW",
      planTier: "GOLD",
      durationMonths: 1,
      transactionId: preCreatedTxn.id,
    }),
  });

  const resLinkTxn = await patchMemberHandler(reqLinkTxn, { params: { id: testMember.id } });
  assert(resLinkTxn.status === 200, "Renewal with existing transactionId returns 200");
  const linkTxnData = await resLinkTxn.json();
  assert(linkTxnData.transaction.id === preCreatedTxn.id, "Existing transaction correctly linked without creating duplicate");

  // Test Tier DOWNGRADE (GOLD -> JUNIOR for custom 7 months)
  const juniorPlan = await prisma.membershipPlan.findUnique({ where: { tier: PlanTier.JUNIOR } });
  const expectedJunior7MoFee = (juniorPlan?.monthlyFee || 2200) * 7;

  const reqDowngradeRenew = new NextRequest(`http://localhost:3000/api/members/${testMember.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "FRONT_DESK",
      "x-user-id": "fd-1",
    },
    body: JSON.stringify({
      action: "RENEW",
      planTier: "JUNIOR",
      durationMonths: 7,
      paymentMethod: PaymentMethod.UPI,
    }),
  });

  const resDowngradeRenew = await patchMemberHandler(reqDowngradeRenew, { params: { id: testMember.id } });
  assert(resDowngradeRenew.status === 200, "Tier downgrade renewal (GOLD -> JUNIOR for 7 months) returns 200");
  const downgradeData = await resDowngradeRenew.json();
  assert(downgradeData.member.planTier === "JUNIOR", "Member tier downgraded to JUNIOR in response");
  assert(downgradeData.transaction.amount === expectedJunior7MoFee, `Transaction amount reflects Junior 7 mo rate (₹${expectedJunior7MoFee})`);
  assert(downgradeData.transaction.notes.includes("Tier Switch"), "Transaction notes document downgrade tier switch");

  const dbMemberAfterDowngrade = await prisma.member.findUnique({ where: { id: testMember.id } });
  assert(dbMemberAfterDowngrade?.planTier === PlanTier.JUNIOR, "Database reflects downgraded planTier = JUNIOR");

  // Test Decimal Duration clamping during renewal (e.g. 2.7 months clamped to 2 months)
  const expectedJunior2MoFee = (juniorPlan?.monthlyFee || 2200) * 2;
  const reqDecimalRenew = new NextRequest(`http://localhost:3000/api/members/${testMember.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "FRONT_DESK",
      "x-user-id": "fd-1",
    },
    body: JSON.stringify({
      action: "RENEW",
      planTier: "JUNIOR",
      durationMonths: 2.7,
      paymentMethod: PaymentMethod.CASH,
    }),
  });
  const resDecimalRenew = await patchMemberHandler(reqDecimalRenew, { params: { id: testMember.id } });
  assert(resDecimalRenew.status === 200, "Renewal with float duration 2.7 returns 200");
  const decimalRenewData = await resDecimalRenew.json();
  assert(decimalRenewData.transaction.amount === expectedJunior2MoFee, `Decimal duration 2.7 clamped to 2 months fee (₹${expectedJunior2MoFee})`);

  // Verify all transactions created for testMember exist in ledger
  const memberTransactions = await prisma.transaction.findMany({
    where: { memberId: testMember.id },
  });
  assert(memberTransactions.length >= 6, `All renewal transactions properly recorded in ledger (${memberTransactions.length} entries)`);

  // Test Renewing an EXPIRED Member (expiry date 90 days in the deep past)
  console.log("\n[4] Testing Renewal for an Expired Member (Deep Past Expiry)...");
  const pastExpiry = new Date();
  pastExpiry.setDate(pastExpiry.getDate() - 90); // expired 90 days ago

  expiredTestMember = await prisma.member.create({
    data: {
      memberNumber: `EXP-${Date.now().toString().slice(-5)}`,
      name: "Expired Veteran Member",
      email: `expired.veteran.${Date.now()}@champions.club`,
      phone: "+91 98888 77777",
      planTier: PlanTier.SILVER,
      startDate: new Date(Date.now() - 365 * 24 * 3600 * 1000),
      expiryDate: pastExpiry,
      status: MemberStatus.EXPIRED,
      notes: "Testing expired renewal baseDate calculation",
    },
    include: { plan: true },
  });
  assert(expiredTestMember.status === MemberStatus.EXPIRED, "Created member with EXPIRED status and past expiryDate");

  const reqRenewExpired = new NextRequest(`http://localhost:3000/api/members/${expiredTestMember.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": "FRONT_DESK",
      "x-user-id": "fd-1",
    },
    body: JSON.stringify({
      action: "RENEW",
      planTier: "SILVER",
      durationMonths: 3,
      paymentMethod: PaymentMethod.UPI,
    }),
  });

  const resRenewExpired = await patchMemberHandler(reqRenewExpired, { params: { id: expiredTestMember.id } });
  assert(resRenewExpired.status === 200, "Renewing expired member returns 200");
  const renewExpiredData = await resRenewExpired.json();
  assert(renewExpiredData.member.status === MemberStatus.ACTIVE, "Expired member status updated to ACTIVE");

  const dbExpiredMemberAfter = await prisma.member.findUnique({ where: { id: expiredTestMember.id } });
  const expectedFutureExpiry = addMonths(new Date(), 3);
  const diffDaysFromNow = Math.abs(
    (new Date(dbExpiredMemberAfter!.expiryDate).getTime() - expectedFutureExpiry.getTime()) / (1000 * 60 * 60 * 24)
  );
  assert(
    diffDaysFromNow < 2,
    "Expired member expiryDate extended from TODAY (now + 3 months), NOT from 90 days in past"
  );
  assert(dbExpiredMemberAfter?.status === MemberStatus.ACTIVE, "Database reflects status = ACTIVE after expired renewal");
} finally {
  // Guaranteed cleanup of isolated test fixtures
  if (testMember?.id && typeof testMember.id === "string") {
    await prisma.transaction.deleteMany({ where: { memberId: testMember.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { memberId: testMember.id } }).catch(() => {});
    await prisma.member.delete({ where: { id: testMember.id } }).catch(() => {});
  }
  if (preCreatedTxn?.id && typeof preCreatedTxn.id === "string") {
    await prisma.transaction.deleteMany({ where: { id: preCreatedTxn.id } }).catch(() => {});
  }
  if (expiredTestMember?.id && typeof expiredTestMember.id === "string") {
    await prisma.transaction.deleteMany({ where: { memberId: expiredTestMember.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { memberId: expiredTestMember.id } }).catch(() => {});
    await prisma.member.delete({ where: { id: expiredTestMember.id } }).catch(() => {});
  }
  console.log("  ✓ Cleanup: Test members and test transactions cleaned up safely");
}

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
