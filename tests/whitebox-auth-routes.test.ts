import { NextRequest } from "next/server";
import { POST as loginHandler } from "../src/app/api/auth/login/route";
import { POST as logoutHandler } from "../src/app/api/auth/logout/route";
import { GET as meHandler } from "../src/app/api/auth/me/route";
import { POST as changePasswordHandler } from "../src/app/api/auth/change-password/route";
import { GET as auditHandler } from "../src/app/api/auth/audit/route";
import { prisma } from "../src/lib/db";
import { authRateLimiter } from "../src/lib/rate-limiter";
import { SESSION_COOKIE_NAME, signSessionToken } from "../src/lib/auth-token";
import bcrypt from "bcryptjs";

async function runAuthRoutesWhitebox() {
  console.log("=== STARTING AUTH API ROUTES WHITE-BOX TEST SUITE ===");
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

  // Create isolated test users
  const testOwnerEmail = `wb.auth.owner.${Date.now()}@champions.club`;
  const testMemberEmail = `wb.auth.member.${Date.now()}@champions.club`;
  const defaultHash = await bcrypt.hash("password123", 10);

  const testOwner = await prisma.user.create({
    data: {
      email: testOwnerEmail,
      password: defaultHash,
      name: "Whitebox Owner",
      role: "OWNER",
    },
  });

  const testMember = await prisma.user.create({
    data: {
      email: testMemberEmail,
      password: defaultHash,
      name: "Whitebox Member",
      role: "MEMBER",
    },
  });

  const memberRawToken = `test-raw-mem-${Date.now()}`;
  await prisma.session.create({
    data: {
      sessionToken: memberRawToken,
      userId: testMember.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const memberToken = await signSessionToken({
    sessionToken: memberRawToken,
    userId: testMember.id,
    role: "MEMBER",
    exp: Date.now() + 3600000,
  });

  const ownerRawToken = `test-raw-own-${Date.now()}`;
  await prisma.session.create({
    data: {
      sessionToken: ownerRawToken,
      userId: testOwner.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const ownerToken = await signSessionToken({
    sessionToken: ownerRawToken,
    userId: testOwner.id,
    role: "OWNER",
    exp: Date.now() + 3600000,
  });

  try {
    // ==========================================
    // 1. POST /api/auth/login
    // ==========================================
    console.log("\n[1] Testing POST /api/auth/login...");
    // 1.1 Missing email
    const resNoEmail = await loginHandler(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({}),
      })
    );
    assert(resNoEmail.status === 400, "Missing email returns 400");

    // 1.2 Missing password when !isDemoSwitch (line 120)
    const resNoPass = await loginHandler(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: testOwnerEmail }),
      })
    );
    assert(resNoPass.status === 400, "Missing password returns 400");

    // 1.3 isDemoSwitch persona instant login (line 169)
    const resDemo = await loginHandler(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: testOwnerEmail, isDemoSwitch: true }),
      })
    );
    assert(resDemo.status === 200, "isDemoSwitch logins without password");

    // 1.3b Standard credentials login with rememberMe=false (line 170)
    const resLoginNorm = await loginHandler(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: testOwnerEmail, password: "password123", rememberMe: false }),
      })
    );
    assert(resLoginNorm.status === 200, "Valid credentials login succeeds");

    // 1.3c User not found (lines 87-111)
    const unknownEmail = `unknown.${Date.now()}@test.com`;
    const ipUnk = "192.168.88.1";
    authRateLimiter.reset(`ip:${ipUnk}`);
    authRateLimiter.reset(`id:${unknownEmail}`);
    for (let i = 0; i < 4; i++) {
      authRateLimiter.recordFailure(`id:${unknownEmail}`);
    }
    // 5th attempt for unknown email: remaining becomes 0 -> hits line 106!
    const resNoUser = await loginHandler(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": ipUnk },
        body: JSON.stringify({ email: unknownEmail, password: "password123" }),
      })
    );
    assert(resNoUser.status === 401, "Account not found on 5th attempt hits line 106");
    authRateLimiter.reset(`ip:${ipUnk}`);
    authRateLimiter.reset(`id:${unknownEmail}`);

    // 1.4 Rate limit lockout and retry-after message (lines 35-65, 146)
    const bruteEmail = `brute.wb.${Date.now()}@champions.club`;
    const bruteUser = await prisma.user.create({
      data: {
        email: bruteEmail,
        password: defaultHash,
        name: "Brute User",
        role: "MEMBER",
      },
    });

    const ip = "192.168.99.1";
    authRateLimiter.reset(`ip:${ip}`);
    authRateLimiter.reset(`id:${bruteEmail}`);

    for (let i = 0; i < 4; i++) {
      await loginHandler(
        new NextRequest("http://localhost:3000/api/auth/login", {
          method: "POST",
          headers: { "x-forwarded-for": ip },
          body: JSON.stringify({ email: bruteEmail, password: "wrongpassword" }),
        })
      );
    }
    // 5th attempt: remaining becomes 0 (line 146)
    const res5th = await loginHandler(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify({ email: bruteEmail, password: "wrongpassword" }),
      })
    );
    const body5th = await res5th.json();
    assert(res5th.status === 401 && body5th.remainingAttempts === 0, "5th attempt reports 0 remaining attempts");

    // 6th attempt: triggers 429 lockout
    const res6th = await loginHandler(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify({ email: bruteEmail, password: "wrongpassword" }),
      })
    );
    assert(res6th.status === 429, "6th attempt blocked with 429 Too Many Requests");

    authRateLimiter.reset(`ip:${ip}`);
    authRateLimiter.reset(`id:${bruteEmail}`);
    await prisma.user.delete({ where: { id: bruteUser.id } }).catch(() => {});

    // 1.5 Catch block (lines 198-203)
    const resLoginCatch = await loginHandler(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        body: "invalid-json-string{",
      })
    );
    assert(resLoginCatch.status === 500, "Malformed json in login triggers catch block returning 500");

    // ==========================================
    // 2. POST /api/auth/logout
    // ==========================================
    console.log("\n[2] Testing POST /api/auth/logout...");
    // 2.1 Logout without token
    const resLogoutNoToken = await logoutHandler(new NextRequest("http://localhost:3000/api/auth/logout", { method: "POST" }));
    assert(resLogoutNoToken.status === 200, "Logout without token returns 200");

    // 2.2 Logout with token but user not in db
    const orphanToken = await signSessionToken({
      sessionToken: "orphan-session",
      userId: "non-existent-user-id",
      role: "MEMBER",
      exp: Date.now() + 3600000,
    });
    const resLogoutOrphan = await logoutHandler(
      new NextRequest("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${orphanToken}` },
      })
    );
    assert(resLogoutOrphan.status === 200, "Logout with orphan token returns 200");

    // 2.3 Logout catch block (lines 37-41)
    const origDestroy = prisma.session.deleteMany;
    (prisma.session as any).deleteMany = async () => {
      throw new Error("Simulated logout destroy failure");
    };
    const resLogoutCatch = await logoutHandler(
      new NextRequest("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
      })
    );
    prisma.session.deleteMany = origDestroy;
    assert(resLogoutCatch.status === 500, "Logout exception triggers catch block returning 500");

    // ==========================================
    // 3. GET /api/auth/me
    // ==========================================
    console.log("\n[3] Testing GET /api/auth/me...");
    // 3.1 Without token
    const resMeNoToken = await meHandler(new NextRequest("http://localhost:3000/api/auth/me"));
    const bodyMeNoToken = await resMeNoToken.json();
    assert(resMeNoToken.status === 200 && bodyMeNoToken.user === null, "GET /api/auth/me without token returns user null");

    // 3.2 With invalid / orphan token
    const resMeOrphan = await meHandler(
      new NextRequest("http://localhost:3000/api/auth/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${orphanToken}` },
      })
    );
    const bodyMeOrphan = await resMeOrphan.json();
    assert(resMeOrphan.status === 200 && bodyMeOrphan.user === null, "GET /api/auth/me with orphan token returns user null");

    // 3.3 With valid token
    const resMeValid = await meHandler(
      new NextRequest("http://localhost:3000/api/auth/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
      })
    );
    const bodyMeValid = await resMeValid.json();
    assert(resMeValid.status === 200 && bodyMeValid.user?.id === testMember.id, "GET /api/auth/me returns authenticated user details");

    // 3.4 Catch block (lines 35-40)
    const origFindUnique = prisma.session.findUnique;
    (prisma.session as any).findUnique = async () => {
      throw new Error("Simulated me session lookup error");
    };
    const resMeCatch = await meHandler(
      new NextRequest("http://localhost:3000/api/auth/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
      })
    );
    prisma.session.findUnique = origFindUnique;
    assert(resMeCatch.status === 500, "GET /api/auth/me exception triggers catch block returning 500");

    // ==========================================
    // 4. POST /api/auth/change-password
    // ==========================================
    console.log("\n[4] Testing POST /api/auth/change-password...");
    // 4.1 Without token (line 22)
    const resCPNoToken = await changePasswordHandler(
      new NextRequest("http://localhost:3000/api/auth/change-password", { method: "POST" })
    );
    assert(resCPNoToken.status === 401, "change-password without token returns 401");

    // 4.2 Orphan session user (line 30)
    const resCPOrphan = await changePasswordHandler(
      new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${orphanToken}` },
      })
    );
    assert(resCPOrphan.status === 401, "change-password with orphan session returns 401");

    // 4.3 Missing fields (line 40)
    const resCPMissing = await changePasswordHandler(
      new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
        body: JSON.stringify({ currentPassword: "password123" }),
      })
    );
    assert(resCPMissing.status === 400, "change-password with missing fields returns 400");

    // 4.4 Mismatched passwords (line 47)
    const resCPMismatched = await changePasswordHandler(
      new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
        body: JSON.stringify({
          currentPassword: "password123",
          newPassword: "NewPass2026!Club",
          confirmPassword: "DifferentPass2026!",
        }),
      })
    );
    assert(resCPMismatched.status === 400, "change-password with mismatched passwords returns 400");

    // 4.5 Weak password (line 56)
    const resCPWeak = await changePasswordHandler(
      new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
        body: JSON.stringify({
          currentPassword: "password123",
          newPassword: "weak",
          confirmPassword: "weak",
        }),
      })
    );
    assert(resCPWeak.status === 400, "change-password with weak password returns 400");

    // 4.6 DB user not found (line 71)
    const userLookupOrig = prisma.user.findUnique;
    (prisma.user as any).findUnique = async () => null;
    const resCPNoDbUser = await changePasswordHandler(
      new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
        body: JSON.stringify({
          currentPassword: "password123",
          newPassword: "NewPass2026!Club",
          confirmPassword: "NewPass2026!Club",
        }),
      })
    );
    prisma.user.findUnique = userLookupOrig;
    assert(resCPNoDbUser.status === 404, "change-password when db user missing returns 404");

    // 4.7 Incorrect current password (line 80)
    const resCPWrongCurrent = await changePasswordHandler(
      new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
        body: JSON.stringify({
          currentPassword: "wrongcurrentpassword",
          newPassword: "NewPass2026!Club",
          confirmPassword: "NewPass2026!Club",
        }),
      })
    );
    assert(resCPWrongCurrent.status === 401, "change-password with incorrect current password returns 401");

    // 4.8 Same new password as old (lines 87-93)
    // First update dbUser password to a valid complex password so it passes validatePasswordStrength
    const complexHash = await bcrypt.hash("Champions2026!", 10);
    await prisma.user.update({ where: { id: testMember.id }, data: { password: complexHash } });

    const resCPSame = await changePasswordHandler(
      new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
        body: JSON.stringify({
          currentPassword: "Champions2026!",
          newPassword: "Champions2026!",
          confirmPassword: "Champions2026!",
        }),
      })
    );
    assert(resCPSame.status === 400, "change-password with identical password returns 400");

    // 4.8b Successful password change (lines 88-115)
    const resCPSuccess = await changePasswordHandler(
      new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
        body: JSON.stringify({
          currentPassword: "Champions2026!",
          newPassword: "NewValidPassword2026!",
          confirmPassword: "NewValidPassword2026!",
        }),
      })
    );
    assert(resCPSuccess.status === 200, "Valid password change returns 200");

    // 4.9 Catch block (lines 117-122)
    const resCPCatch = await changePasswordHandler(
      new NextRequest("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
        body: "malformed-json{",
      })
    );
    assert(resCPCatch.status === 500, "change-password malformed json triggers catch block returning 500");

    // ==========================================
    // 5. GET /api/auth/audit
    // ==========================================
    console.log("\n[5] Testing GET /api/auth/audit...");
    // 5.1 Without token (line 9-10)
    const resAuditNoToken = await auditHandler(new NextRequest("http://localhost:3000/api/auth/audit"));
    assert(resAuditNoToken.status === 401, "audit without token returns 401");

    // 5.2 Non-OWNER role (lines 14-18)
    const resAuditMember = await auditHandler(
      new NextRequest("http://localhost:3000/api/auth/audit", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
      })
    );
    assert(resAuditMember.status === 403, "audit with non-OWNER returns 403");

    // 5.3 OWNER role (success)
    const resAuditOwner = await auditHandler(
      new NextRequest("http://localhost:3000/api/auth/audit", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
      })
    );
    assert(resAuditOwner.status === 200, "audit with OWNER returns 200");

    // 5.4 Catch block (lines 40-44)
    const origAuditFindMany = prisma.authAuditLog.findMany;
    (prisma.authAuditLog as any).findMany = async () => {
      throw new Error("Simulated audit query error");
    };
    const resAuditCatch = await auditHandler(
      new NextRequest("http://localhost:3000/api/auth/audit", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
      })
    );
    prisma.authAuditLog.findMany = origAuditFindMany;
    assert(resAuditCatch.status === 500, "audit query error triggers catch block returning 500");
  } finally {
    // Cleanup
    await prisma.session.deleteMany({ where: { userId: { in: [testOwner.id, testMember.id] } } }).catch(() => {});
    await prisma.authAuditLog.deleteMany({ where: { userId: { in: [testOwner.id, testMember.id] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [testOwner.id, testMember.id] } } }).catch(() => {});
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runAuthRoutesWhitebox().catch((err) => {
  console.error("Auth routes whitebox test failed:", err);
  process.exit(1);
});
