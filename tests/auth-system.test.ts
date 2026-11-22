import { validatePasswordStrength } from "../src/lib/password-validator";
import { authRateLimiter } from "../src/lib/rate-limiter";
import {
  signSessionToken,
  verifySessionToken,
  extractRawSessionToken,
} from "../src/lib/auth-token";
import { prisma } from "../src/lib/db";
import { createSession, verifyPassword, hashPassword, getUserFromSessionToken } from "../src/lib/auth";

async function runTests() {
  console.log("=== STARTING AUTH SYSTEM TEST SUITE ===");
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

  // 1. Password Strength Validator Tests
  console.log("\n[1] Testing Password Strength Validator...");
  const validPass = validatePasswordStrength("ChampionsClub2026!");
  assert(validPass.isValid === true, "Valid complex password passes");
  assert(validPass.score >= 3, "Valid complex password scores high");

  const shortPass = validatePasswordStrength("Ab1!");
  assert(shortPass.isValid === false, "Short password (<8 chars) is rejected");

  const noUpper = validatePasswordStrength("champions2026!");
  assert(noUpper.isValid === false, "Password with no uppercase is rejected");

  const noLower = validatePasswordStrength("CHAMPIONS2026!");
  assert(noLower.isValid === false, "Password with no lowercase is rejected");

  const noNumber = validatePasswordStrength("ChampionsClub!");
  assert(noNumber.isValid === false, "Password with no number is rejected");

  // 2. Rate Limiter Tests
  console.log("\n[2] Testing Rate Limiter & Brute Force Defense...");
  const testKey = `test-ip-${Date.now()}`;
  authRateLimiter.reset(testKey);

  for (let i = 1; i <= 4; i++) {
    const res = authRateLimiter.recordFailure(testKey);
    assert(res.allowed === true, `Attempt ${i} allowed (remaining: ${res.remainingAttempts})`);
  }

  const fifthRes = authRateLimiter.recordFailure(testKey);
  assert(fifthRes.allowed === false, "5th failed attempt triggers lockout");
  assert(fifthRes.retryAfterSeconds > 0, "Retry-After is provided");

  const checkLocked = authRateLimiter.check(testKey);
  assert(checkLocked.allowed === false, "Check confirms key is locked out");

  authRateLimiter.reset(testKey);
  const checkReset = authRateLimiter.check(testKey);
  assert(checkReset.allowed === true, "Reset unlocks key immediately");

  // 3. Cryptographic Session Token (Edge Compatible) Tests
  console.log("\n[3] Testing Edge-Compatible Signed Session Tokens...");
  const samplePayload = {
    sessionToken: "raw-session-xyz-123",
    userId: "user-test-id",
    role: "FRONT_DESK",
    exp: Date.now() + 60000,
    rememberMe: true,
  };

  const signedToken = await signSessionToken(samplePayload);
  assert(typeof signedToken === "string" && signedToken.split(".").length === 3, "Signed token has 3 parts");

  const verified = await verifySessionToken(signedToken);
  assert(verified !== null, "Token verified successfully");
  assert(verified?.userId === samplePayload.userId, "Payload userId matches");
  assert(verified?.role === samplePayload.role, "Payload role matches");

  const rawExtracted = extractRawSessionToken(signedToken);
  assert(rawExtracted === samplePayload.sessionToken, "Raw session token correctly extracted");

  // Tampered token test
  const tamperedToken = signedToken.slice(0, -4) + "XXXX";
  const tamperedVerify = await verifySessionToken(tamperedToken);
  assert(tamperedVerify === null, "Tampered signature is rejected");

  // Expired token test
  const expiredToken = await signSessionToken({
    ...samplePayload,
    exp: Date.now() - 1000, // expired 1s ago
  });
  const expiredVerify = await verifySessionToken(expiredToken);
  assert(expiredVerify === null, "Expired token is rejected");

  // 4. Database Session & Sliding Refresh Tests
  console.log("\n[4] Testing Database Session Layer & User Resolution...");
  const testAuthUser = await prisma.user.create({
    data: {
      email: `test.auth.sys.${Date.now()}@champions.club`,
      password: await hashPassword("TestPassword123!"),
      name: "Test Auth System User",
      role: "FRONT_DESK",
    },
  });

  try {
    const sessionRes = await createSession(testAuthUser.id, testAuthUser.role, true);
    assert(sessionRes.token.length > 0, "Session created with signed token");
    assert(sessionRes.maxAgeSeconds === 30 * 24 * 60 * 60, "Remember Me grants 30-day maxAge");

    const resolvedUser = await getUserFromSessionToken(sessionRes.token);
    assert(resolvedUser !== null, "User resolved from signed compound session token");
    assert(resolvedUser?.id === testAuthUser.id, "Resolved user ID matches test user");

    if (sessionRes?.rawToken && typeof sessionRes.rawToken === "string") {
      await prisma.session.deleteMany({ where: { sessionToken: sessionRes.rawToken } });
    }
  } finally {
    if (testAuthUser?.id && typeof testAuthUser.id === "string") {
      await prisma.session.deleteMany({ where: { userId: testAuthUser.id } }).catch(() => {});
      await prisma.authAuditLog.deleteMany({ where: { userId: testAuthUser.id } }).catch(() => {});
      await prisma.authAuditLog.deleteMany({ where: { email: testAuthUser.email } }).catch(() => {});
      await prisma.user.delete({ where: { id: testAuthUser.id } }).catch(() => {});
    }
  }

  // 5. Auth Audit Log Verification
  console.log("\n[5] Testing Auth Audit Log Persistence...");
  const auditEmail = `audit.test.${Date.now()}@champions.club`;
  let auditEntry: any = null;
  try {
    auditEntry = await prisma.authAuditLog.create({
      data: {
        eventType: "LOGIN_SUCCESS",
        email: auditEmail,
        ipAddress: "127.0.0.1",
        userAgent: "TestSuite/1.0",
        details: "Automated test verification",
      },
    });
    assert(auditEntry.id !== undefined, "AuthAuditLog entry successfully created");
    assert(auditEntry.eventType === "LOGIN_SUCCESS", "AuthAuditLog eventType matches");
  } finally {
    if (auditEntry?.id && typeof auditEntry.id === "string") {
      await prisma.authAuditLog.delete({ where: { id: auditEntry.id } }).catch(() => {});
    }
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});
