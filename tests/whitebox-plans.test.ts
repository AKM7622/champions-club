import { NextRequest } from "next/server";
import { getPlans, updatePlan, verifyOwnerAccess } from "../src/lib/plan-service";
import {
  GET as getPlansRoute,
  PUT as putPlansRoute,
  PATCH as patchPlansRoute,
  POST as postPlansRoute,
} from "../src/app/api/plans/route";
import {
  GET as getAdminPlansRoute,
  PUT as putAdminPlansRoute,
  PATCH as patchAdminPlansRoute,
  POST as postAdminPlansRoute,
} from "../src/app/api/admin/plans/route";
import { prisma } from "../src/lib/db";
import { SESSION_COOKIE_NAME, signSessionToken } from "../src/lib/auth-token";
import { PlanTier } from "@prisma/client";

async function runPlansWhitebox() {
  console.log("=== STARTING PLANS & PLAN SERVICE WHITE-BOX TEST SUITE ===");
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

  // Create isolated OWNER user & MEMBER user
  const ownerEmail = `wb.plans.owner.${Date.now()}@champions.club`;
  const memberEmail = `wb.plans.member.${Date.now()}@champions.club`;
  const testOwner = await prisma.user.create({
    data: { email: ownerEmail, name: "Plan Owner", password: "hash", role: "OWNER" },
  });
  const testMember = await prisma.user.create({
    data: { email: memberEmail, name: "Plan Member", password: "hash", role: "MEMBER" },
  });

  const ownerRawToken = `raw-own-${Date.now()}`;
  await prisma.session.create({
    data: { sessionToken: ownerRawToken, userId: testOwner.id, expiresAt: new Date(Date.now() + 3600000) },
  });
  const ownerToken = await signSessionToken({
    sessionToken: ownerRawToken,
    userId: testOwner.id,
    role: "OWNER",
    exp: Date.now() + 3600000,
  });

  const memberRawToken = `raw-mem-${Date.now()}`;
  await prisma.session.create({
    data: { sessionToken: memberRawToken, userId: testMember.id, expiresAt: new Date(Date.now() + 3600000) },
  });
  const memberToken = await signSessionToken({
    sessionToken: memberRawToken,
    userId: testMember.id,
    role: "MEMBER",
    exp: Date.now() + 3600000,
  });

  try {
    // ==========================================
    // 1. verifyOwnerAccess Unit Tests
    // ==========================================
    console.log("\n[1] Testing verifyOwnerAccess...");
    // Header role != OWNER (lines 14-16)
    const reqHeaderMember = new NextRequest("http://localhost:3000/api/plans", {
      headers: { "x-user-role": "MEMBER", "x-user-id": testMember.id },
    });
    const authHeaderMember = await verifyOwnerAccess(reqHeaderMember);
    assert(!authHeaderMember.authorized && authHeaderMember.status === 403, "Header MEMBER role rejected with 403");

    // Header role === OWNER (lines 12-14)
    const reqHeaderOwner = new NextRequest("http://localhost:3000/api/plans", {
      headers: { "x-user-role": "OWNER", "x-user-id": testOwner.id },
    });
    const authHeaderOwner = await verifyOwnerAccess(reqHeaderOwner);
    assert(authHeaderOwner.authorized === true, "Header OWNER role authorized");

    // No cookie token (lines 20-22)
    const reqNoCookie = new NextRequest("http://localhost:3000/api/plans");
    const authNoCookie = await verifyOwnerAccess(reqNoCookie);
    assert(!authNoCookie.authorized && authNoCookie.status === 401, "No cookie rejected with 401");

    // Cookie token with orphan user (lines 25-27)
    const orphanToken = await signSessionToken({
      sessionToken: "orphan",
      userId: "no-user",
      role: "OWNER",
      exp: Date.now() + 3600000,
    });
    const reqOrphan = new NextRequest("http://localhost:3000/api/plans", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${orphanToken}` },
    });
    const authOrphan = await verifyOwnerAccess(reqOrphan);
    assert(!authOrphan.authorized && authOrphan.status === 401, "Orphan session rejected with 401");

    // Cookie token with non-OWNER user (lines 29-31)
    const reqCookieMember = new NextRequest("http://localhost:3000/api/plans", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
    });
    const authCookieMember = await verifyOwnerAccess(reqCookieMember);
    assert(!authCookieMember.authorized && authCookieMember.status === 403, "Cookie MEMBER role rejected with 403");

    // Cookie token with valid OWNER user (lines 33)
    const reqCookieOwner = new NextRequest("http://localhost:3000/api/plans", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
    });
    const authCookieOwner = await verifyOwnerAccess(reqCookieOwner);
    assert(authCookieOwner.authorized === true, "Cookie OWNER role authorized");

    // ==========================================
    // 2. getPlans Unit Tests
    // ==========================================
    console.log("\n[2] Testing getPlans...");
    // Invalid tier filter (lines 41-45)
    const reqInvalidTier = new NextRequest("http://localhost:3000/api/plans?tier=PLATINUM");
    const resInvalidTier = await getPlans(reqInvalidTier);
    assert(resInvalidTier.status === 400, "Invalid tier filter returns 400");

    // Valid tier filter
    const reqValidTier = new NextRequest("http://localhost:3000/api/plans?tier=GOLD");
    const resValidTier = await getPlans(reqValidTier);
    assert(resValidTier.status === 200, "Valid tier filter returns 200");

    // No tier filter (all plans)
    const reqAllPlans = new NextRequest("http://localhost:3000/api/plans");
    const resAllPlans = await getPlans(reqAllPlans);
    assert(resAllPlans.status === 200, "No tier filter returns 200");

    // Catch block (lines 64-66)
    const origFindMany = prisma.membershipPlan.findMany;
    (prisma.membershipPlan as any).findMany = async () => {
      throw new Error("Simulated plans db failure");
    };
    const resGetCatch = await getPlans(reqAllPlans);
    prisma.membershipPlan.findMany = origFindMany;
    assert(resGetCatch.status === 500, "getPlans db failure triggers catch block returning 500");

    // ==========================================
    // 3. updatePlan Unit Tests & Validations
    // ==========================================
    console.log("\n[3] Testing updatePlan validations...");
    // 3.1 Unauth (lines 72-74)
    const resUnauth = await updatePlan(new NextRequest("http://localhost:3000/api/plans", { method: "PUT" }));
    assert(resUnauth.status === 401, "updatePlan without auth returns 401");

    // Helper for owner requests
    function makeOwnerReq(body: any) {
      return new NextRequest("http://localhost:3000/api/plans", {
        method: "PUT",
        headers: { "x-user-role": "OWNER", "x-user-id": testOwner.id },
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
    }

    // 3.2 Neither id nor tier (lines 91-95)
    const resNeither = await updatePlan(makeOwnerReq({ name: "Updated" }));
    assert(resNeither.status === 400, "updatePlan without id or tier returns 400");

    // 3.3 Invalid id type (lines 98-103)
    const resBadId = await updatePlan(makeOwnerReq({ id: "   ", name: "Updated" }));
    assert(resBadId.status === 400, "updatePlan with whitespace id returns 400");

    // 3.4 Invalid tier value (lines 105-110)
    const resBadTier = await updatePlan(makeOwnerReq({ tier: "DIAMOND", name: "Updated" }));
    assert(resBadTier.status === 400, "updatePlan with invalid tier returns 400");

    // 3.5 Plan not found (lines 117-122)
    const resNotFound = await updatePlan(makeOwnerReq({ id: "non-existent-plan-id", name: "Updated" }));
    assert(resNotFound.status === 404, "updatePlan non-existent plan returns 404");

    // 3.6 Empty name (lines 128-130)
    const resEmptyName = await updatePlan(makeOwnerReq({ tier: "GOLD", name: "  " }));
    assert(resEmptyName.status === 400, "updatePlan with empty name returns 400");

    // 3.7 Invalid monthlyFee (lines 135-141)
    const resBadFee = await updatePlan(makeOwnerReq({ tier: "GOLD", monthlyFee: -100 }));
    assert(resBadFee.status === 400, "updatePlan with negative monthlyFee returns 400");

    // 3.8 Invalid courtDiscountPercent (lines 146-152)
    const resBadCourt = await updatePlan(makeOwnerReq({ tier: "GOLD", courtDiscountPercent: 150 }));
    assert(resBadCourt.status === 400, "updatePlan with >100% court discount returns 400");

    // 3.9 Invalid shopDiscountPercent (lines 157-163)
    const resBadShop = await updatePlan(makeOwnerReq({ tier: "GOLD", shopDiscountPercent: -5 }));
    assert(resBadShop.status === 400, "updatePlan with negative shop discount returns 400");

    // 3.10 Invalid barDiscountPercent (lines 168-174)
    const resBadBar = await updatePlan(makeOwnerReq({ tier: "GOLD", barDiscountPercent: "invalid" }));
    assert(resBadBar.status === 400, "updatePlan with non-number bar discount returns 400");

    // 3.11 Invalid maxDailyBookings (lines 179-185)
    const resBadBookings = await updatePlan(makeOwnerReq({ tier: "GOLD", maxDailyBookings: 0 }));
    assert(resBadBookings.status === 400, "updatePlan with maxDailyBookings < 1 returns 400");

    // 3.12 Perks as string & color & description fallback (lines 193-198, 202-204, 207-209)
    // Find existing plan ID
    const goldPlan = await prisma.membershipPlan.findUnique({ where: { tier: PlanTier.GOLD } });
    if (goldPlan) {
      const resStringPerks = await updatePlan(
        makeOwnerReq({
          id: goldPlan.id,
          description: "Gold Championship Package",
          perks: "Court Access, Spa Lounge, Towel Service",
          color: "#f59e0b",
        })
      );
      assert(resStringPerks.status === 200, "updatePlan with perks string, color, and description fallback returns 200");

      // Perks as array & explicit name
      const resArrayPerks = await updatePlan(
        makeOwnerReq({
          id: goldPlan.id,
          name: goldPlan.name,
          monthlyFee: goldPlan.monthlyFee,
          courtDiscountPercent: goldPlan.courtDiscountPercent,
          shopDiscountPercent: goldPlan.shopDiscountPercent,
          barDiscountPercent: goldPlan.barDiscountPercent,
          maxDailyBookings: goldPlan.maxDailyBookings,
          perks: ["All-Access Court Privileges", "20% Pro Shop Discount", "20% Bar Discount"],
          color: "#d97706",
        })
      );
      assert(resArrayPerks.status === 200, "updatePlan with perks array restored successfully");
    }

    // 3.13 Catch block in updatePlan (lines 227-232)
    const resUpdateCatch = await updatePlan(makeOwnerReq("malformed-json{"));
    assert(resUpdateCatch.status === 500, "updatePlan malformed json triggers catch block returning 500");

    // ==========================================
    // 4. API Route Handlers (/api/plans and /api/admin/plans)
    // ==========================================
    console.log("\n[4] Testing API route handler wrappers...");
    // /api/plans
    const reqPlansGet = new NextRequest("http://localhost:3000/api/plans");
    assert((await getPlansRoute(reqPlansGet)).status === 200, "GET /api/plans returns 200");

    const reqPlansPut = makeOwnerReq({ tier: "GOLD", name: "Gold Plan" });
    assert((await putPlansRoute(reqPlansPut)).status === 200, "PUT /api/plans returns 200");

    const reqPlansPatch = makeOwnerReq({ tier: "GOLD", name: "Gold Plan" });
    assert((await patchPlansRoute(reqPlansPatch)).status === 200, "PATCH /api/plans returns 200");

    const reqPlansPost = makeOwnerReq({ tier: "GOLD", name: "Gold Plan" });
    assert((await postPlansRoute(reqPlansPost)).status === 200, "POST /api/plans returns 200");

    // /api/admin/plans
    const reqAdminGetUnauth = new NextRequest("http://localhost:3000/api/admin/plans");
    assert((await getAdminPlansRoute(reqAdminGetUnauth)).status === 401, "GET /api/admin/plans unauth returns 401");

    const reqAdminGetAuth = new NextRequest("http://localhost:3000/api/admin/plans", {
      headers: { "x-user-role": "OWNER", "x-user-id": testOwner.id },
    });
    assert((await getAdminPlansRoute(reqAdminGetAuth)).status === 200, "GET /api/admin/plans authorized returns 200");

    const reqAdminPut = makeOwnerReq({ tier: "GOLD", name: "Gold Plan" });
    assert((await putAdminPlansRoute(reqAdminPut)).status === 200, "PUT /api/admin/plans returns 200");

    const reqAdminPatch = makeOwnerReq({ tier: "GOLD", name: "Gold Plan" });
    assert((await patchAdminPlansRoute(reqAdminPatch)).status === 200, "PATCH /api/admin/plans returns 200");

    const reqAdminPost = makeOwnerReq({ tier: "GOLD", name: "Gold Plan" });
    assert((await postAdminPlansRoute(reqAdminPost)).status === 200, "POST /api/admin/plans returns 200");
  } finally {
    // Cleanup
    await prisma.session.deleteMany({ where: { userId: { in: [testOwner.id, testMember.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [testOwner.id, testMember.id] } } }).catch(() => {});
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runPlansWhitebox().catch((err) => {
  console.error("Plans whitebox test failed:", err);
  process.exit(1);
});
