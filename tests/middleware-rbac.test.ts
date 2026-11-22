import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/auth-token";

async function runMiddlewareTests() {
  console.log("=== STARTING MIDDLEWARE & RBAC TEST SUITE ===");
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

  // Generate tokens for various roles
  const ownerToken = await signSessionToken({
    sessionToken: "owner-token-123",
    userId: "user-owner",
    role: "OWNER",
    exp: Date.now() + 60000,
  });

  const memberToken = await signSessionToken({
    sessionToken: "member-token-123",
    userId: "user-member",
    role: "MEMBER",
    exp: Date.now() + 60000,
  });

  const frontDeskToken = await signSessionToken({
    sessionToken: "frontdesk-token-123",
    userId: "user-frontdesk",
    role: "FRONT_DESK",
    exp: Date.now() + 60000,
  });

  const proShopToken = await signSessionToken({
    sessionToken: "proshop-token-123",
    userId: "user-proshop",
    role: "PRO_SHOP",
    exp: Date.now() + 60000,
  });

  const barStaffToken = await signSessionToken({
    sessionToken: "barstaff-token-123",
    userId: "user-barstaff",
    role: "BAR_STAFF",
    exp: Date.now() + 60000,
  });

  // Test 1: Unauthenticated visit to root "/"
  console.log("\n[1] Testing unauthenticated redirects...");
  const reqUnauthHome = new NextRequest("http://localhost:3000/");
  const resUnauthHome = await middleware(reqUnauthHome);
  assert(resUnauthHome.status === 307 || resUnauthHome.status === 308 || resUnauthHome.status === 302, "Unauthenticated / redirects");
  const redirectLoc = resUnauthHome.headers.get("location");
  assert(redirectLoc?.includes("/login?callbackUrl="), "Redirect includes callbackUrl to login");

  // Test 2: Access to "/login" (authenticated and unauthenticated)
  console.log("\n[2] Testing access to /login...");
  const reqUnauthLogin = new NextRequest("http://localhost:3000/login");
  const resUnauthLogin = await middleware(reqUnauthLogin);
  assert(resUnauthLogin.status === 200, "Unauthenticated user allowed to access /login (HTTP 200)");

  const reqUnauthLoginTrailing = new NextRequest("http://localhost:3000/login/");
  const resUnauthLoginTrailing = await middleware(reqUnauthLoginTrailing);
  assert(resUnauthLoginTrailing.status === 200, "Unauthenticated user allowed to access /login/ with trailing slash (HTTP 200)");

  const reqAuthLogin = new NextRequest("http://localhost:3000/login", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  });
  const resAuthLogin = await middleware(reqAuthLogin);
  assert(resAuthLogin.status === 200, "Authenticated OWNER allowed to access /login without redirect (HTTP 200)");

  const reqAuthLoginMember = new NextRequest("http://localhost:3000/login", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resAuthLoginMember = await middleware(reqAuthLoginMember);
  assert(resAuthLoginMember.status === 200, "Authenticated MEMBER allowed to access /login without redirect (HTTP 200)");

  const reqAuthLoginTrailing = new NextRequest("http://localhost:3000/login/", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  });
  const resAuthLoginTrailing = await middleware(reqAuthLoginTrailing);
  assert(resAuthLoginTrailing.status === 200, "Authenticated user allowed to access /login/ with trailing slash (HTTP 200)");

  // Test 3: Authenticated visit to "/login?callbackUrl=/custom"
  const reqAuthLoginCallback = new NextRequest("http://localhost:3000/login?callbackUrl=/custom", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  });
  const resAuthLoginCallback = await middleware(reqAuthLoginCallback);
  assert(resAuthLoginCallback.status === 200, "Authenticated user with callbackUrl allowed to access /login without redirect (HTTP 200)");

  // Test 4: Unauthenticated API request
  console.log("\n[3] Testing unauthenticated API access...");
  const reqUnauthApi = new NextRequest("http://localhost:3000/api/finance/analytics");
  const resUnauthApi = await middleware(reqUnauthApi);
  assert(resUnauthApi.status === 401, "Unauthenticated API request receives 401 Unauthorized");

  // Test 5: Granular RBAC - Finance API
  console.log("\n[4] Testing RBAC on Finance API (/api/finance)...");
  const reqMemberFinance = new NextRequest("http://localhost:3000/api/finance/analytics", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resMemberFinance = await middleware(reqMemberFinance);
  assert(resMemberFinance.status === 403, "MEMBER role blocked (403) from /api/finance");

  const reqOwnerFinance = new NextRequest("http://localhost:3000/api/finance/analytics", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  });
  const resOwnerFinance = await middleware(reqOwnerFinance);
  assert(resOwnerFinance.status === 200, "OWNER role granted access (status 200/next) to /api/finance");

  // Test 6: Granular RBAC - Leads API
  console.log("\n[5] Testing RBAC on CRM Leads API (/api/leads)...");
  const reqMemberLeads = new NextRequest("http://localhost:3000/api/leads", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resMemberLeads = await middleware(reqMemberLeads);
  assert(resMemberLeads.status === 403, "MEMBER role blocked (403) from /api/leads");

  const reqFrontDeskLeads = new NextRequest("http://localhost:3000/api/leads", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${frontDeskToken}` },
  });
  const resFrontDeskLeads = await middleware(reqFrontDeskLeads);
  assert(resFrontDeskLeads.status === 200, "FRONT_DESK role allowed on /api/leads");

  // Test 7: Granular RBAC - Pro Shop Product Mutation
  console.log("\n[6] Testing RBAC on Pro Shop Mutations (/api/shop/products)...");
  const reqMemberShopMod = new NextRequest("http://localhost:3000/api/shop/products", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resMemberShopMod = await middleware(reqMemberShopMod);
  assert(resMemberShopMod.status === 403, "MEMBER role blocked from mutating products");

  const reqProShopShopMod = new NextRequest("http://localhost:3000/api/shop/products", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${proShopToken}` },
  });
  const resProShopShopMod = await middleware(reqProShopShopMod);
  assert(resProShopShopMod.status === 200, "PRO_SHOP role allowed to mutate products");

  // Test 8: Granular RBAC - Bar Tabs Mutation
  console.log("\n[7] Testing RBAC on Bar Tabs Mutation (/api/bar/tabs)...");
  const reqFrontDeskBarMod = new NextRequest("http://localhost:3000/api/bar/tabs", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${frontDeskToken}` },
  });
  const resFrontDeskBarMod = await middleware(reqFrontDeskBarMod);
  assert(resFrontDeskBarMod.status === 403, "FRONT_DESK blocked from bar tab modifications");

  const reqBarStaffBarMod = new NextRequest("http://localhost:3000/api/bar/tabs", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${barStaffToken}` },
  });
  const resBarStaffBarMod = await middleware(reqBarStaffBarMod);
  assert(resBarStaffBarMod.status === 200, "BAR_STAFF allowed to modify bar tabs");

  // Test 9: Granular RBAC - Membership Plans Configuration (/api/plans & /api/admin/plans)
  console.log("\n[8] Testing RBAC on Membership Plans Mutation (/api/plans & /api/admin/plans)...");
  const reqMemberPlanMod = new NextRequest("http://localhost:3000/api/plans", {
    method: "PUT",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resMemberPlanMod = await middleware(reqMemberPlanMod);
  assert(resMemberPlanMod.status === 403, "MEMBER role blocked from mutating plans");

  const reqFrontDeskPlanMod = new NextRequest("http://localhost:3000/api/plans", {
    method: "PUT",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${frontDeskToken}` },
  });
  const resFrontDeskPlanMod = await middleware(reqFrontDeskPlanMod);
  assert(resFrontDeskPlanMod.status === 403, "FRONT_DESK role blocked from mutating plans");

  const reqOwnerPlanMod = new NextRequest("http://localhost:3000/api/plans", {
    method: "PUT",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  });
  const resOwnerPlanMod = await middleware(reqOwnerPlanMod);
  assert(resOwnerPlanMod.status === 200, "OWNER role allowed to mutate plans");

  const reqFrontDeskGetPlans = new NextRequest("http://localhost:3000/api/plans", {
    method: "GET",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${frontDeskToken}` },
  });
  const resFrontDeskGetPlans = await middleware(reqFrontDeskGetPlans);
  assert(resFrontDeskGetPlans.status === 200, "FRONT_DESK role allowed to read plans via GET /api/plans");

  const reqMemberAdminPlanGet = new NextRequest("http://localhost:3000/api/admin/plans", {
    method: "GET",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resMemberAdminPlanGet = await middleware(reqMemberAdminPlanGet);
  assert(resMemberAdminPlanGet.status === 403, "MEMBER role blocked from GET /api/admin/plans");

  const reqFrontDeskAdminPlanGet = new NextRequest("http://localhost:3000/api/admin/plans", {
    method: "GET",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${frontDeskToken}` },
  });
  const resFrontDeskAdminPlanGet = await middleware(reqFrontDeskAdminPlanGet);
  assert(resFrontDeskAdminPlanGet.status === 403, "FRONT_DESK role blocked from GET /api/admin/plans");

  const reqMemberAdminPlanMod = new NextRequest("http://localhost:3000/api/admin/plans", {
    method: "PATCH",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resMemberAdminPlanMod = await middleware(reqMemberAdminPlanMod);
  assert(resMemberAdminPlanMod.status === 403, "MEMBER role blocked from /api/admin/plans mutations");

  const reqOwnerAdminPlanMod = new NextRequest("http://localhost:3000/api/admin/plans", {
    method: "PATCH",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  });
  const resOwnerAdminPlanMod = await middleware(reqOwnerAdminPlanMod);
  assert(resOwnerAdminPlanMod.status === 200, "OWNER role allowed on /api/admin/plans mutations");

  const reqOwnerAdminPlanGet = new NextRequest("http://localhost:3000/api/admin/plans", {
    method: "GET",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  });
  const resOwnerAdminPlanGet = await middleware(reqOwnerAdminPlanGet);
  assert(resOwnerAdminPlanGet.status === 200, "OWNER role allowed on GET /api/admin/plans");

  // Test 10: Granular RBAC - Member Renewals (/api/members/[id])
  console.log("\n[9] Testing RBAC on Member Renewals (/api/members/[id])...");
  const reqMemberRenewMod = new NextRequest("http://localhost:3000/api/members/123", {
    method: "PATCH",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resMemberRenewMod = await middleware(reqMemberRenewMod);
  assert(resMemberRenewMod.status === 403, "MEMBER role blocked from renewing members");

  const reqFrontDeskRenewMod = new NextRequest("http://localhost:3000/api/members/123", {
    method: "PATCH",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${frontDeskToken}` },
  });
  const resFrontDeskRenewMod = await middleware(reqFrontDeskRenewMod);
  assert(resFrontDeskRenewMod.status === 200, "FRONT_DESK allowed to renew members");

  const reqOwnerRenewMod = new NextRequest("http://localhost:3000/api/members/123", {
    method: "PATCH",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  });
  const resOwnerRenewMod = await middleware(reqOwnerRenewMod);
  assert(resOwnerRenewMod.status === 200, "OWNER allowed to renew members");

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runMiddlewareTests().catch((err) => {
  console.error("Middleware test failed:", err);
  process.exit(1);
});
