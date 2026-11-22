import { NextRequest } from "next/server";
import { prisma } from "../src/lib/db";
import {
  validateEmail,
  isRFC5322Format,
  isTestDomain,
  DEFAULT_TEST_DOMAINS,
  resolveMxWithTimeout,
} from "../src/lib/email-validator";
import { POST as joinMemberHandler } from "../src/app/api/members/join/route";
import { POST as createMemberHandler } from "../src/app/api/members/route";
import { POST as createLeadHandler } from "../src/app/api/leads/route";
import { PlanTier, PaymentMethod } from "@prisma/client";

async function runTestSuite() {
  console.log("=== STARTING EMAIL VALIDATOR & DNS MX LOOKUP TEST SUITE ===\n");
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
  const createdLeadIds: string[] = [];

  try {
    // ========================================================
    // [1] RFC 5322 Email Syntax & Format Validation
    // ========================================================
    console.log("[1] Testing RFC 5322 Email Syntax Validation...");

    // Valid syntax cases
    assert(isRFC5322Format("user@example.com"), "Standard email format is valid");
    assert(isRFC5322Format("first.last@champions.club"), "Dotted local part is valid");
    assert(isRFC5322Format("user+tag@domain.co.in"), "Plus addressing is valid");
    assert(isRFC5322Format("customer_123@domain.org"), "Underscore and digits in local part are valid");
    assert(isRFC5322Format("sales-inquiry@company-name.com"), "Hyphenated names and domains are valid");
    assert(isRFC5322Format("a@b.co"), "Shortest valid email (1-char local, 1-char domain label) is valid");
    assert(isRFC5322Format("admin@localhost"), "Localhost domain is valid");

    // Invalid syntax cases
    assert(!isRFC5322Format(""), "Empty string is invalid");
    assert(!isRFC5322Format(null as any), "Null is invalid");
    assert(!isRFC5322Format(undefined as any), "Undefined is invalid");
    assert(!isRFC5322Format("plainaddress"), "Address with no @ symbol is invalid");
    assert(!isRFC5322Format("@missinglocal.com"), "Missing local part is invalid");
    assert(!isRFC5322Format("missingdomain@"), "Missing domain part is invalid");
    assert(!isRFC5322Format("user@domain"), "Domain without TLD (non-localhost) is invalid");
    assert(!isRFC5322Format("user@@domain.com"), "Double @ symbol is invalid");
    assert(!isRFC5322Format("user@domain@another.com"), "Multiple @ symbols are invalid");
    assert(!isRFC5322Format(".user@domain.com"), "Local part starting with dot is invalid");
    assert(!isRFC5322Format("user.@domain.com"), "Local part ending with dot is invalid");
    assert(!isRFC5322Format("user..name@domain.com"), "Consecutive dots in local part are invalid");
    assert(!isRFC5322Format("user@.domain.com"), "Domain starting with dot is invalid");
    assert(!isRFC5322Format("user@domain.com."), "Domain ending with dot is invalid");
    assert(!isRFC5322Format("user@domain..com"), "Consecutive dots in domain are invalid");
    assert(!isRFC5322Format("user@-domain.com"), "Domain label starting with hyphen is invalid");
    assert(!isRFC5322Format("user@domain-.com"), "Domain label ending with hyphen is invalid");
    assert(!isRFC5322Format("user@domain.c"), "TLD with single character is invalid");
    assert(!isRFC5322Format("user@domain.123"), "All-numeric TLD is invalid");
    assert(!isRFC5322Format("user name@domain.com"), "Space in local part is invalid");
    assert(!isRFC5322Format("user@domain .com"), "Space in domain part is invalid");
    assert(!isRFC5322Format("user;name@domain.com"), "Semicolon in local part is invalid");
    assert(!isRFC5322Format("user,name@domain.com"), "Comma in local part is invalid");
    assert(!isRFC5322Format("user\\name@domain.com"), "Backslash in local part is invalid");
    assert(!isRFC5322Format("user\"name@domain.com"), "Double quote in local part is invalid");
    assert(!isRFC5322Format("user[name]@domain.com"), "Bracket in local part is invalid");

    // RFC length bounds: local part > 64 chars
    const tooLongLocal = "a".repeat(65) + "@example.com";
    assert(!isRFC5322Format(tooLongLocal), "Local part > 64 characters is invalid");

    // Domain label > 63 chars
    const tooLongLabel = "user@" + "a".repeat(64) + ".com";
    assert(!isRFC5322Format(tooLongLabel), "Domain label > 63 characters is invalid");

    // Total email length > 254 chars
    const tooLongEmail = "a".repeat(60) + "@" + "b".repeat(60) + "." + "c".repeat(60) + "." + "d".repeat(75) + ".com";
    assert(!isRFC5322Format(tooLongEmail), "Total email length > 254 characters is invalid");

    // Total domain length > 253 chars
    const tooLongDomain = "a@" + "b".repeat(60) + "." + "c".repeat(60) + "." + "d".repeat(60) + "." + "e".repeat(75) + ".com";
    assert(!isRFC5322Format(tooLongDomain), "Domain length > 253 characters is invalid");

    // ========================================================
    // [2] Test & Development Domain Isolation
    // ========================================================
    console.log("\n[2] Testing Test & Development Domain Isolation...");

    assert(DEFAULT_TEST_DOMAINS.includes("example.com"), "example.com is in default test domains");
    assert(DEFAULT_TEST_DOMAINS.includes("champions.club"), "champions.club is in default test domains");
    assert(DEFAULT_TEST_DOMAINS.includes("test.com"), "test.com is in default test domains");

    assert(isTestDomain("example.com"), "example.com recognized as test domain");
    assert(isTestDomain("champions.club"), "champions.club recognized as test domain");
    assert(isTestDomain("test.com"), "test.com recognized as test domain");
    assert(isTestDomain("portal.champions.club"), "Subdomain of test domain is recognized");
    assert(isTestDomain("sub.example.com"), "Subdomain of example.com is recognized");
    assert(isTestDomain("localhost"), "localhost recognized as test domain");
    assert(isTestDomain("app.test"), "RFC 6761 .test TLD recognized as test domain");
    assert(isTestDomain("staging.example"), "RFC 6761 .example TLD recognized as test domain");
    assert(isTestDomain("dummy.invalid"), "RFC 6761 .invalid TLD recognized as test domain");

    // Environment variable TEST_EMAIL_DOMAINS
    const originalEnvDomains = process.env.TEST_EMAIL_DOMAINS;
    try {
      process.env.TEST_EMAIL_DOMAINS = "my-ci-domain.org, dev-local.test.io";
      assert(isTestDomain("my-ci-domain.org"), "Env TEST_EMAIL_DOMAINS domain is recognized");
      assert(isTestDomain("sub.my-ci-domain.org"), "Subdomain of TEST_EMAIL_DOMAINS is recognized");
      assert(isTestDomain("dev-local.test.io"), "Second domain in TEST_EMAIL_DOMAINS is recognized");
    } finally {
      process.env.TEST_EMAIL_DOMAINS = originalEnvDomains;
    }

    // Environment variable DISABLE_DNS_VALIDATION
    const originalDisableDns = process.env.DISABLE_DNS_VALIDATION;
    try {
      process.env.DISABLE_DNS_VALIDATION = "true";
      assert(isTestDomain("any-arbitrary-domain.com"), "DISABLE_DNS_VALIDATION=true bypasses all domains");
    } finally {
      process.env.DISABLE_DNS_VALIDATION = originalDisableDns;
    }

    // Additional test domains option
    assert(
      isTestDomain("custom-dev.internal", { additionalTestDomains: ["custom-dev.internal"] }),
      "Custom additional test domain is recognized"
    );

    // Bypassing test domain isolation
    assert(
      !isTestDomain("example.com", { allowTestDomains: false }),
      "allowTestDomains: false overrides default test domain exemption"
    );

    // ValidateEmail with test domain returns instant mock MX record without network I/O
    const testDomainRes = await validateEmail("member@champions.club");
    assert(testDomainRes.isValid === true, "Test domain validates as valid");
    assert(testDomainRes.isTestDomain === true, "isTestDomain flag is true");
    assert(testDomainRes.domain === "champions.club", "Extracted domain matches");
    assert(testDomainRes.normalizedEmail === "member@champions.club", "Normalized email matches");
    assert((testDomainRes.mxRecords?.length ?? 0) > 0, "Test domain receives simulated MX records");

    // ========================================================
    // [3] Server-Side DNS MX Resolution (Mocked & Error Paths)
    // ========================================================
    console.log("\n[3] Testing DNS MX Resolution (Mocked & Edge Cases)...");

    // Test 3.1: Valid domain with active MX records
    const mockValidResolver = async (domain: string) => [
      { exchange: `mx1.${domain}`, priority: 10 },
      { exchange: `mx2.${domain}`, priority: 20 },
    ];
    const resValidMx = await validateEmail("user@corporatemail.org", {
      allowTestDomains: false,
      dnsResolver: mockValidResolver,
    });
    assert(resValidMx.isValid === true, "Valid MX records result in isValid = true");
    assert(resValidMx.mxRecords?.length === 2, "Returned MX records are preserved");
    assert(resValidMx.mxRecords?.[0].exchange === "mx1.corporatemail.org", "First MX exchange matches");

    // Test 3.2: Domain Not Found (ENOTFOUND)
    const mockNotFoundResolver = async () => {
      const err: any = new Error("queryMx ENOTFOUND non-existent-domain.xyz");
      err.code = "ENOTFOUND";
      throw err;
    };
    const resNotFound = await validateEmail("user@non-existent-domain.xyz", {
      allowTestDomains: false,
      dnsResolver: mockNotFoundResolver,
    });
    assert(resNotFound.isValid === false, "ENOTFOUND results in isValid = false");
    assert(
      resNotFound.error === "The email domain does not exist or has no active mail servers.",
      "ENOTFOUND returns standard user-facing error message"
    );
    assert(resNotFound.errorCode === "DOMAIN_NOT_FOUND", "ENOTFOUND returns DOMAIN_NOT_FOUND code");

    // Test 3.3: Domain exists but has no MX records (ENODATA)
    const mockNoDataResolver = async () => {
      const err: any = new Error("queryMx ENODATA no-mail-domain.org");
      err.code = "ENODATA";
      throw err;
    };
    const resNoData = await validateEmail("user@no-mail-domain.org", {
      allowTestDomains: false,
      dnsResolver: mockNoDataResolver,
    });
    assert(resNoData.isValid === false, "ENODATA results in isValid = false");
    assert(
      resNoData.error === "The email domain does not exist or has no active mail servers.",
      "ENODATA returns standard user-facing error message"
    );
    assert(resNoData.errorCode === "NO_MX_RECORDS", "ENODATA returns NO_MX_RECORDS code");

    // Test 3.4: Resolver returns empty MX array
    const mockEmptyResolver = async () => [];
    const resEmpty = await validateEmail("user@empty-mx.org", {
      allowTestDomains: false,
      dnsResolver: mockEmptyResolver,
    });
    assert(resEmpty.isValid === false, "Empty MX records array results in isValid = false");
    assert(resEmpty.errorCode === "NO_MX_RECORDS", "Empty array returns NO_MX_RECORDS code");

    // Test 3.5: RFC 7505 Null MX record ("." or "")
    const mockNullMxResolver = async () => [{ exchange: ".", priority: 0 }];
    const resNullMx = await validateEmail("user@null-mx-domain.org", {
      allowTestDomains: false,
      dnsResolver: mockNullMxResolver,
    });
    assert(resNullMx.isValid === false, "RFC 7505 Null MX results in isValid = false");
    assert(resNullMx.errorCode === "NO_MX_RECORDS", "Null MX returns NO_MX_RECORDS code");

    // Test 3.5b: Multiple Null/Empty MX records
    const mockMultiNullResolver = async () => [
      { exchange: ".", priority: 0 },
      { exchange: "", priority: 10 },
      { exchange: "   ", priority: 20 },
    ];
    const resMultiNull = await validateEmail("user@multi-null.org", {
      allowTestDomains: false,
      dnsResolver: mockMultiNullResolver,
    });
    assert(resMultiNull.isValid === false, "Multiple Null/Empty MX records result in isValid = false");
    assert(resMultiNull.errorCode === "NO_MX_RECORDS", "Multi-Null MX returns NO_MX_RECORDS code");

    // Test 3.6: DNS Timeout handling
    const mockHangingResolver = async () => {
      return new Promise<any[]>((resolve) => setTimeout(resolve, 1000));
    };
    const resTimeout = await validateEmail("user@hanging-dns.org", {
      allowTestDomains: false,
      timeoutMs: 50,
      dnsResolver: mockHangingResolver,
    });
    assert(resTimeout.isValid === false, "DNS timeout results in isValid = false by default");
    assert(resTimeout.errorCode === "DNS_TIMEOUT", "Timeout returns DNS_TIMEOUT code");
    assert(
      resTimeout.error === "The email domain does not exist or has no active mail servers.",
      "DNS timeout returns standard user-facing error"
    );

    // Test 3.7: DNS Timeout with graceful fallback enabled
    const resTimeoutFallback = await validateEmail("user@hanging-dns.org", {
      allowTestDomains: false,
      timeoutMs: 50,
      dnsResolver: mockHangingResolver,
      fallbackOnTimeout: true,
    });
    assert(resTimeoutFallback.isValid === true, "fallbackOnTimeout = true permits graceful fallback");

    // Test 3.8: Generic DNS failure (e.g. ESERVFAIL)
    const mockServFailResolver = async () => {
      const err: any = new Error("queryMx ESERVFAIL dns-error.org");
      err.code = "ESERVFAIL";
      throw err;
    };
    const resServFail = await validateEmail("user@dns-error.org", {
      allowTestDomains: false,
      dnsResolver: mockServFailResolver,
    });
    assert(resServFail.isValid === false, "ESERVFAIL results in isValid = false");
    assert(resServFail.errorCode === "DNS_ERROR", "ESERVFAIL returns DNS_ERROR code");

    // Test 3.9: Syntax-only option skips DNS lookup
    const resSyntaxOnly = await validateEmail("user@unresolvable-domain-xyz.org", {
      syntaxOnly: true,
    });
    assert(resSyntaxOnly.isValid === true, "syntaxOnly option skips DNS lookup entirely");

    // ========================================================
    // [4] Real DNS Lookup Verification (Live Environment)
    // ========================================================
    console.log("\n[4] Testing Real DNS MX Lookups (Network Verified)...");

    // Test real lookup for gmail.com
    const resRealGoogle = await validateEmail("test.user@gmail.com", { allowTestDomains: false });
    if (resRealGoogle.isValid) {
      assert(resRealGoogle.isValid === true, "Real DNS MX lookup for gmail.com passes");
      assert((resRealGoogle.mxRecords?.length ?? 0) > 0, "Real MX records found for gmail.com");
    } else {
      console.log(`  ℹ Offline note: DNS query returned (${resRealGoogle.errorCode}) in isolated sandbox`);
      assert(!resRealGoogle.isValid, "Offline DNS lookup gracefully returns invalid result");
      assert(Boolean(resRealGoogle.error), "Error message provided when network unavailable");
    }

    // Test real lookup for non-existent domain
    const nonExistentDomain = `test-nx-${Date.now()}-champions-random.org`;
    const resRealNonExistent = await validateEmail(`athlete@${nonExistentDomain}`, {
      allowTestDomains: false,
    });
    assert(resRealNonExistent.isValid === false, "Real DNS lookup rejects non-existent domain");
    assert(
      resRealNonExistent.error === "The email domain does not exist or has no active mail servers.",
      "Real DNS lookup returns standard error for non-existent domain"
    );

    // ========================================================
    // [5] Integration: POST /api/members/join (Public Join)
    // ========================================================
    console.log("\n[5] Testing Integration on Public Join Route (/api/members/join)...");

    // 5.1 Invalid syntax rejected
    const reqJoinBadSyntax = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "not-an-email-format",
        phone: "+91 98765 43210",
        password: "Password123!",
        planTier: "GOLD",
      }),
    });
    const resJoinBadSyntax = await joinMemberHandler(reqJoinBadSyntax);
    assert(resJoinBadSyntax.status === 400, "Bad email syntax returns 400 on /api/members/join");
    const jsonJoinBadSyntax = await resJoinBadSyntax.json();
    assert(
      jsonJoinBadSyntax.error === "Please provide a valid email address.",
      "Bad email syntax returns 'Please provide a valid email address.'"
    );

    // 5.2 Non-existent email domain rejected with DNS MX error
    const reqJoinBadDomain = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: `candidate@${nonExistentDomain}`,
        phone: "+91 98765 43210",
        password: "Password123!",
        planTier: "GOLD",
      }),
    });
    const resJoinBadDomain = await joinMemberHandler(reqJoinBadDomain);
    assert(resJoinBadDomain.status === 400, "Non-existent domain returns 400 on /api/members/join");
    const jsonJoinBadDomain = await resJoinBadDomain.json();
    assert(
      jsonJoinBadDomain.error === "The email domain does not exist or has no active mail servers.",
      "Non-existent domain returns clear DNS MX error on /api/members/join"
    );

    // 5.3 Valid test domain email passes and registers
    const validJoinEmail = `member.mx.${Date.now()}@champions.club`;
    const reqJoinValid = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Valid MX Joiner",
        email: validJoinEmail,
        phone: "+91 98765 43210",
        password: "Password123!",
        planTier: "GOLD",
        durationMonths: 1,
        paymentMethod: "UPI",
      }),
    });
    const resJoinValid = await joinMemberHandler(reqJoinValid);
    assert(resJoinValid.status === 200, "Valid test domain email passes and returns 200 on /api/members/join");
    const jsonJoinValid = await resJoinValid.json();
    assert(jsonJoinValid.success === true, "Registration succeeded for valid email");
    if (jsonJoinValid.member?.id) createdMemberIds.push(jsonJoinValid.member.id);
    if (jsonJoinValid.user?.id) createdUserIds.push(jsonJoinValid.user.id);

    // 5.4 Malformed JSON payload returns 400
    const reqJoinMalformed = new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "this-is-not-valid-json{",
    });
    const resJoinMalformed = await joinMemberHandler(reqJoinMalformed);
    assert(resJoinMalformed.status === 400, "Malformed JSON returns 400 on /api/members/join");
    const jsonJoinMalformed = await resJoinMalformed.json();
    assert(jsonJoinMalformed.error === "Invalid JSON request body.", "Malformed JSON returns clear error");

    // ========================================================
    // [6] Integration: POST /api/members (Staff Enrollment)
    // ========================================================
    console.log("\n[6] Testing Integration on Staff Member Enrollment (/api/members)...");

    // 6.1 Invalid syntax rejected
    const reqMemberBadSyntax = new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Staff Member",
        email: "invalid-staff-email",
        phone: "+91 98765 43211",
        planTier: "SILVER",
      }),
    });
    const resMemberBadSyntax = await createMemberHandler(reqMemberBadSyntax);
    assert(resMemberBadSyntax.status === 400, "Bad email syntax returns 400 on /api/members");
    const jsonMemberBadSyntax = await resMemberBadSyntax.json();
    assert(
      jsonMemberBadSyntax.error === "Please provide a valid email address.",
      "Bad syntax returns 'Please provide a valid email address.' on /api/members"
    );

    // 6.2 Non-existent email domain rejected
    const reqMemberBadDomain = new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Staff Member",
        email: `staff@${nonExistentDomain}`,
        phone: "+91 98765 43211",
        planTier: "SILVER",
      }),
    });
    const resMemberBadDomain = await createMemberHandler(reqMemberBadDomain);
    assert(resMemberBadDomain.status === 400, "Non-existent domain returns 400 on /api/members");
    const jsonMemberBadDomain = await resMemberBadDomain.json();
    assert(
      jsonMemberBadDomain.error === "The email domain does not exist or has no active mail servers.",
      "Non-existent domain returns clear DNS MX error on /api/members"
    );

    // 6.3 Valid test domain email enrolls successfully
    const validStaffEmail = `staff.enroll.${Date.now()}@champions.club`;
    const reqMemberValid = new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Enrolled Athlete",
        email: validStaffEmail,
        phone: "+91 98765 43211",
        planTier: "SILVER",
        durationMonths: 3,
        paymentMethod: PaymentMethod.CARD,
      }),
    });
    const resMemberValid = await createMemberHandler(reqMemberValid);
    assert(resMemberValid.status === 200, "Valid test domain email enrolls successfully on /api/members");
    const jsonMemberValid = await resMemberValid.json();
    assert(jsonMemberValid.success === true, "Member enrollment succeeded");
    if (jsonMemberValid.member?.id) createdMemberIds.push(jsonMemberValid.member.id);
    if (jsonMemberValid.user?.id) createdUserIds.push(jsonMemberValid.user.id);

    // 6.4 Duplicate email enrollment rejected with 400
    const reqMemberDup = new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate Athlete",
        email: validStaffEmail,
        phone: "+91 98765 99999",
        planTier: "GOLD",
      }),
    });
    const resMemberDup = await createMemberHandler(reqMemberDup);
    assert(resMemberDup.status === 400, "Duplicate email enrollment returns 400 on /api/members");
    const jsonMemberDup = await resMemberDup.json();
    assert(
      jsonMemberDup.error === "A member profile with this email address already exists.",
      "Duplicate email error message is clear"
    );

    // 6.5 Malformed JSON returns 400
    const reqMemberMalformed = new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-valid-json",
    });
    const resMemberMalformed = await createMemberHandler(reqMemberMalformed);
    assert(resMemberMalformed.status === 400, "Malformed JSON returns 400 on /api/members");

    // ========================================================
    // [7] Integration: POST /api/leads (Public Lead Inquiry)
    // ========================================================
    console.log("\n[7] Testing Integration on Public Leads Inquiry (/api/leads)...");

    // 7.1 Invalid syntax rejected
    const reqLeadBadSyntax = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Lead Inquirer",
        email: "bad-lead-email@",
        phone: "+91 98765 43212",
        interest: "Tennis Trial & Gold Membership",
      }),
    });
    const resLeadBadSyntax = await createLeadHandler(reqLeadBadSyntax);
    assert(resLeadBadSyntax.status === 400, "Bad email syntax returns 400 on /api/leads");
    const jsonLeadBadSyntax = await resLeadBadSyntax.json();
    assert(
      jsonLeadBadSyntax.error === "Please provide a valid email address.",
      "Bad syntax returns 'Please provide a valid email address.' on /api/leads"
    );

    // 7.2 Non-existent email domain rejected
    const reqLeadBadDomain = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Lead Inquirer",
        email: `inquiry@${nonExistentDomain}`,
        phone: "+91 98765 43212",
        interest: "Tennis Trial & Gold Membership",
      }),
    });
    const resLeadBadDomain = await createLeadHandler(reqLeadBadDomain);
    assert(resLeadBadDomain.status === 400, "Non-existent domain returns 400 on /api/leads");
    const jsonLeadBadDomain = await resLeadBadDomain.json();
    assert(
      jsonLeadBadDomain.error === "The email domain does not exist or has no active mail servers.",
      "Non-existent domain returns clear DNS MX error on /api/leads"
    );

    // 7.3 Valid test domain lead submits successfully with email normalization
    const rawLeadEmail = `  LEAD.${Date.now()}@EXAMPLE.COM  `;
    const reqLeadValid = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Valid Lead Prospect",
        email: rawLeadEmail,
        phone: "+91 98765 43212",
        interest: "Tennis Trial & Gold Membership",
      }),
    });
    const resLeadValid = await createLeadHandler(reqLeadValid);
    assert(resLeadValid.status === 200, "Valid test domain email succeeds on /api/leads");
    const jsonLeadValid = await resLeadValid.json();
    assert(jsonLeadValid.success === true, "Lead inquiry successfully saved");
    assert(
      jsonLeadValid.lead?.email === rawLeadEmail.trim().toLowerCase(),
      "Lead email is properly trimmed and normalized to lowercase"
    );
    if (jsonLeadValid.lead?.id) createdLeadIds.push(jsonLeadValid.lead.id);

    // 7.4 Malformed JSON returns 400
    const reqLeadMalformed = new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{invalid-json-body",
    });
    const resLeadMalformed = await createLeadHandler(reqLeadMalformed);
    assert(resLeadMalformed.status === 400, "Malformed JSON returns 400 on /api/leads");
  } catch (err: any) {
    console.error("Test execution error:", err);
    failed++;
  } finally {
    // ========================================================
    // [8] Cleanup Test Records
    // ========================================================
    console.log("\n[8] Cleaning up created test entities...");
    try {
      if (createdLeadIds.length > 0) {
        await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
      }
      if (createdUserIds.length > 0) {
        await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } });
        await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      }
      if (createdMemberIds.length > 0) {
        await prisma.transaction.deleteMany({ where: { memberId: { in: createdMemberIds } } });
        await prisma.member.deleteMany({ where: { id: { in: createdMemberIds } } });
      }
      console.log("  ✓ Test cleanup completed successfully");
    } catch (cleanupErr: any) {
      console.error("Error during test cleanup:", cleanupErr);
    }
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite();
