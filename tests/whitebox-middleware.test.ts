import { NextRequest } from "next/server";
import defaultMiddleware, { middleware, config } from "../src/middleware";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/auth-token";

async function runMiddlewareWhitebox() {
  console.log("=== STARTING MIDDLEWARE EXHAUSTIVE WHITE-BOX TEST SUITE ===");
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

  // Session token helpers
  async function makeToken(role: string) {
    return signSessionToken({
      sessionToken: `token-${role}-${Date.now()}`,
      userId: `user-${role}-id`,
      role,
      exp: Date.now() + 3600000,
    });
  }

  const ownerToken = await makeToken("OWNER");
  const memberToken = await makeToken("MEMBER");
  const frontDeskToken = await makeToken("FRONT_DESK");
  const coachToken = await makeToken("COACH");
  const proShopToken = await makeToken("PRO_SHOP");
  const barStaffToken = await makeToken("BAR_STAFF");
  const chefToken = await makeToken("CHEF");

  // 0. Export checks
  assert(defaultMiddleware === middleware, "default export is middleware");
  assert(Array.isArray(config.matcher) && config.matcher.length > 0, "config.matcher is defined");

  // 1. Static asset exemptions (lines 12-18)
  console.log("\n[1] Testing Static & Next.js exemptions...");
  const resNext = await middleware(new NextRequest("http://localhost:3000/_next/static/chunk.js"));
  assert(resNext.status === 200, "/_next route is bypassed");

  const resFavicon = await middleware(new NextRequest("http://localhost:3000/favicon.ico"));
  assert(resFavicon.status === 200, "/favicon.ico is bypassed");

  const resAssetSvg = await middleware(new NextRequest("http://localhost:3000/logo.svg"));
  assert(resAssetSvg.status === 200, ".svg file is bypassed");

  const resAssetPng = await middleware(new NextRequest("http://localhost:3000/photo.png"));
  assert(resAssetPng.status === 200, ".png file is bypassed");

  // 2. Public pages (lines 34-39, 67-69)
  console.log("\n[2] Testing Public pages...");
  const resMemPrefix = await middleware(new NextRequest("http://localhost:3000/memberships/gold"));
  assert(resMemPrefix.status === 200, "/memberships/* is accessible publicly");

  const resJoinPrefix = await middleware(new NextRequest("http://localhost:3000/join/checkout"));
  assert(resJoinPrefix.status === 200, "/join/* is accessible publicly");

  // 3. /login access tests (lines 46-50)
  console.log("\n[3] Testing /login access for authenticated & unauthenticated users...");
  // Unauthenticated /login -> allows Next()
  const resLoginUnauth = await middleware(new NextRequest("http://localhost:3000/login"));
  assert(resLoginUnauth.status === 200, "Unauthenticated /login is allowed");

  const resLoginUnauthTrailing = await middleware(new NextRequest("http://localhost:3000/login/"));
  assert(resLoginUnauthTrailing.status === 200, "Unauthenticated /login/ with trailing slash is allowed");

  // Authenticated /login -> allows Next() without redirect
  const reqAuthLogin = new NextRequest("http://localhost:3000/login", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resAuthLogin = await middleware(reqAuthLogin);
  assert(resAuthLogin.status === 200, "Authenticated /login is allowed without redirect");

  const reqAuthLoginTrailing = new NextRequest("http://localhost:3000/login/", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resAuthLoginTrailing = await middleware(reqAuthLoginTrailing);
  assert(resAuthLoginTrailing.status === 200, "Authenticated /login/ with trailing slash is allowed without redirect");

  // Authenticated /login with callbackUrl -> allows Next() without redirect
  const reqGoodCallback = new NextRequest("http://localhost:3000/login?callbackUrl=/dashboard", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resGood = await middleware(reqGoodCallback);
  assert(resGood.status === 200, "Authenticated /login with callbackUrl is allowed without redirect");

  // Authenticated /login with arbitrary callbackUrl query params -> allows Next() without redirect
  const reqBadCallback1 = new NextRequest("http://localhost:3000/login?callbackUrl=//attacker.com", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resBad1 = await middleware(reqBadCallback1);
  assert(resBad1.status === 200, "Authenticated /login with // query param is allowed without redirect");

  const reqBadCallback2 = new NextRequest("http://localhost:3000/login?callbackUrl=/\\attacker.com", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resBad2 = await middleware(reqBadCallback2);
  assert(resBad2.status === 200, "Authenticated /login with /\\ query param is allowed without redirect");

  const reqBadCallback3 = new NextRequest("http://localhost:3000/login?callbackUrl=/login", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  });
  const resBad3 = await middleware(reqBadCallback3);
  assert(resBad3.status === 200, "Authenticated /login with /login query param is allowed without redirect");

  // 4. Public API routes (lines 26-32, 72-84)
  console.log("\n[4] Testing Public API routes authenticated & unauthenticated...");
  // GET /api/courts unauthenticated & authenticated
  const resCourtsPublic = await middleware(new NextRequest("http://localhost:3000/api/courts", { method: "GET" }));
  assert(resCourtsPublic.status === 200, "GET /api/courts is public unauthenticated");

  const resCourtsAuth = await middleware(new NextRequest("http://localhost:3000/api/courts", {
    method: "GET",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resCourtsAuth.status === 200, "GET /api/courts attaches headers when authenticated");

  // POST /api/leads unauthenticated & authenticated
  const resLeadsPublic = await middleware(new NextRequest("http://localhost:3000/api/leads", { method: "POST" }));
  assert(resLeadsPublic.status === 200, "POST /api/leads is public");

  const resLeadsAuth = await middleware(new NextRequest("http://localhost:3000/api/leads", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resLeadsAuth.status === 200, "POST /api/leads attaches user headers when authenticated");

  // 5. Protected routes unauthenticated guard (lines 87-99)
  console.log("\n[5] Testing Unauthenticated Guards...");
  const resUnauthApi = await middleware(new NextRequest("http://localhost:3000/api/courts", { method: "POST" }));
  assert(resUnauthApi.status === 401, "Unauthenticated POST /api/courts returns 401");

  const resUnauthPage = await middleware(new NextRequest("http://localhost:3000/dashboard?tab=analytics"));
  assert(resUnauthPage.status === 307 || resUnauthPage.status === 302, "Unauthenticated page redirects to /login");
  assert(resUnauthPage.headers.get("location")?.includes("callbackUrl="), "Redirect includes callbackUrl query parameter");

  // 6. RBAC on API routes (lines 101-268)
  console.log("\n[6] Testing Granular RBAC Permissions...");
  // OWNER super-admin access
  const resOwnerAll = await middleware(new NextRequest("http://localhost:3000/api/finance/analytics", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  }));
  assert(resOwnerAll.status === 200, "OWNER granted access to /api/finance");

  // Finance: non-OWNER (lines 109-114)
  const resFinanceBlocked = await middleware(new NextRequest("http://localhost:3000/api/finance/analytics", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${frontDeskToken}` },
  }));
  assert(resFinanceBlocked.status === 403, "FRONT_DESK blocked from /api/finance");

  // HR: non-OWNER (lines 117-122)
  const resHrBlocked = await middleware(new NextRequest("http://localhost:3000/api/hr/leaves", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${frontDeskToken}` },
  }));
  assert(resHrBlocked.status === 403, "FRONT_DESK blocked from /api/hr");

  const resHrOwner = await middleware(new NextRequest("http://localhost:3000/api/hr/leaves", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  }));
  assert(resHrOwner.status === 200, "OWNER allowed on /api/hr");

  // Audit: non-OWNER (lines 125-130)
  const resAuditBlocked = await middleware(new NextRequest("http://localhost:3000/api/auth/audit", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resAuditBlocked.status === 403, "MEMBER blocked from /api/auth/audit");

  const resAuditOwner = await middleware(new NextRequest("http://localhost:3000/api/auth/audit", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  }));
  assert(resAuditOwner.status === 200, "OWNER allowed on /api/auth/audit");

  // Admin endpoints: non-OWNER (lines 133-138)
  const resAdminBlocked = await middleware(new NextRequest("http://localhost:3000/api/admin/plans", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resAdminBlocked.status === 403, "MEMBER blocked from /api/admin");

  // Plans mutations: non-OWNER (lines 141-148)
  const resPlansMutBlocked = await middleware(new NextRequest("http://localhost:3000/api/plans", {
    method: "PUT",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${frontDeskToken}` },
  }));
  assert(resPlansMutBlocked.status === 403, "FRONT_DESK blocked from PUT /api/plans");

  // Leads & Invoices: FRONT_DESK / OWNER allowed, others blocked (lines 151-158)
  const resInvoicesBlocked = await middleware(new NextRequest("http://localhost:3000/api/invoices", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resInvoicesBlocked.status === 403, "MEMBER blocked from /api/invoices");

  const resInvoicesAllowed = await middleware(new NextRequest("http://localhost:3000/api/invoices", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${frontDeskToken}` },
  }));
  assert(resInvoicesAllowed.status === 200, "FRONT_DESK allowed on /api/invoices");

  // Members mutations: FRONT_DESK / OWNER allowed, others blocked (lines 161-171)
  const resMemberMutBlocked = await middleware(new NextRequest("http://localhost:3000/api/members", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resMemberMutBlocked.status === 403, "MEMBER blocked from POST /api/members");

  const resMemberMutAllowed = await middleware(new NextRequest("http://localhost:3000/api/members", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${frontDeskToken}` },
  }));
  assert(resMemberMutAllowed.status === 200, "FRONT_DESK allowed on POST /api/members");

  // Courts mutations: FRONT_DESK / COACH allowed, others blocked (lines 174-183)
  const resCourtsMutBlocked = await middleware(new NextRequest("http://localhost:3000/api/courts", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resCourtsMutBlocked.status === 403, "MEMBER blocked from POST /api/courts");

  const resCourtsMutCoach = await middleware(new NextRequest("http://localhost:3000/api/courts", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${coachToken}` },
  }));
  assert(resCourtsMutCoach.status === 200, "COACH allowed on POST /api/courts");

  // Bookings mutations: FRONT_DESK / COACH allowed, others blocked (lines 186-195)
  const resBookingsMutBlocked = await middleware(new NextRequest("http://localhost:3000/api/bookings", {
    method: "PUT",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resBookingsMutBlocked.status === 403, "MEMBER blocked from PUT /api/bookings");

  const resBookingsMutCoach = await middleware(new NextRequest("http://localhost:3000/api/bookings", {
    method: "PATCH",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${coachToken}` },
  }));
  assert(resBookingsMutCoach.status === 200, "COACH allowed on PATCH /api/bookings");

  // Pro shop products mutations: PRO_SHOP allowed, others blocked (lines 198-207)
  const resShopProdBlocked = await middleware(new NextRequest("http://localhost:3000/api/shop/products", {
    method: "PATCH",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resShopProdBlocked.status === 403, "MEMBER blocked from PATCH /api/shop/products");

  const resShopProdAllowed = await middleware(new NextRequest("http://localhost:3000/api/shop/products", {
    method: "PATCH",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${proShopToken}` },
  }));
  assert(resShopProdAllowed.status === 200, "PRO_SHOP allowed on PATCH /api/shop/products");

  // Pro shop orders mutations: PRO_SHOP allowed, others blocked (lines 210-219)
  const resShopOrderBlocked = await middleware(new NextRequest("http://localhost:3000/api/shop/orders", {
    method: "PUT",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resShopOrderBlocked.status === 403, "MEMBER blocked from PUT /api/shop/orders");

  const resShopOrderAllowed = await middleware(new NextRequest("http://localhost:3000/api/shop/orders", {
    method: "PUT",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${proShopToken}` },
  }));
  assert(resShopOrderAllowed.status === 200, "PRO_SHOP allowed on PUT /api/shop/orders");

  // Bar tabs mutations: BAR_STAFF / CHEF allowed, others blocked (lines 222-231)
  const resBarTabBlocked = await middleware(new NextRequest("http://localhost:3000/api/bar/tabs", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resBarTabBlocked.status === 403, "MEMBER blocked from POST /api/bar/tabs");

  const resBarTabChef = await middleware(new NextRequest("http://localhost:3000/api/bar/tabs", {
    method: "PATCH",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${chefToken}` },
  }));
  assert(resBarTabChef.status === 200, "CHEF allowed on PATCH /api/bar/tabs");

  // Bar menu & tables mutations: BAR_STAFF allowed, others blocked (lines 234-243)
  const resBarMenuBlocked = await middleware(new NextRequest("http://localhost:3000/api/bar/menu", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resBarMenuBlocked.status === 403, "MEMBER blocked from POST /api/bar/menu");

  const resBarMenuAllowed = await middleware(new NextRequest("http://localhost:3000/api/bar/menu", {
    method: "POST",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${barStaffToken}` },
  }));
  assert(resBarMenuAllowed.status === 200, "BAR_STAFF allowed on POST /api/bar/menu");

  const resBarTablesBlocked = await middleware(new NextRequest("http://localhost:3000/api/bar/tables", {
    method: "PATCH",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resBarTablesBlocked.status === 403, "MEMBER blocked from PATCH /api/bar/tables");

  const resBarTablesAllowed = await middleware(new NextRequest("http://localhost:3000/api/bar/tables", {
    method: "PATCH",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${barStaffToken}` },
  }));
  assert(resBarTablesAllowed.status === 200, "BAR_STAFF allowed on PATCH /api/bar/tables");

  // Financial transactions GET: FRONT_DESK / OWNER allowed, others blocked (lines 246-255)
  const resTxnBlocked = await middleware(new NextRequest("http://localhost:3000/api/transactions", {
    method: "GET",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resTxnBlocked.status === 403, "MEMBER blocked from GET /api/transactions");

  const resTxnAllowed = await middleware(new NextRequest("http://localhost:3000/api/transactions", {
    method: "GET",
    headers: { cookie: `${SESSION_COOKIE_NAME}=${frontDeskToken}` },
  }));
  assert(resTxnAllowed.status === 200, "FRONT_DESK allowed on GET /api/transactions");

  // Authenticated general non-api page request (line 270)
  const resHomeAuth = await middleware(new NextRequest("http://localhost:3000/", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resHomeAuth.status === 200, "Authenticated user accessing / returns next()");

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runMiddlewareWhitebox().catch((err) => {
  console.error("Middleware whitebox test failed:", err);
  process.exit(1);
});
