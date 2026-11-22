import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db";
import { middleware } from "../src/middleware";
import { POST as joinMemberHandler } from "../src/app/api/members/join/route";
import { POST as loginHandler } from "../src/app/api/auth/login/route";
import { GET as getPlansHandler } from "../src/app/api/plans/route";
import {
  signSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
} from "../src/lib/auth-token";
import { verifyPassword, getUserFromSessionToken } from "../src/lib/auth";
import { authRateLimiter } from "../src/lib/rate-limiter";
import { PlanTier, MemberStatus, PaymentMethod, TransactionType, TransactionCategory, UserRole } from "@prisma/client";

async function runTestSuite() {
  console.log("=== STARTING PUBLIC MEMBERSHIP PURCHASE & ACCESS TEST SUITE ===");
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

  const createdUserIds: string[] = [];
  const createdMemberIds: string[] = [];
  const createdTxnIds: string[] = [];

  try {
    // Generate an authenticated MEMBER token
    const memberToken = await signSessionToken({
      sessionToken: "member-test-session-token",
      userId: "test-member-user-id",
      role: "MEMBER",
      exp: Date.now() + 60000,
    });

    // ==========================================
    // [1] Edge Middleware Public Route Access
    // ==========================================
    console.log("\n[1] Testing Edge Middleware Public Access...");

    // Test 1.1: Public memberships showcase page is accessible unauthenticated
    const reqMemberships = new NextRequest("http://localhost:3000/memberships");
    const resMemberships = await middleware(reqMemberships);
    assert(resMemberships.status === 200, "Unauthenticated visitor can access /memberships (status 200)");

    // Test 1.2: Public join page is accessible unauthenticated
    const reqJoin = new NextRequest("http://localhost:3000/join");
    const resJoin = await middleware(reqJoin);
    assert(resJoin.status === 200, "Unauthenticated visitor can access /join (status 200)");

    // Test 1.3: GET /api/plans is accessible unauthenticated (to load live tiers)
    const reqGetPlans = new NextRequest("http://localhost:3000/api/plans", { method: "GET" });
    const resGetPlans = await middleware(reqGetPlans);
    assert(resGetPlans.status === 200, "Unauthenticated GET /api/plans is allowed through middleware");

    // Test 1.4: POST /api/members/join is accessible unauthenticated
    const reqPostJoin = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const resPostJoin = await middleware(reqPostJoin);
    assert(resPostJoin.status === 200, "Unauthenticated POST /api/members/join is allowed through middleware");

    // Test 1.5: Authenticated MEMBER can access /memberships
    const reqAuthMemberships = new NextRequest("http://localhost:3000/memberships", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
    });
    const resAuthMemberships = await middleware(reqAuthMemberships);
    assert(resAuthMemberships.status === 200, "Authenticated MEMBER can access /memberships (status 200)");

    // Test 1.6: Authenticated MEMBER can access POST /api/members/join without 403 Forbidden
    const reqAuthPostJoin = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${memberToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const resAuthPostJoin = await middleware(reqAuthPostJoin);
    assert(resAuthPostJoin.status === 200, "Authenticated MEMBER is not blocked by RBAC on POST /api/members/join (status 200)");

    // Test 1.7: Authenticated MEMBER can submit inquiry via POST /api/leads without 403
    const reqAuthLead = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${memberToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const resAuthLead = await middleware(reqAuthLead);
    assert(resAuthLead.status === 200, "Authenticated MEMBER is allowed through middleware on POST /api/leads");

    // Test 1.8: Protected API routes still require authentication
    const reqProtectedFinance = new NextRequest("http://localhost:3000/api/finance/analytics", { method: "GET" });
    const resProtectedFinance = await middleware(reqProtectedFinance);
    assert(resProtectedFinance.status === 401, "Unauthenticated access to /api/finance/analytics receives 401");

    // Test 1.9: Protected Plan mutations still require authentication
    const reqProtectedPlanMut = new NextRequest("http://localhost:3000/api/plans", { method: "PUT" });
    const resProtectedPlanMut = await middleware(reqProtectedPlanMut);
    assert(resProtectedPlanMut.status === 401, "Unauthenticated PUT /api/plans receives 401");

    // Test 1.10: Unauthenticated / root still redirects to /login (preserving auth system contract)
    const reqUnauthHome = new NextRequest("http://localhost:3000/");
    const resUnauthHome = await middleware(reqUnauthHome);
    assert(resUnauthHome.status === 307 || resUnauthHome.status === 302, "Unauthenticated / redirects to /login");

    // ==========================================
    // [2] Input Validation on POST /api/members/join
    // ==========================================
    console.log("\n[2] Testing Input Validation & Security Defense on Public Join...");

    // Test 2.1: Invalid JSON body
    const reqInvalidJson = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "invalid-not-json{",
    });
    const resInvalidJson = await joinMemberHandler(reqInvalidJson);
    assert(resInvalidJson.status === 400, "Invalid JSON body returns 400 Bad Request");

    // Test 2.2: Missing required fields
    const reqMissing = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", email: "" }),
    });
    const resMissing = await joinMemberHandler(reqMissing);
    assert(resMissing.status === 400, "Missing fields return 400 Bad Request");

    // Test 2.3: Invalid email format
    const reqBadEmail = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "not-an-email",
        phone: "+91 98765 43210",
        password: "Password123!",
        planTier: "GOLD",
      }),
    });
    const resBadEmail = await joinMemberHandler(reqBadEmail);
    assert(resBadEmail.status === 400, "Invalid email format returns 400 Bad Request");

    // Test 2.4: Invalid plan tier
    const reqBadTier = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "valid@example.com",
        phone: "+91 98765 43210",
        password: "Password123!",
        planTier: "PLATINUM",
      }),
    });
    const resBadTier = await joinMemberHandler(reqBadTier);
    assert(resBadTier.status === 400, "Invalid plan tier returns 400 Bad Request");

    // Test 2.5: Weak password rejection (<8 chars)
    const reqShortPwd = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "shortpwd@example.com",
        phone: "+91 98765 43210",
        password: "Ab1!",
        planTier: "GOLD",
      }),
    });
    const resShortPwd = await joinMemberHandler(reqShortPwd);
    assert(resShortPwd.status === 400, "Short password (<8 chars) returns 400 Bad Request");

    // Test 2.6: Weak password rejection (no uppercase or no numbers)
    const reqSimplePwd = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "simplepwd@example.com",
        phone: "+91 98765 43210",
        password: "passwordonly",
        planTier: "GOLD",
      }),
    });
    const resSimplePwd = await joinMemberHandler(reqSimplePwd);
    assert(resSimplePwd.status === 400, "Password without uppercase/number returns 400 Bad Request");

    // Test 2.7: Invalid payment method rejection
    const reqBadPayMethod = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "badpay@example.com",
        phone: "+91 98765 43210",
        password: "Password123!",
        planTier: "GOLD",
        paymentMethod: "BITCOIN",
      }),
    });
    const resBadPayMethod = await joinMemberHandler(reqBadPayMethod);
    assert(resBadPayMethod.status === 400, "Invalid payment method BITCOIN rejected with 400 Bad Request");

    // ==========================================
    // [3] Complete Public Membership Purchase (GOLD Tier)
    // ==========================================
    console.log("\n[3] Testing Public Membership Purchase (GOLD Tier - 6 Months)...");

    const goldEmail = `gold.test.${Date.now()}@champions.club`;
    const plainPassword = "Password123!";

    const reqGoldJoin = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Vikram Singhania",
        email: goldEmail,
        phone: "+91 98111 22233",
        password: plainPassword,
        planTier: "gold", // Test lowercase tier normalization
        durationMonths: 6,
        paymentMethod: "UPI",
      }),
    });

    const resGoldJoin = await joinMemberHandler(reqGoldJoin);
    assert(resGoldJoin.status === 200, "Successful public join returns HTTP 200");
    const goldData = await resGoldJoin.json();
    assert(goldData.success === true, "Response success is true");

    if (goldData?.member?.id) createdMemberIds.push(goldData.member.id);
    if (goldData?.user?.id) createdUserIds.push(goldData.user.id);
    if (goldData?.transaction?.id) createdTxnIds.push(goldData.transaction.id);

    // Verify member record details
    const member = goldData.member;
    assert(member !== null, "Member record returned");
    assert(member.name === "Vikram Singhania", "Member name matches input");
    assert(member.email === goldEmail.toLowerCase(), "Member email normalized to lowercase");
    assert(member.planTier === "GOLD", "Member tier normalized to GOLD");
    assert(member.status === "ACTIVE", "Member status is ACTIVE");
    assert(member.memberNumber.startsWith("CC-1"), `Member number has CC-1 prefix (${member.memberNumber})`);

    // Verify dates
    const startDate = new Date(member.startDate);
    const expiryDate = new Date(member.expiryDate);
    const monthsDiff = Math.round((expiryDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000));
    assert(monthsDiff >= 5 && monthsDiff <= 7, "Membership expiry is approximately 6 months from start");

    // Verify User account creation
    const user = goldData.user;
    assert(user !== null, "User account returned");
    assert(user.role === "MEMBER", "User role is MEMBER");
    assert(user.email === goldEmail.toLowerCase(), "User email matches member email");

    // Verify password was hashed (NOT stored in plaintext)
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    assert(dbUser !== null, "User found in PostgreSQL database");
    assert(dbUser?.password !== plainPassword, "Password in database is hashed (not plaintext)");
    assert(dbUser?.password.startsWith("$2"), "Password hash uses bcrypt ($2a$ or $2b$)");
    const isPasswordValid = await verifyPassword(plainPassword, dbUser!.password);
    assert(isPasswordValid === true, "Bcrypt hash correctly verifies against plaintext password");

    // Verify User <-> Member relation
    assert(dbUser?.memberId === member.id, "User.memberId correctly foreign-keyed to Member.id");

    // Verify unified Transaction ledger write
    const transaction = goldData.transaction;
    assert(transaction !== null, "Transaction record returned");
    assert(transaction.type === TransactionType.MEMBERSHIP_FEE, "Transaction type is MEMBERSHIP_FEE");
    assert(transaction.category === TransactionCategory.MEMBERSHIP, "Transaction category is MEMBERSHIP");
    const goldPlanInDb = await prisma.membershipPlan.findUnique({ where: { tier: PlanTier.GOLD } });
    const expectedGoldAmount = (goldPlanInDb?.monthlyFee || 6000) * 6;
    assert(transaction.amount === expectedGoldAmount, `Transaction amount correctly calculated (expected ₹${expectedGoldAmount}, got ₹${transaction.amount})`);
    assert(transaction.paymentMethod === PaymentMethod.UPI, "Payment method recorded as UPI");
    assert(transaction.memberId === member.id, "Transaction linked to new member ID");
    assert(transaction.referenceNo.startsWith("TXN-"), `Reference number has TXN- prefix (${transaction.referenceNo})`);

    // Verify session cookie was set in response
    const setCookieHeader = resGoldJoin.headers.get("set-cookie");
    assert(setCookieHeader !== null && setCookieHeader.includes(SESSION_COOKIE_NAME), "Session cookie cc_session set in response headers");
    assert(setCookieHeader?.includes("HttpOnly") ?? false, "Session cookie is HttpOnly");

    // Verify token can resolve the user from DB session
    const cookieMatch = setCookieHeader?.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
    const rawToken = cookieMatch ? cookieMatch[1] : null;
    assert(rawToken !== null, "Extracted session token from response cookie");
    const sessionPayload = rawToken ? await verifySessionToken(rawToken) : null;
    assert(sessionPayload !== null, "Signed session token successfully verified by edge verifier");
    assert(sessionPayload?.userId === user.id, "Session payload userId matches created user");
    assert(sessionPayload?.role === "MEMBER", "Session payload role matches MEMBER");

    const resolvedUser = rawToken ? await getUserFromSessionToken(rawToken) : null;
    assert(resolvedUser !== null, "Database session resolves user successfully");
    assert(resolvedUser?.member?.id === member.id, "Resolved user includes member profile");
    assert(resolvedUser?.member?.plan?.tier === "GOLD", "Resolved user includes plan tier GOLD");

    // ==========================================
    // [4] Duplicate Prevention
    // ==========================================
    console.log("\n[4] Testing Duplicate Email Prevention...");

    const reqDuplicate = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Vikram Duplicate",
        email: goldEmail,
        phone: "+91 98111 22233",
        password: "AnotherPassword1!",
        planTier: "GOLD",
      }),
    });
    const resDuplicate = await joinMemberHandler(reqDuplicate);
    assert(resDuplicate.status === 400, "Duplicate email returns 400 Bad Request");
    const duplicateData = await resDuplicate.json();
    assert(duplicateData.success === false, "Duplicate request rejected with success = false");

    // ==========================================
    // [5] Public Purchase for SILVER and JUNIOR Tiers + Duration Clamping
    // ==========================================
    console.log("\n[5] Testing Silver & Junior Plan Purchases...");

    // Silver tier with CARD payment and duration clamping (float clamped)
    const silverEmail = `silver.test.${Date.now()}@champions.club`;
    const reqSilver = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Pooja Hegde",
        email: silverEmail,
        phone: "+91 97222 33344",
        password: "SilverSecure2026!",
        planTier: "SILVER",
        durationMonths: 3.7, // Should clamp to 3 months
        paymentMethod: "CARD",
      }),
    });
    const resSilver = await joinMemberHandler(reqSilver);
    assert(resSilver.status === 200, "Silver join returns 200");
    const silverData = await resSilver.json();
    if (silverData?.member?.id) createdMemberIds.push(silverData.member.id);
    if (silverData?.user?.id) createdUserIds.push(silverData.user.id);
    if (silverData?.transaction?.id) createdTxnIds.push(silverData.transaction.id);

    assert(silverData.member.memberNumber.startsWith("CC-2"), `Silver memberNumber has CC-2 prefix (${silverData.member.memberNumber})`);
    assert(silverData.transaction.amount === 10500, `Silver 3-mo fee is ₹10500 (got ₹${silverData.transaction.amount})`);
    assert(silverData.transaction.paymentMethod === PaymentMethod.CARD, "Silver payment recorded as CARD");

    // Junior tier with CASH payment and negative duration clamping (should clamp to 1)
    const juniorEmail = `junior.test.${Date.now()}@champions.club`;
    const reqJunior = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Aarav Sharma (Junior)",
        email: juniorEmail,
        phone: "+91 96333 44455",
        password: "JuniorPass2026!",
        planTier: "JUNIOR",
        durationMonths: -5, // Should clamp to 1 month
        paymentMethod: "CASH",
      }),
    });
    const resJunior = await joinMemberHandler(reqJunior);
    assert(resJunior.status === 200, "Junior join with negative duration returns 200");
    const juniorData = await resJunior.json();
    if (juniorData?.member?.id) createdMemberIds.push(juniorData.member.id);
    if (juniorData?.user?.id) createdUserIds.push(juniorData.user.id);
    if (juniorData?.transaction?.id) createdTxnIds.push(juniorData.transaction.id);

    assert(juniorData.member.memberNumber.startsWith("CC-3"), `Junior memberNumber has CC-3 prefix (${juniorData.member.memberNumber})`);
    assert(juniorData.transaction.amount === 2200, `Junior clamped 1-mo fee is ₹2200 (got ₹${juniorData.transaction.amount})`);
    assert(juniorData.transaction.paymentMethod === PaymentMethod.CASH, "Junior payment recorded as CASH");

    // ==========================================
    // [6] High Concurrency & Collision-Free Member Number Generation
    // ==========================================
    console.log("\n[6] Testing Concurrent Member Enrollments & Member Number Collision Resistance...");

    const concurrentCount = 3;
    const concurrentRequests = Array.from({ length: concurrentCount }, (_, i) => {
      const email = `concurrent.${Date.now()}.${i}@champions.club`;
      const req = new NextRequest("http://localhost:3000/api/members/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Concurrent User ${i + 1}`,
          email,
          phone: `+91 98000 ${10000 + i}`,
          password: "ConcurrentPass1!",
          planTier: "GOLD",
          durationMonths: 1,
          paymentMethod: "UPI",
        }),
      });
      return joinMemberHandler(req);
    });

    const concurrentResponses = await Promise.all(concurrentRequests);
    const concurrentDataList = await Promise.all(concurrentResponses.map((r) => r.json()));

    assert(
      concurrentResponses.every((r) => r.status === 200),
      `All ${concurrentCount} concurrent signups succeeded with HTTP 200`
    );

    const generatedNumbers = concurrentDataList.map((d) => {
      if (d?.member?.id) createdMemberIds.push(d.member.id);
      if (d?.user?.id) createdUserIds.push(d.user.id);
      if (d?.transaction?.id) createdTxnIds.push(d.transaction.id);
      return d?.member?.memberNumber;
    });

    const uniqueNumbers = new Set(generatedNumbers);
    assert(
      uniqueNumbers.size === concurrentCount,
      `All concurrent member numbers are unique and collision-free: ${Array.from(uniqueNumbers).join(", ")}`
    );

    // ==========================================
    // [7] Immediate Login Verification for Newly Enrolled Member
    // ==========================================
    console.log("\n[7] Testing Credentials Login for Newly Registered Member...");

    // Login via email
    const reqLoginEmail = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: goldEmail,
        password: plainPassword,
      }),
    });
    const resLoginEmail = await loginHandler(reqLoginEmail);
    assert(resLoginEmail.status === 200, "New member can immediately log in with email and password");
    const loginData = await resLoginEmail.json();
    assert(loginData.user.role === "MEMBER", "Logged in user role is MEMBER");
    assert(loginData.user.member.memberNumber === member.memberNumber, "Logged in user has member profile attached");

    // Login via memberNumber
    const reqLoginMemberNo = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: member.memberNumber,
        password: plainPassword,
      }),
    });
    const resLoginMemberNo = await loginHandler(reqLoginMemberNo);
    assert(resLoginMemberNo.status === 200, "New member can log in using their CC Member Number");

    // Wrong password rejected
    const reqWrongPwd = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: goldEmail,
        password: "WrongPassword123!",
      }),
    });
    const resWrongPwd = await loginHandler(reqWrongPwd);
    assert(resWrongPwd.status === 401, "Incorrect password returns 401 Unauthorized");

  } finally {
    // ==========================================
    // Cleanup created test records safely
    // ==========================================
    console.log("\n[8] Cleaning up test records from database...");
    for (const txnId of createdTxnIds) {
      if (txnId && typeof txnId === "string") {
        await prisma.transaction.delete({ where: { id: txnId } }).catch(() => {});
      }
    }
    for (const userId of createdUserIds) {
      if (userId && typeof userId === "string") {
        await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
        await prisma.authAuditLog.deleteMany({ where: { userId } }).catch(() => {});
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
    for (const memberId of createdMemberIds) {
      if (memberId && typeof memberId === "string") {
        await prisma.transaction.deleteMany({ where: { memberId } }).catch(() => {});
        await prisma.user.deleteMany({ where: { memberId } }).catch(() => {});
        await prisma.member.delete({ where: { id: memberId } }).catch(() => {});
      }
    }
    await prisma.authAuditLog.deleteMany({
      where: {
        email: {
          contains: ".test.",
        },
      },
    }).catch(() => {});
    authRateLimiter.reset("ip:127.0.0.1");
    console.log("  ✓ Cleaned up test database records");
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
