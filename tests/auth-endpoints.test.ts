import { NextRequest } from "next/server";
import { POST as loginHandler } from "../src/app/api/auth/login/route";
import { POST as logoutHandler } from "../src/app/api/auth/logout/route";
import { POST as changePasswordHandler } from "../src/app/api/auth/change-password/route";
import { GET as auditHandler } from "../src/app/api/auth/audit/route";
import { prisma } from "../src/lib/db";
import { authRateLimiter } from "../src/lib/rate-limiter";
import { SESSION_COOKIE_NAME } from "../src/lib/auth-token";
import bcrypt from "bcryptjs";

async function runEndpointsTest() {
  console.log("=== STARTING AUTH API ENDPOINTS TEST SUITE ===");
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

  // Create an isolated test OWNER user so demo data (Farhan Merchant) is never touched
  const testOwnerEmail = `test.endpoint.owner.${Date.now()}@champions.club`;
  const defaultHash = await bcrypt.hash("password123", 10);
  const testOwner = await prisma.user.create({
    data: {
      email: testOwnerEmail,
      password: defaultHash,
      name: "Test Endpoint Owner",
      role: "OWNER",
    },
  });

  const bruteEmail = `brute-${Date.now()}@test.com`;
  let bruteIp = `192.168.10.${Math.floor(Math.random() * 200)}`;

  try {
    // 1. Test Valid Login with credentials
    console.log("\n[1] Testing POST /api/auth/login with valid credentials...");
    authRateLimiter.reset("ip:127.0.0.1");
    authRateLimiter.reset(`id:${testOwnerEmail}`);

    const reqValidLogin = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testOwnerEmail,
        password: "password123",
        rememberMe: true,
      }),
    });

    const resValidLogin = await loginHandler(reqValidLogin);
    assert(resValidLogin.status === 200, "Valid login returns HTTP 200");
    const validData = await resValidLogin.json();
    assert(validData.success === true, "Valid login response success = true");
    assert(validData.user.role === "OWNER", "User role correctly resolved as OWNER");

    const sessionCookie = resValidLogin.cookies.get(SESSION_COOKIE_NAME);
    assert(sessionCookie !== undefined, "Session cookie cc_session was set in response");
    assert(sessionCookie?.httpOnly === true, "Session cookie is HttpOnly");
    assert(sessionCookie?.sameSite === "lax", "Session cookie sameSite is lax");

    // 2. Test Failed Login & Brute Force Rate Limiting
    console.log("\n[2] Testing failed login & brute force lockout defense...");

    for (let i = 1; i <= 5; i++) {
      const reqFail = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": bruteIp,
        },
        body: JSON.stringify({
          email: bruteEmail,
          password: "wrongpassword",
        }),
      });
      const resFail = await loginHandler(reqFail);
      if (i < 5) {
        assert(resFail.status === 401, `Failed attempt ${i} returns 401`);
      } else {
        assert(resFail.status === 401, `5th attempt returns 401 (last attempt before lockout)`);
      }
    }

    // 6th attempt must trigger 429 Too Many Requests
    const reqLocked = new NextRequest("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": bruteIp,
      },
      body: JSON.stringify({
        email: bruteEmail,
        password: "wrongpassword",
      }),
    });
    const resLocked = await loginHandler(reqLocked);
    assert(resLocked.status === 429, "6th attempt blocked with HTTP 429 Too Many Requests");
    assert(resLocked.headers.get("Retry-After") !== null, "Retry-After header present in 429 response");
    const lockData = await resLocked.json();
    assert(lockData.retryAfter > 0, "retryAfter seconds included in JSON body");

    // 3. Test Password Change Endpoint
    console.log("\n[3] Testing POST /api/auth/change-password...");
    const cookieHeader = `${SESSION_COOKIE_NAME}=${sessionCookie?.value}`;

    // 3a. Weak password rejection
    const reqWeakPwd = new NextRequest("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        currentPassword: "password123",
        newPassword: "weak",
        confirmPassword: "weak",
      }),
    });
    const resWeakPwd = await changePasswordHandler(reqWeakPwd);
    assert(resWeakPwd.status === 400, "Weak password rejected with 400");

    // 3b. Mismatched confirmation rejection
    const reqMismatchPwd = new NextRequest("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        currentPassword: "password123",
        newPassword: "ChampionsClub2026!",
        confirmPassword: "ChampionsClub2026!Different",
      }),
    });
    const resMismatchPwd = await changePasswordHandler(reqMismatchPwd);
    assert(resMismatchPwd.status === 400, "Mismatched confirmation rejected with 400");

    // 3c. Wrong current password rejection
    const reqWrongCurrentPwd = new NextRequest("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        currentPassword: "IncorrectCurrentPassword123!",
        newPassword: "ChampionsClub2026!",
        confirmPassword: "ChampionsClub2026!",
      }),
    });
    const resWrongCurrentPwd = await changePasswordHandler(reqWrongCurrentPwd);
    assert(resWrongCurrentPwd.status === 401, "Incorrect current password rejected with 401");

    // 3d. Valid password update
    const reqValidPwdChange = new NextRequest("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: cookieHeader,
      },
      body: JSON.stringify({
        currentPassword: "password123",
        newPassword: "ChampionsClub2026!",
        confirmPassword: "ChampionsClub2026!",
      }),
    });
    const resValidPwdChange = await changePasswordHandler(reqValidPwdChange);
    assert(resValidPwdChange.status === 200, "Valid password update returns 200");
    const changeData = await resValidPwdChange.json();
    assert(changeData.success === true, "Change password response success = true");

    // 4. Test Audit Log API
    console.log("\n[4] Testing GET /api/auth/audit...");
    const reqAudit = new NextRequest("http://localhost:3000/api/auth/audit", {
      headers: { cookie: cookieHeader },
    });
    const resAudit = await auditHandler(reqAudit);
    assert(resAudit.status === 200, "OWNER can retrieve audit logs via GET /api/auth/audit");
    const auditData = await resAudit.json();
    assert(auditData.success === true && Array.isArray(auditData.logs), "Audit logs array returned");
    const eventTypes = auditData.logs.map((l: any) => l.eventType);
    assert(eventTypes.includes("LOGIN_SUCCESS"), "Audit logs contain LOGIN_SUCCESS");
    assert(eventTypes.includes("PASSWORD_CHANGE"), "Audit logs contain PASSWORD_CHANGE");
    assert(eventTypes.includes("RATE_LIMITED"), "Audit logs contain RATE_LIMITED");

    // 5. Test Logout Endpoint
    console.log("\n[5] Testing POST /api/auth/logout...");
    const reqLogout = new NextRequest("http://localhost:3000/api/auth/logout", {
      method: "POST",
      headers: { cookie: cookieHeader },
    });
    const resLogout = await logoutHandler(reqLogout);
    assert(resLogout.status === 200, "Logout returns 200");
  } finally {
    // Isolated fixture cleanup: only clean up testOwner and brute test records
    if (testOwner?.id && typeof testOwner.id === "string") {
      await prisma.session.deleteMany({ where: { userId: testOwner.id } }).catch(() => {});
      await prisma.authAuditLog.deleteMany({ where: { userId: testOwner.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testOwner.id } }).catch(() => {});
    }
    if (testOwnerEmail) {
      await prisma.authAuditLog.deleteMany({ where: { email: testOwnerEmail } }).catch(() => {});
      authRateLimiter.reset(`id:${testOwnerEmail}`);
    }
    if (bruteEmail) {
      await prisma.authAuditLog.deleteMany({ where: { email: bruteEmail } }).catch(() => {});
      authRateLimiter.reset(`id:${bruteEmail}`);
    }
    if (bruteIp) {
      authRateLimiter.reset(`ip:${bruteIp}`);
    }
    authRateLimiter.reset("ip:127.0.0.1");
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runEndpointsTest().catch((err) => {
  console.error("Endpoint test failed:", err);
  process.exit(1);
});
