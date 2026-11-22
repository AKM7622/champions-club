import { computeSafeDestination } from "../src/lib/utils";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/auth-token";

async function runLoginPageTests() {
  console.log("=== STARTING LOGIN PAGE & DESTINATION SANITIZATION TEST SUITE ===");
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

  // 1. Destination computation & Open Redirect Defense
  console.log("\n[1] Testing computeSafeDestination open-redirect defense...");
  assert(computeSafeDestination(null) === "/", "null falls back to /");
  assert(computeSafeDestination(undefined) === "/", "undefined falls back to /");
  assert(computeSafeDestination("") === "/", "empty string falls back to /");
  assert(computeSafeDestination("   ") === "/", "whitespace-only falls back to /");
  assert(computeSafeDestination("/") === "/", "root / is preserved");
  assert(computeSafeDestination("/dashboard") === "/dashboard", "/dashboard is preserved");
  assert(computeSafeDestination("/memberships") === "/memberships", "/memberships is preserved");
  assert(computeSafeDestination("/join?tier=GOLD") === "/join?tier=GOLD", "query parameters are preserved");

  // Attack vectors
  assert(computeSafeDestination("https://evil.com") === "/", "https://evil.com is blocked");
  assert(computeSafeDestination("http://evil.com") === "/", "http://evil.com is blocked");
  assert(computeSafeDestination("//attacker.com") === "/", "protocol-relative //attacker.com is blocked");
  assert(computeSafeDestination("/\\attacker.com") === "/", "backslash /\\attacker.com is blocked");
  assert(computeSafeDestination("\\attacker.com") === "/", "backslash \\attacker.com is blocked");
  assert(computeSafeDestination("javascript:alert(1)") === "/", "javascript: URI is blocked");
  assert(computeSafeDestination("data:text/html,<script>alert(1)</script>") === "/", "data: URI is blocked");
  assert(computeSafeDestination("  https://evil.com") === "/", "padded https://evil.com is blocked");

  // Loopback / login loops
  assert(computeSafeDestination("/login") === "/", "/login falls back to / to prevent loops");
  assert(computeSafeDestination("/login/reset") === "/", "/login/* falls back to /");
  assert(computeSafeDestination("/login?callbackUrl=/dashboard") === "/", "/login with query falls back to /");

  // 2. Middleware verification for /login with various session states
  console.log("\n[2] Testing middleware behavior on /login across session states...");
  const ownerToken = await signSessionToken({
    sessionToken: "owner-sess-test",
    userId: "user-owner-1",
    role: "OWNER",
    exp: Date.now() + 3600000,
  });

  const memberToken = await signSessionToken({
    sessionToken: "member-sess-test",
    userId: "user-member-1",
    role: "MEMBER",
    exp: Date.now() + 3600000,
  });

  const expiredToken = await signSessionToken({
    sessionToken: "expired-sess-test",
    userId: "user-expired-1",
    role: "MEMBER",
    exp: Date.now() - 3600000,
  });

  // Unauthenticated /login
  const resUnauth = await middleware(new NextRequest("http://localhost:3000/login"));
  assert(resUnauth.status === 200, "Unauthenticated GET /login returns HTTP 200 (not redirected)");

  // Unauthenticated /login/ (trailing slash)
  const resUnauthTrailing = await middleware(new NextRequest("http://localhost:3000/login/"));
  assert(resUnauthTrailing.status === 200, "Unauthenticated GET /login/ returns HTTP 200 (not redirected)");

  // Authenticated OWNER on /login
  const resOwner = await middleware(new NextRequest("http://localhost:3000/login", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  }));
  assert(resOwner.status === 200, "Authenticated OWNER on /login returns HTTP 200 (not redirected)");

  // Authenticated MEMBER on /login
  const resMember = await middleware(new NextRequest("http://localhost:3000/login", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
  }));
  assert(resMember.status === 200, "Authenticated MEMBER on /login returns HTTP 200 (not redirected)");

  // Authenticated /login/ (trailing slash)
  const resAuthTrailing = await middleware(new NextRequest("http://localhost:3000/login/", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  }));
  assert(resAuthTrailing.status === 200, "Authenticated user on /login/ returns HTTP 200 (not redirected)");

  // Expired session cookie on /login
  const resExpired = await middleware(new NextRequest("http://localhost:3000/login", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${expiredToken}` },
  }));
  assert(resExpired.status === 200, "Expired session cookie on /login returns HTTP 200 (not redirected)");

  // Tampered session cookie on /login
  const resTampered = await middleware(new NextRequest("http://localhost:3000/login", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=tampered.cookie.value` },
  }));
  assert(resTampered.status === 200, "Tampered session cookie on /login returns HTTP 200 (not redirected)");

  // Authenticated with valid and malicious callbackUrl queries
  const resValidQuery = await middleware(new NextRequest("http://localhost:3000/login?callbackUrl=/dashboard", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  }));
  assert(resValidQuery.status === 200, "Authenticated /login?callbackUrl=/dashboard returns HTTP 200 (not redirected)");

  const resMaliciousQuery = await middleware(new NextRequest("http://localhost:3000/login?callbackUrl=https://evil.com", {
    headers: { cookie: `${SESSION_COOKIE_NAME}=${ownerToken}` },
  }));
  assert(resMaliciousQuery.status === 200, "Authenticated /login?callbackUrl=https://evil.com returns HTTP 200 (not redirected)");

  // 3. React Component structure validation
  console.log("\n[3] Testing LoginPage component definition & structure...");
  const LoginPage = (await import("../src/app/login/page")).default;
  assert(typeof LoginPage === "function", "LoginPage is exported as a default function component");

  const element = LoginPage();
  assert(element !== null && typeof element === "object", "LoginPage() returns a valid React element");
  assert(element.type !== undefined, "LoginPage root is a valid React component (Suspense)");

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runLoginPageTests().catch((err) => {
  console.error("Unhandled error in login page tests:", err);
  process.exit(1);
});
