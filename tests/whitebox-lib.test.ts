import { AsyncLocalStorage } from "async_hooks";
(globalThis as any).AsyncLocalStorage = AsyncLocalStorage;

import { cn, formatCurrency, formatDate, formatTime, computeSafeDestination } from "../src/lib/utils";
import { PricingCalculator } from "../src/lib/pricing-calculator";
import * as pricingModule from "../src/lib/pricing";
import { validatePasswordStrength } from "../src/lib/password-validator";
import { authRateLimiter } from "../src/lib/rate-limiter";
import {
  signSessionToken,
  verifySessionToken,
  extractRawSessionToken,
  SESSION_COOKIE_NAME,
} from "../src/lib/auth-token";
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getUserFromSessionToken,
  getCurrentUser,
} from "../src/lib/auth";
import { logAuthEvent } from "../src/lib/audit";
import { validateEmail } from "../src/lib/email-validator";
import { prisma } from "../src/lib/db";
import { PlanTier, AuthEventType } from "@prisma/client";

async function runLibCoverage() {
  console.log("=== STARTING LIB MODULES WHITE-BOX TEST SUITE ===");
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

  // ==========================================
  // 1. src/lib/utils.ts
  // ==========================================
  console.log("\n[1] Testing src/lib/utils.ts...");
  const mergedClass = cn("px-2 py-1", false && "hidden", null, undefined, "bg-red-500", { "text-white": true });
  assert(typeof mergedClass === "string" && mergedClass.includes("bg-red-500"), "cn merges classes correctly");

  const formattedInr = formatCurrency(15000);
  assert(formattedInr.includes("15,000") || formattedInr.includes("15"), "formatCurrency formats correctly");
  assert(formatCurrency(null as any).includes("0"), "formatCurrency(null) safely formats 0");
  assert(formatCurrency(undefined as any).includes("0"), "formatCurrency(undefined) safely formats 0");
  assert(formatCurrency(NaN).includes("0"), "formatCurrency(NaN) safely formats 0");

  const formattedDate = formatDate("2026-11-21T12:00:00Z");
  assert(typeof formattedDate === "string" && formattedDate.length > 0, "formatDate formats string date");
  const formattedDateObj = formatDate(new Date("2026-05-10"));
  assert(typeof formattedDateObj === "string" && formattedDateObj.length > 0, "formatDate formats Date instance");

  const formattedTimeStr = formatTime("2026-11-21T14:30:00Z");
  assert(typeof formattedTimeStr === "string" && formattedTimeStr.length > 0, "formatTime formats string time");
  const formattedTimeObj = formatTime(new Date("2026-05-10T09:15:00"));
  assert(typeof formattedTimeObj === "string" && formattedTimeObj.length > 0, "formatTime formats Date instance");

  // computeSafeDestination
  assert(computeSafeDestination(null) === "/", "computeSafeDestination handles null");
  assert(computeSafeDestination(undefined) === "/", "computeSafeDestination handles undefined");
  assert(computeSafeDestination("") === "/", "computeSafeDestination handles empty string");
  assert(computeSafeDestination("/dashboard") === "/dashboard", "computeSafeDestination allows /dashboard");
  assert(computeSafeDestination("https://evil.com") === "/", "computeSafeDestination blocks https://");
  assert(computeSafeDestination("//attacker.com") === "/", "computeSafeDestination blocks //");
  assert(computeSafeDestination("/\\attacker.com") === "/", "computeSafeDestination blocks /\\");
  assert(computeSafeDestination("/login") === "/", "computeSafeDestination loops /login back to /");

  // ==========================================
  // 2. src/lib/pricing-calculator.ts & pricing.ts
  // ==========================================
  console.log("\n[2] Testing src/lib/pricing-calculator.ts and src/lib/pricing.ts...");
  assert(pricingModule.PricingCalculator === PricingCalculator, "pricing.ts re-exports PricingCalculator");

  // Court Booking - regular with plan
  const courtWithPlan = PricingCalculator.calculateCourtBooking({
    hourlyRate: 800,
    durationMinutes: 90,
    plan: {
      tier: PlanTier.GOLD,
      courtDiscountPercent: 100,
      shopDiscountPercent: 20,
      barDiscountPercent: 20,
      maxDailyBookings: 2,
    },
  });
  assert(courtWithPlan.isFree === true && courtWithPlan.finalPrice === 0, "Court booking 100% discount is free");

  // Court Booking - regular without plan and default duration (60m)
  const courtNoPlan = PricingCalculator.calculateCourtBooking({
    hourlyRate: 800,
  });
  assert(courtNoPlan.basePrice === 800 && courtNoPlan.finalPrice === 800 && !courtNoPlan.isFree, "Court booking default duration & no plan");

  // Court Booking - social play with plan
  const socialWithPlan = PricingCalculator.calculateCourtBooking({
    hourlyRate: 800,
    isSocialPlay: true,
    socialPlayersCount: 2,
    plan: {
      tier: PlanTier.SILVER,
      courtDiscountPercent: 50,
      shopDiscountPercent: 10,
      barDiscountPercent: 10,
      maxDailyBookings: 2,
    },
  });
  assert(socialWithPlan.basePrice === 500 && socialWithPlan.discountPercent === 50 && socialWithPlan.finalPrice === 250, "Social play with plan");

  // Instantiate class to ensure constructor is covered
  const calcInstance = new PricingCalculator();
  assert(calcInstance instanceof PricingCalculator, "PricingCalculator class instantiates");

  // Court Booking - social play without plan and negative players fallback
  const socialNoPlan = PricingCalculator.calculateCourtBooking({
    hourlyRate: 800,
    isSocialPlay: true,
    socialPlayersCount: -1,
  });
  assert(socialNoPlan.basePrice === 250 && socialNoPlan.finalPrice === 250 && socialNoPlan.discountAmount === 0, "Social play fallback to 1 player and no plan");

  // Shop Order - with plan & without plan
  const shopWithPlan = PricingCalculator.calculateShopOrder({
    items: [{ unitPrice: 500, quantity: 2 }, { unitPrice: 200, quantity: 1 }],
    plan: {
      tier: PlanTier.GOLD,
      courtDiscountPercent: 100,
      shopDiscountPercent: 20,
      barDiscountPercent: 20,
      maxDailyBookings: 2,
    },
  });
  assert(shopWithPlan.subtotal === 1200 && shopWithPlan.discountAmount === 240 && shopWithPlan.finalPrice === 960, "Shop order calculation with 20% discount");

  const shopNoPlan = PricingCalculator.calculateShopOrder({
    items: [{ unitPrice: 150, quantity: 3 }],
  });
  assert(shopNoPlan.subtotal === 450 && shopNoPlan.finalPrice === 450 && shopNoPlan.discountAmount === 0, "Shop order without plan");

  // Bar Bill - with plan & without plan & custom tax
  const barWithPlan = PricingCalculator.calculateBarBill({
    items: [{ unitPrice: 400, quantity: 2 }],
    plan: {
      tier: PlanTier.SILVER,
      courtDiscountPercent: 50,
      shopDiscountPercent: 10,
      barDiscountPercent: 10,
      maxDailyBookings: 2,
    },
    taxRate: 0.05,
  });
  assert(barWithPlan.subtotal === 800 && barWithPlan.discountAmount === 80 && barWithPlan.finalAmount > 700, "Bar bill with discount and 5% tax");

  const barNoPlan = PricingCalculator.calculateBarBill({
    items: [{ unitPrice: 100, quantity: 1 }],
  });
  assert(barNoPlan.subtotal === 100 && barNoPlan.discountAmount === 0 && barNoPlan.finalAmount === 105, "Bar bill default fallback tax rate (5%)");

  // Membership Fee - boundary conditions & fallbacks
  const memFeeFallback = PricingCalculator.calculateMembershipFee({
    monthlyFee: -50,
    durationMonths: -2,
  });
  assert(memFeeFallback.monthlyFee === 0 && memFeeFallback.durationMonths === 1 && memFeeFallback.finalPrice === 0, "Membership fee negative values handled safely");

  const memFeeCappedDiscount = PricingCalculator.calculateMembershipFee({
    monthlyFee: 1000,
    durationMonths: 2,
    discountPercent: 150,
  });
  assert(memFeeCappedDiscount.discountPercent === 100 && memFeeCappedDiscount.finalPrice === 0, "Membership fee discount capped at 100%");

  // getMembershipStatus
  const expiredStatus = PricingCalculator.getMembershipStatus(new Date(Date.now() - 24 * 60 * 60 * 1000));
  assert(expiredStatus === "EXPIRED", "Past date is EXPIRED");

  const expiringSoonStatus = PricingCalculator.getMembershipStatus(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  assert(expiringSoonStatus === "EXPIRING_SOON", "Date within 7 days is EXPIRING_SOON");

  const activeStatus = PricingCalculator.getMembershipStatus(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  assert(activeStatus === "ACTIVE", "Date beyond 7 days is ACTIVE");

  // ==========================================
  // 3. src/lib/password-validator.ts
  // ==========================================
  console.log("\n[3] Testing src/lib/password-validator.ts...");
  // null / empty
  const emptyPwd = validatePasswordStrength("" as any);
  assert(emptyPwd.score === 0 && emptyPwd.strengthLabel === "Too Weak" && !emptyPwd.isValid, "Empty password is Too Weak");

  // 1 met: only length (8 'a's -> meets length and lowercase = 2 met)
  // Let's test exactly 1 met: "a" (meets only lowercase)
  const oneMet = validatePasswordStrength("a");
  assert(oneMet.score === 0 && oneMet.strengthLabel === "Too Weak", "1 met criterion scores 0 (Too Weak)");

  // 2 met: "ab" (lowercase only, length 2) -> "aA" (lowercase + uppercase)
  const twoMet = validatePasswordStrength("aA");
  assert(twoMet.score === 1 && twoMet.strengthLabel === "Weak", "2 met criteria score 1 (Weak)");

  // 3 met: "aA1" (lowercase + uppercase + number, length 3) -> covers lines 64-65
  const threeMet = validatePasswordStrength("aA1");
  assert(threeMet.score === 2 && threeMet.strengthLabel === "Fair", "3 met criteria score 2 (Fair)");

  // 4 met: "aA1aaaaa" (lowercase + uppercase + number + length >= 8, but no special) -> meets required!
  const fourMet = validatePasswordStrength("aA1aaaaa");
  assert(fourMet.score === 3 && fourMet.strengthLabel === "Strong" && fourMet.isValid, "4 met criteria score 3 (Strong) and isValid = true");

  // 5 met: "aA1!aaaa" (all 5 met)
  const fiveMet = validatePasswordStrength("aA1!aaaa");
  assert(fiveMet.score === 4 && fiveMet.strengthLabel === "Very Strong" && fiveMet.isValid, "5 met criteria score 4 (Very Strong)");

  // ==========================================
  // 4. src/lib/rate-limiter.ts
  // ==========================================
  console.log("\n[4] Testing src/lib/rate-limiter.ts...");
  const rlKey = `test-rl-${Date.now()}`;
  assert(authRateLimiter.check(rlKey).allowed === true, "Unseen key is allowed");

  // Fail 5 times to trigger lockout
  for (let i = 0; i < 5; i++) {
    authRateLimiter.recordFailure(rlKey);
  }
  const lockedCheck = authRateLimiter.check(rlKey);
  assert(lockedCheck.allowed === false && lockedCheck.retryAfterSeconds > 0, "Locked key check returns not allowed");

  // Simulate expired lockout on the record to hit lines 51-54
  const internalMap = (authRateLimiter as any).attempts as Map<string, any>;
  const record = internalMap.get(rlKey);
  if (record) {
    record.lockedUntil = Date.now() - 1000; // expired
    const afterExpiry = authRateLimiter.check(rlKey);
    assert(afterExpiry.allowed === true && afterExpiry.remainingAttempts === 5, "Expired lockout resets record in check()");
  }

  // Simulate elapsed window without lockout to hit lines 59-61
  const windowKey = `test-win-${Date.now()}`;
  authRateLimiter.recordFailure(windowKey);
  const winRecord = internalMap.get(windowKey);
  if (winRecord) {
    winRecord.firstAttemptAt = Date.now() - 20 * 60 * 1000; // 20 mins ago (> 15m WINDOW_MS)
    const winCheck = authRateLimiter.check(windowKey);
    assert(winCheck.allowed === true, "Elapsed window resets record in check()");
  }

  // Simulate cleanup() execution to hit lines 123-131
  const cleanupKey1 = `test-clean-lock-${Date.now()}`;
  const cleanupKey2 = `test-clean-win-${Date.now()}`;
  internalMap.set(cleanupKey1, { failedAttempts: 5, firstAttemptAt: Date.now() - 100000, lockedUntil: Date.now() - 1000 });
  internalMap.set(cleanupKey2, { failedAttempts: 2, firstAttemptAt: Date.now() - 20 * 60 * 1000, lockedUntil: null });
  (authRateLimiter as any).cleanup();
  assert(!internalMap.has(cleanupKey1) && !internalMap.has(cleanupKey2), "cleanup() evicts expired records");

  // Reset
  authRateLimiter.reset(rlKey);
  assert(authRateLimiter.check(rlKey).allowed === true, "reset() clears attempts");

  // ==========================================
  // 5. src/lib/auth-token.ts
  // ==========================================
  console.log("\n[5] Testing src/lib/auth-token.ts...");
  // null / empty
  assert((await verifySessionToken("")) === null, "verifySessionToken empty string is null");
  assert((await verifySessionToken("one.two")) === null, "verifySessionToken invalid part count is null");

  // Malformed base64 triggering catch block (lines 104-105)
  assert((await verifySessionToken("token.invalid@!base64$.invalid@!sig$")) === null, "verifySessionToken malformed base64 hits catch block");

  // extractRawSessionToken
  assert(extractRawSessionToken("") === "", "extractRawSessionToken empty is empty");
  assert(extractRawSessionToken("rawtokenonly") === "rawtokenonly", "extractRawSessionToken single part");
  assert(extractRawSessionToken("myrawtoken.b64payload.b64sig") === "myrawtoken", "extractRawSessionToken 3 parts");

  // ==========================================
  // 6. src/lib/auth.ts
  // ==========================================
  console.log("\n[6] Testing src/lib/auth.ts...");
  const hashed = await hashPassword("mySecret123");
  assert(await verifyPassword("mySecret123", hashed), "verifyPassword matches hash");
  assert(!(await verifyPassword("wrong", hashed)), "verifyPassword rejects wrong password");

  // destroySession with empty/invalid token
  await destroySession("");
  assert(true, "destroySession with empty string returns safely");

  // getUserFromSessionToken with empty / invalid tokens
  assert((await getUserFromSessionToken("")) === null, "getUserFromSessionToken empty string is null");

  // Create real test user and session to test sliding session refresh and expiry
  const testUserEmail = `whitebox.auth.${Date.now()}@champions.club`;
  const testUser = await prisma.user.create({
    data: {
      email: testUserEmail,
      name: "Whitebox Auth User",
      password: hashed,
      role: "MEMBER",
    },
  });

  const sessionNormal = await createSession(testUser.id, "MEMBER", false);
  assert(sessionNormal.maxAgeSeconds === 86400, "rememberMe=false has 1-day maxAge");
  const sessionRemember = await createSession(testUser.id, "MEMBER", true);
  assert(sessionRemember.maxAgeSeconds === 2592000, "rememberMe=true has 30-day maxAge");

  // destroySession with real token
  await destroySession(sessionNormal.token);
  const foundDestroyed = await prisma.session.findUnique({ where: { sessionToken: sessionNormal.rawToken } });
  assert(!foundDestroyed, "destroySession removes session from DB");

  // Test expired session in DB (lines 116-119)
  const origFindUnique = prisma.session.findUnique;
  (prisma.session as any).findUnique = async () => ({
    id: "expired-sess-id",
    sessionToken: "expired-raw",
    userId: testUser.id,
    expiresAt: new Date(Date.now() - 5000),
    user: null,
  });
  const dummyToken = await signSessionToken({
    sessionToken: "expired-raw",
    userId: testUser.id,
    role: "MEMBER",
    exp: Date.now() + 60000,
  });
  const resExpiredDirect = await getUserFromSessionToken(dummyToken);
  prisma.session.findUnique = origFindUnique;
  assert(resExpiredDirect === null, "Expired session in DB triggers lines 116-119");

  // Test Sliding Session Refresh (lines 124-132: remaining < totalDuration / 2)
  const slideRawToken = `slide-raw-${Date.now()}`;
  const now = Date.now();
  const slideSession = await prisma.session.create({
    data: {
      sessionToken: slideRawToken,
      userId: testUser.id,
      createdAt: new Date(now - 100000),
      expiresAt: new Date(now + 20000), // remaining (20s) < totalDuration / 2 (60s)
    },
  });
  const slideCompound = await signSessionToken({
    sessionToken: slideRawToken,
    userId: testUser.id,
    role: "MEMBER",
    exp: now + 60000,
  });
  const slideUser = await getUserFromSessionToken(slideCompound);
  assert(slideUser !== null && slideUser.id === testUser.id, "getUserFromSessionToken resolves and triggers slide refresh");

  // getCurrentUser outside request context triggers catch (lines 143-145)
  const currentUserOutside = await getCurrentUser();
  assert(currentUserOutside === null, "getCurrentUser outside request context returns null");

  // getCurrentUser when cookies returns a token (line 142)
  const { requestAsyncStorage } = await import("next/dist/client/components/request-async-storage-instance.js");
  const currentUserWithCookie = await requestAsyncStorage.run(
    {
      cookies: {
        get: (name: string) => (name === SESSION_COOKIE_NAME ? { value: sessionRemember.token } : undefined),
      },
    } as any,
    () => getCurrentUser()
  );
  assert(currentUserWithCookie !== null && currentUserWithCookie.id === testUser.id, "getCurrentUser with cookie executes line 142 and resolves testUser");

  // ==========================================
  // 7. src/lib/audit.ts
  // ==========================================
  console.log("\n[7] Testing src/lib/audit.ts...");
  await logAuthEvent({
    eventType: AuthEventType.LOGIN_SUCCESS,
    userId: testUser.id,
    email: testUser.email,
    ipAddress: "127.0.0.1",
    userAgent: "Mozilla/5.0 WhiteboxTest",
    details: "Test event execution",
  });
  assert(true, "logAuthEvent completes without error");

  // Trigger catch block in logAuthEvent (lines 30-31)
  const origCreate = prisma.authAuditLog.create;
  (prisma.authAuditLog as any).create = async () => {
    throw new Error("Simulated audit write failure");
  };
  await logAuthEvent({
    eventType: AuthEventType.LOGIN_FAILURE,
    email: "fail@test.com",
  });
  prisma.authAuditLog.create = origCreate;
  assert(true, "logAuthEvent catches DB failure gracefully");

  // ==========================================
  // 8. src/lib/email-validator.ts
  // ==========================================
  console.log("\n[8] Testing src/lib/email-validator.ts edge cases...");
  // Empty / non-string (lines 263-268)
  const emptyEmailRes = await validateEmail("" as any);
  assert(!emptyEmailRes.isValid && emptyEmailRes.errorCode === "INVALID_SYNTAX", "Empty email rejected with INVALID_SYNTAX");

  const nullEmailRes = await validateEmail(null as any);
  assert(!nullEmailRes.isValid && nullEmailRes.errorCode === "INVALID_SYNTAX", "Null email rejected with INVALID_SYNTAX");

  // Domain length 0: "user@" (line 128)
  const trailingAtRes = await validateEmail("user@");
  assert(!trailingAtRes.isValid && trailingAtRes.errorCode === "INVALID_SYNTAX", "user@ rejected with INVALID_SYNTAX");

  // Trigger URL catch block (lines 287-288)
  const origURL = globalThis.URL;
  (globalThis as any).URL = function() {
    throw new Error("Simulated URL error");
  };
  const urlErrRes = await validateEmail("alex@champions.club");
  globalThis.URL = origURL;
  assert(urlErrRes.isValid === true, "validateEmail URL parse error fallback executes lines 287-288");

  // Valid format test domain
  const testDomRes = await validateEmail("alex@champions.club");
  assert(testDomRes.isValid === true, "alex@champions.club is valid");

  // Cleanup test entities
  await prisma.session.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
  await prisma.authAuditLog.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
  await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runLibCoverage().catch((err) => {
  console.error("Lib whitebox test failed:", err);
  process.exit(1);
});
