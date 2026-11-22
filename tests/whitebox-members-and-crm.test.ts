import { NextRequest } from "next/server";
import { GET as getLeads, POST as postLead, PATCH as patchLead } from "../src/app/api/leads/route";
import { GET as getMembers, POST as postMember } from "../src/app/api/members/route";
import { GET as getMemberById, PATCH as patchMemberById } from "../src/app/api/members/[id]/route";
import { POST as joinMember } from "../src/app/api/members/join/route";
import { prisma } from "../src/lib/db";
import { SESSION_COOKIE_NAME, signSessionToken } from "../src/lib/auth-token";
import { PlanTier, MemberStatus, PaymentMethod, LeadStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

async function runMembersCrmWhitebox() {
  console.log("=== STARTING MEMBERS & CRM API ROUTES WHITE-BOX TEST SUITE ===");
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

  // Create isolated OWNER, FRONT_DESK, and MEMBER users
  const ownerEmail = `wb.crm.owner.${Date.now()}@champions.club`;
  const frontDeskEmail = `wb.crm.fd.${Date.now()}@champions.club`;
  const memberEmail = `wb.crm.mem.${Date.now()}@champions.club`;
  const defaultHash = await bcrypt.hash("password123", 10);

  const testOwner = await prisma.user.create({
    data: { email: ownerEmail, name: "CRM Owner", password: defaultHash, role: "OWNER" },
  });
  const testFD = await prisma.user.create({
    data: { email: frontDeskEmail, name: "CRM FrontDesk", password: defaultHash, role: "FRONT_DESK" },
  });
  const testMember = await prisma.user.create({
    data: { email: memberEmail, name: "CRM Member", password: defaultHash, role: "MEMBER" },
  });

  const fdRawToken = `raw-fd-${Date.now()}`;
  await prisma.session.create({
    data: { sessionToken: fdRawToken, userId: testFD.id, expiresAt: new Date(Date.now() + 3600000) },
  });
  const fdToken = await signSessionToken({
    sessionToken: fdRawToken,
    userId: testFD.id,
    role: "FRONT_DESK",
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

  const createdMemberIds: string[] = [];
  const createdLeadIds: string[] = [];
  const createdTxnIds: string[] = [];
  const createdUserIds: string[] = [testOwner.id, testFD.id, testMember.id];

  try {
    // ==========================================
    // 1. Leads API (/api/leads)
    // ==========================================
    console.log("\n[1] Testing /api/leads...");
    // 1.1 GET with & without status filter
    const resLeadsNoFilter = await getLeads(new NextRequest("http://localhost:3000/api/leads"));
    assert(resLeadsNoFilter.status === 200, "GET /api/leads returns 200");

    const resLeadsFilter = await getLeads(new NextRequest("http://localhost:3000/api/leads?status=NEW"));
    assert(resLeadsFilter.status === 200, "GET /api/leads?status=NEW returns 200");

    // 1.2 GET catch block
    const origLeadFindMany = prisma.lead.findMany;
    (prisma.lead as any).findMany = async () => {
      throw new Error("Simulated lead query error");
    };
    const resLeadsCatch = await getLeads(new NextRequest("http://localhost:3000/api/leads"));
    prisma.lead.findMany = origLeadFindMany;
    assert(resLeadsCatch.status === 500, "GET /api/leads db failure returns 500");

    // 1.3 POST validations
    const resLeadBadJson = await postLead(new NextRequest("http://localhost:3000/api/leads", { method: "POST", body: "invalid{" }));
    assert(resLeadBadJson.status === 400, "POST /api/leads invalid JSON returns 400");

    const resLeadMissing = await postLead(new NextRequest("http://localhost:3000/api/leads", { method: "POST", body: JSON.stringify({ name: "Lead 1" }) }));
    assert(resLeadMissing.status === 400, "POST /api/leads missing email/phone returns 400");

    const resLeadBadEmail = await postLead(new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Lead 1", email: "bademail", phone: "9876543210" }),
    }));
    assert(resLeadBadEmail.status === 400, "POST /api/leads bad email returns 400");

    // Valid lead creation
    const leadEmail = `lead.${Date.now()}@champions.club`;
    const resLeadSuccess = await postLead(new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: JSON.stringify({
        name: "Test Lead User",
        email: leadEmail,
        phone: "9876543210",
        interest: "Tennis Trial",
        notes: "Interested in morning slots",
        trialDate: new Date().toISOString(),
      }),
    }));
    assert(resLeadSuccess.status === 200, "POST /api/leads valid creation returns 200");
    const leadData = await resLeadSuccess.json();
    const testLeadId = leadData.lead.id;
    createdLeadIds.push(testLeadId);

    // POST catch block
    const origLeadCreate = prisma.lead.create;
    (prisma.lead as any).create = async () => {
      throw new Error("Simulated lead create error");
    };
    const resLeadPostCatch = await postLead(new NextRequest("http://localhost:3000/api/leads", {
      method: "POST",
      body: JSON.stringify({ name: "Lead Fail", email: `fail.${Date.now()}@champions.club`, phone: "1234567890" }),
    }));
    prisma.lead.create = origLeadCreate;
    assert(resLeadPostCatch.status === 500, "POST /api/leads create failure returns 500");

    // 1.4 PATCH validations & actions
    const resPatchNoId = await patchLead(new NextRequest("http://localhost:3000/api/leads", { method: "PATCH", body: JSON.stringify({}) }));
    assert(resPatchNoId.status === 400, "PATCH /api/leads missing leadId returns 400");

    const resPatchNotFound = await patchLead(new NextRequest("http://localhost:3000/api/leads", {
      method: "PATCH",
      body: JSON.stringify({ leadId: "non-existent-lead-id", action: "SEND_QUOTE" }),
    }));
    assert(resPatchNotFound.status === 404, "PATCH /api/leads non-existent lead returns 404");

    // Action A: SEND_QUOTE
    const resSendQuote = await patchLead(new NextRequest("http://localhost:3000/api/leads", {
      method: "PATCH",
      body: JSON.stringify({ leadId: testLeadId, action: "SEND_QUOTE", quoteAmount: 6000, notes: "Special promo" }),
    }));
    assert(resSendQuote.status === 200, "PATCH /api/leads action SEND_QUOTE returns 200");

    // Action C: UPDATE_STATUS
    const resUpdateStatus = await patchLead(new NextRequest("http://localhost:3000/api/leads", {
      method: "PATCH",
      body: JSON.stringify({ leadId: testLeadId, action: "UPDATE_STATUS", status: LeadStatus.CONTACTED, notes: "Spoke via phone" }),
    }));
    assert(resUpdateStatus.status === 200, "PATCH /api/leads action UPDATE_STATUS returns 200");

    // Action B: CONVERT_TO_MEMBER when plan is not found (line 122)
    const origPlanFindLead = prisma.membershipPlan.findUnique;
    (prisma.membershipPlan as any).findUnique = async () => null;
    const resConvertBadPlan = await patchLead(new NextRequest("http://localhost:3000/api/leads", {
      method: "PATCH",
      body: JSON.stringify({ leadId: testLeadId, action: "CONVERT_TO_MEMBER", planTier: PlanTier.GOLD }),
    }));
    prisma.membershipPlan.findUnique = origPlanFindLead;
    assert(resConvertBadPlan.status === 400, "PATCH /api/leads action CONVERT_TO_MEMBER with bad plan returns 400");

    // Action B: CONVERT_TO_MEMBER with valid plan tier (with candidate memberNumber collision to hit lines 132-134)
    const currentMemberCount = await prisma.member.count();
    const collisionCandidate1 = `CC-1${String(currentMemberCount + 2).padStart(3, "0")}`;
    const collisionMem1 = await prisma.member.create({
      data: {
        memberNumber: collisionCandidate1,
        name: "Collision Member 1",
        email: `col1.${Date.now()}@champions.club`,
        phone: "9876543210",
        planTier: PlanTier.GOLD,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    createdMemberIds.push(collisionMem1.id);

    const resConvert = await patchLead(new NextRequest("http://localhost:3000/api/leads", {
      method: "PATCH",
      body: JSON.stringify({ leadId: testLeadId, action: "CONVERT_TO_MEMBER", planTier: PlanTier.GOLD }),
    }));
    assert(resConvert.status === 200, "PATCH /api/leads action CONVERT_TO_MEMBER returns 200");
    const convertData = await resConvert.json();
    if (convertData.member?.id) createdMemberIds.push(convertData.member.id);
    if (convertData.transaction?.id) createdTxnIds.push(convertData.transaction.id);

    // Invalid action
    const resInvalidAction = await patchLead(new NextRequest("http://localhost:3000/api/leads", {
      method: "PATCH",
      body: JSON.stringify({ leadId: testLeadId, action: "UNKNOWN_ACTION" }),
    }));
    assert(resInvalidAction.status === 400, "PATCH /api/leads invalid action returns 400");

    // PATCH catch block
    const resPatchCatch = await patchLead(new NextRequest("http://localhost:3000/api/leads", {
      method: "PATCH",
      body: "invalid-json{",
    }));
    assert(resPatchCatch.status === 500, "PATCH /api/leads malformed json returns 500");

    // ==========================================
    // 2. Members Management API (/api/members)
    // ==========================================
    console.log("\n[2] Testing /api/members...");
    // 2.1 GET with search, tier, status
    const resMemSearch = await getMembers(new NextRequest("http://localhost:3000/api/members?search=CRM&tier=GOLD&status=ACTIVE"));
    assert(resMemSearch.status === 200, "GET /api/members with search, tier, and status returns 200");

    const resMemAll = await getMembers(new NextRequest("http://localhost:3000/api/members"));
    assert(resMemAll.status === 200, "GET /api/members returns 200");

    // 2.2 GET catch block
    const origMemFindMany = prisma.member.findMany;
    (prisma.member as any).findMany = async () => {
      throw new Error("Simulated member findMany failure");
    };
    const resMemGetCatch = await getMembers(new NextRequest("http://localhost:3000/api/members"));
    prisma.member.findMany = origMemFindMany;
    assert(resMemGetCatch.status === 500, "GET /api/members db failure returns 500");

    // 2.3 POST validations
    const resMemBadJson = await postMember(new NextRequest("http://localhost:3000/api/members", { method: "POST", body: "invalid{" }));
    assert(resMemBadJson.status === 400, "POST /api/members invalid JSON returns 400");

    const resMemMissing = await postMember(new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      body: JSON.stringify({ name: "New Member" }),
    }));
    assert(resMemMissing.status === 400, "POST /api/members missing required fields returns 400");

    const resMemBadEmail = await postMember(new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      body: JSON.stringify({ name: "New Member", email: "invalid", phone: "9876543210", planTier: "GOLD" }),
    }));
    assert(resMemBadEmail.status === 400, "POST /api/members invalid email returns 400");

    // Invalid DNS domain (line 102)
    const resMemBadDomain = await postMember(new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      body: JSON.stringify({ name: "New Member", email: "user@nonexistent-fake-domain-12345.xyz", phone: "9876543210", planTier: PlanTier.GOLD }),
    }));
    assert(resMemBadDomain.status === 400, "POST /api/members non-existent domain returns 400");

    // Duplicate member email
    const duplicateMemberEmail = `dup.member.${Date.now()}@champions.club`;
    const resMemFirst = await postMember(new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: "First Member",
        email: duplicateMemberEmail,
        phone: "9876543210",
        planTier: PlanTier.GOLD,
      }),
    }));
    assert(resMemFirst.status === 200, "POST /api/members enrolled member without password");
    const firstMemData = await resMemFirst.json();
    if (firstMemData.member?.id) createdMemberIds.push(firstMemData.member.id);
    if (firstMemData.transaction?.id) createdTxnIds.push(firstMemData.transaction.id);

    const resMemDup = await postMember(new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: "Duplicate Member",
        email: duplicateMemberEmail,
        phone: "9876543210",
        planTier: PlanTier.GOLD,
      }),
    }));
    assert(resMemDup.status === 400, "POST /api/members duplicate member email returns 400");

    // Existing user account check (line 125)
    const resMemExistingUser = await postMember(new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: "Existing User Member",
        email: testMember.email,
        phone: "9876543210",
        password: "Champions2026!",
        planTier: PlanTier.GOLD,
      }),
    }));
    assert(resMemExistingUser.status === 400, "POST /api/members existing user email returns 400");

    // Invalid plan tier (line 138)
    const origMemPlanFind = prisma.membershipPlan.findUnique;
    (prisma.membershipPlan as any).findUnique = async () => null;
    const resMemBadTier = await postMember(new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: "Bad Tier Member",
        email: `badtier.${Date.now()}@champions.club`,
        phone: "9876543210",
        planTier: PlanTier.GOLD,
      }),
    }));
    prisma.membershipPlan.findUnique = origMemPlanFind;
    assert(resMemBadTier.status === 400, "POST /api/members invalid plan tier returns 400");

    // Weak password check (line 144)
    const resMemWeakPass = await postMember(new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: "Weak Pass Member",
        email: `weakpass.${Date.now()}@champions.club`,
        phone: "9876543210",
        password: "weak",
        planTier: PlanTier.GOLD,
      }),
    }));
    assert(resMemWeakPass.status === 400, "POST /api/members weak password returns 400");

    // Valid enrollment with password (creates user & session cookie, with candidate collision to hit lines 68-70)
    const staffCount = await prisma.member.count();
    const staffCandidate = `CC-2${String(staffCount + 2).padStart(3, "0")}`;
    const staffColMem = await prisma.member.create({
      data: {
        memberNumber: staffCandidate,
        name: "Staff Collision Member",
        email: `staffcol.${Date.now()}@champions.club`,
        phone: "9876543210",
        planTier: PlanTier.SILVER,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    createdMemberIds.push(staffColMem.id);

    const withPassEmail = `withpass.${Date.now()}@champions.club`;
    const resMemWithPass = await postMember(new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: "With Password Member",
        email: withPassEmail,
        phone: "9876543210",
        password: "Champions2026!",
        planTier: PlanTier.SILVER,
        durationMonths: 2,
        notes: "VIP Member",
        paymentMethod: PaymentMethod.UPI,
      }),
    }));
    assert(resMemWithPass.status === 200, "POST /api/members enrolled member with password and session");
    const withPassData = await resMemWithPass.json();
    if (withPassData.member?.id) createdMemberIds.push(withPassData.member.id);
    if (withPassData.user?.id) createdUserIds.push(withPassData.user.id);
    if (withPassData.transaction?.id) createdTxnIds.push(withPassData.transaction.id);

    // P2002 email collision handling (lines 226-236)
    const origMemTxP2002 = prisma.$transaction;
    (prisma as any).$transaction = async () => {
      const err: any = new Error("P2002 email");
      err.code = "P2002";
      err.meta = { target: ["email"] };
      throw err;
    };
    const resMemP2002Email = await postMember(new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: "P2002 Email Member",
        email: `p2002e.${Date.now()}@champions.club`,
        phone: "9876543210",
        planTier: PlanTier.GOLD,
      }),
    }));
    assert(resMemP2002Email.status === 400, "POST /api/members P2002 email collision returns 400");

    // P2002 memberNumber collision & max attempts failure (lines 238-241, 246-248)
    (prisma as any).$transaction = async () => {
      const err: any = new Error("P2002 memberNumber");
      err.code = "P2002";
      err.meta = { target: ["memberNumber"] };
      throw err;
    };
    const resMemP2002Attempts = await postMember(new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: "P2002 Attempts Member",
        email: `p2002att.${Date.now()}@champions.club`,
        phone: "9876543210",
        planTier: PlanTier.GOLD,
      }),
    }));
    prisma.$transaction = origMemTxP2002;
    assert(resMemP2002Attempts.status === 500, "POST /api/members P2002 attempts exceeded returns 500");

    // POST catch block
    const origMemTx = prisma.$transaction;
    (prisma as any).$transaction = async () => {
      throw new Error("Simulated transaction crash");
    };
    const resMemTxCrash = await postMember(new NextRequest("http://localhost:3000/api/members", {
      method: "POST",
      body: JSON.stringify({
        name: "Crash Member",
        email: `crash.${Date.now()}@champions.club`,
        phone: "9876543210",
        planTier: PlanTier.GOLD,
      }),
    }));
    prisma.$transaction = origMemTx;
    assert(resMemTxCrash.status === 500, "POST /api/members transaction failure returns 500");

    // ==========================================
    // 3. Member By ID (/api/members/[id])
    // ==========================================
    console.log("\n[3] Testing /api/members/[id]...");
    // 3.1 verifyStaffAccess branches
    // Header non-staff role (line 17)
    const resStaffBadHeader = await patchMemberById(
      new NextRequest("http://localhost:3000/api/members/123", {
        method: "PATCH",
        headers: { "x-user-role": "MEMBER", "x-user-id": testMember.id },
      }),
      { params: { id: "123" } }
    );
    assert(resStaffBadHeader.status === 403, "Staff access header MEMBER rejected with 403");

    // No cookie (line 23)
    const resStaffNoCookie = await patchMemberById(
      new NextRequest("http://localhost:3000/api/members/123", { method: "PATCH" }),
      { params: { id: "123" } }
    );
    assert(resStaffNoCookie.status === 401, "Staff access no cookie rejected with 401");

    // Orphan cookie (line 28)
    const orphanToken = await signSessionToken({
      sessionToken: "orphan-fd",
      userId: "no-fd-user",
      role: "FRONT_DESK",
      exp: Date.now() + 3600000,
    });
    const resStaffOrphan = await patchMemberById(
      new NextRequest("http://localhost:3000/api/members/123", {
        method: "PATCH",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${orphanToken}` },
      }),
      { params: { id: "123" } }
    );
    assert(resStaffOrphan.status === 401, "Staff access orphan cookie rejected with 401");

    // Cookie member role (line 32)
    const resStaffCookieMem = await patchMemberById(
      new NextRequest("http://localhost:3000/api/members/123", {
        method: "PATCH",
        headers: { cookie: `${SESSION_COOKIE_NAME}=${memberToken}` },
      }),
      { params: { id: "123" } }
    );
    assert(resStaffCookieMem.status === 403, "Staff access cookie MEMBER rejected with 403");

    // 3.2 GET member by id
    const targetMemberId = createdMemberIds[0];
    const resGetMemberFound = await getMemberById(
      new NextRequest(`http://localhost:3000/api/members/${targetMemberId}`),
      { params: { id: targetMemberId } }
    );
    assert(resGetMemberFound.status === 200, "GET /api/members/[id] found returns 200");

    const resGetMember404 = await getMemberById(
      new NextRequest("http://localhost:3000/api/members/non-existent-id"),
      { params: { id: "non-existent-id" } }
    );
    assert(resGetMember404.status === 404, "GET /api/members/[id] not found returns 404");

    // GET catch block
    const origMemFindUnique = prisma.member.findUnique;
    (prisma.member as any).findUnique = async () => {
      throw new Error("Simulated findUnique crash");
    };
    const resGetMemberCatch = await getMemberById(
      new NextRequest(`http://localhost:3000/api/members/${targetMemberId}`),
      { params: { id: targetMemberId } }
    );
    prisma.member.findUnique = origMemFindUnique;
    assert(resGetMemberCatch.status === 500, "GET /api/members/[id] crash returns 500");

    // 3.3 PATCH validations & actions
    function makeStaffReq(body: any) {
      return new NextRequest(`http://localhost:3000/api/members/${targetMemberId}`, {
        method: "PATCH",
        headers: { "x-user-role": "FRONT_DESK", "x-user-id": testFD.id },
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
    }

    // Member not found (line 117)
    const resPatchMem404 = await patchMemberById(
      new NextRequest("http://localhost:3000/api/members/non-existent-id", {
        method: "PATCH",
        headers: { "x-user-role": "FRONT_DESK", "x-user-id": testFD.id },
        body: JSON.stringify({ action: "RENEW" }),
      }),
      { params: { id: "non-existent-id" } }
    );
    assert(resPatchMem404.status === 404, "PATCH /api/members/[id] member not found returns 404");

    // Invalid action (line 230)
    const resPatchMemBadAction = await patchMemberById(makeStaffReq({ action: "INVALID_ACTION" }), { params: { id: targetMemberId } });
    assert(resPatchMemBadAction.status === 400, "PATCH /api/members/[id] unsupported action returns 400");

    // Invalid tier (line 124)
    const resPatchMemBadTier = await patchMemberById(
      makeStaffReq({ action: "RENEW", planTier: "NON_EXISTENT_TIER" }),
      { params: { id: targetMemberId } }
    );
    assert(resPatchMemBadTier.status === 400, "PATCH /api/members/[id] invalid renewal tier returns 400");

    // Invalid duration (line 132)
    const resPatchMemBadDuration = await patchMemberById(
      makeStaffReq({ action: "RENEW", planTier: PlanTier.GOLD, durationMonths: -1 }),
      { params: { id: targetMemberId } }
    );
    assert(resPatchMemBadDuration.status === 400, "PATCH /api/members/[id] duration < 1 returns 400");

    // Target plan not found (line 143)
    const origPlanFindUnique = prisma.membershipPlan.findUnique;
    (prisma.membershipPlan as any).findUnique = async () => null;
    const resPatchMemNoPlan = await patchMemberById(
      makeStaffReq({ action: "RENEW", planTier: PlanTier.GOLD, durationMonths: 1 }),
      { params: { id: targetMemberId } }
    );
    prisma.membershipPlan.findUnique = origPlanFindUnique;
    assert(resPatchMemNoPlan.status === 404, "PATCH /api/members/[id] target plan missing returns 404");

    // Valid RENEW with existing transactionId (line 184)
    const existingTxnId = createdTxnIds[0];
    const resRenewWithTxn = await patchMemberById(
      makeStaffReq({
        action: "RENEW",
        planTier: PlanTier.GOLD,
        durationMonths: 1,
        transactionId: existingTxnId,
        notes: "Renewed with existing transaction ID",
      }),
      { params: { id: targetMemberId } }
    );
    assert(resRenewWithTxn.status === 200, "PATCH /api/members/[id] RENEW with existing txn returns 200");

    // Valid RENEW with tier switch and new transaction created (lines 165-168, 198-214)
    const resRenewTierSwitch = await patchMemberById(
      makeStaffReq({
        action: "RENEW",
        planTier: PlanTier.SILVER,
        durationMonths: 3,
        discountPercent: 10,
        paymentMethod: PaymentMethod.CARD,
      }),
      { params: { id: targetMemberId } }
    );
    assert(resRenewTierSwitch.status === 200, "PATCH /api/members/[id] RENEW with tier switch returns 200");
    const tierSwitchData = await resRenewTierSwitch.json();
    if (tierSwitchData.transaction?.id) createdTxnIds.push(tierSwitchData.transaction.id);

    // PATCH catch block (lines 231-234)
    const resPatchMemCatch = await patchMemberById(makeStaffReq("invalid-json{"), { params: { id: targetMemberId } });
    assert(resPatchMemCatch.status === 500, "PATCH /api/members/[id] malformed json returns 500");

    // ==========================================
    // 4. Public Join Route (/api/members/join)
    // ==========================================
    console.log("\n[4] Testing /api/members/join...");
    // 4.1 Invalid json
    const resJoinBadJson = await joinMember(new NextRequest("http://localhost:3000/api/members/join", { method: "POST", body: "invalid{" }));
    assert(resJoinBadJson.status === 400, "POST /api/members/join invalid json returns 400");

    // 4.2 Missing name
    const resJoinNoName = await joinMember(new NextRequest("http://localhost:3000/api/members/join", { method: "POST", body: JSON.stringify({}) }));
    assert(resJoinNoName.status === 400, "POST /api/members/join missing name returns 400");

    // 4.3 Missing email
    const resJoinNoEmail = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({ name: "Alex" }),
    }));
    assert(resJoinNoEmail.status === 400, "POST /api/members/join missing email returns 400");

    // 4.4 Missing phone
    const resJoinNoPhone = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({ name: "Alex", email: "alex@champions.club" }),
    }));
    assert(resJoinNoPhone.status === 400, "POST /api/members/join missing phone returns 400");

    // 4.5 Missing password
    const resJoinNoPass = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({ name: "Alex", email: "alex@champions.club", phone: "9876543210" }),
    }));
    assert(resJoinNoPass.status === 400, "POST /api/members/join missing password returns 400");

    // 4.5b Password > 128 chars (lines 109-113)
    const resJoinLongPass = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({ name: "Alex", email: "alex@champions.club", phone: "9876543210", password: "A1!" + "a".repeat(130) }),
    }));
    assert(resJoinLongPass.status === 400, "POST /api/members/join password > 128 chars returns 400");

    // 4.6 Weak password
    const resJoinWeakPass = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({ name: "Alex", email: "alex@champions.club", phone: "9876543210", password: "weak" }),
    }));
    assert(resJoinWeakPass.status === 400, "POST /api/members/join weak password returns 400");

    // 4.7 Missing planTier
    const resJoinNoTier = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({ name: "Alex", email: "alex@champions.club", phone: "9876543210", password: "Champions2026!" }),
    }));
    assert(resJoinNoTier.status === 400, "POST /api/members/join missing planTier returns 400");

    // 4.8 Invalid planTier
    const resJoinBadTier = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({
        name: "Alex",
        email: "alex@champions.club",
        phone: "9876543210",
        password: "Champions2026!",
        planTier: "INVALID_TIER",
      }),
    }));
    assert(resJoinBadTier.status === 400, "POST /api/members/join invalid planTier returns 400");

    // 4.9 Plan configuration not found (line 148)
    const origJoinPlanFindUnique = prisma.membershipPlan.findUnique;
    (prisma.membershipPlan as any).findUnique = async () => null;
    const resJoinPlanNotFound = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({
        name: "Alex",
        email: "alex@champions.club",
        phone: "9876543210",
        password: "Champions2026!",
        planTier: PlanTier.GOLD,
      }),
    }));
    prisma.membershipPlan.findUnique = origJoinPlanFindUnique;
    assert(resJoinPlanNotFound.status === 404, "POST /api/members/join plan configuration not found returns 404");

    // 4.10 Duplicate member email check (line 158)
    const resJoinDupMember = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({
        name: "Alex",
        email: duplicateMemberEmail,
        phone: "9876543210",
        password: "Champions2026!",
        planTier: PlanTier.GOLD,
      }),
    }));
    assert(resJoinDupMember.status === 400, "POST /api/members/join duplicate member email returns 400");

    // 4.11 Duplicate user email check (line 168)
    const resJoinDupUser = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({
        name: "Alex",
        email: testMember.email,
        phone: "9876543210",
        password: "Champions2026!",
        planTier: PlanTier.GOLD,
      }),
    }));
    assert(resJoinDupUser.status === 400, "POST /api/members/join duplicate user email returns 400");

    // 4.11b P2002 email collision in tx (lines 292-304)
    const origJoinTxP2002 = prisma.$transaction;
    (prisma as any).$transaction = async () => {
      const err: any = new Error("P2002 email join");
      err.code = "P2002";
      err.meta = { target: ["email"] };
      throw err;
    };
    const resJoinP2002Email = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({
        name: "P2002 Email Join",
        email: `joinp2002.${Date.now()}@champions.club`,
        phone: "9876543210",
        password: "Champions2026!",
        planTier: PlanTier.GOLD,
      }),
    }));
    assert(resJoinP2002Email.status === 400, "POST /api/members/join P2002 email collision returns 400");

    // 4.11b2 P2002 email collision with string target (lines 292-294)
    (prisma as any).$transaction = async () => {
      const err: any = new Error("P2002 email string target join");
      err.code = "P2002";
      err.meta = { target: "email_unique_idx" };
      throw err;
    };
    const resJoinP2002EmailStr = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({
        name: "P2002 Email Str Join",
        email: `joinp2002str.${Date.now()}@champions.club`,
        phone: "9876543210",
        password: "Champions2026!",
        planTier: PlanTier.GOLD,
      }),
    }));
    assert(resJoinP2002EmailStr.status === 400, "POST /api/members/join P2002 string target email collision returns 400");

    // 4.11c P2002 memberNumber collision & max attempts failure (lines 282-290, 311-315)
    (prisma as any).$transaction = async () => {
      const err: any = new Error("P2002 memberNumber join");
      err.code = "P2002";
      err.meta = { target: ["memberNumber"] };
      throw err;
    };
    const resJoinP2002Attempts = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({
        name: "Join Attempts",
        email: `joinatt.${Date.now()}@champions.club`,
        phone: "9876543210",
        password: "Champions2026!",
        planTier: PlanTier.GOLD,
      }),
    }));
    prisma.$transaction = origJoinTxP2002;
    assert(resJoinP2002Attempts.status === 500, "POST /api/members/join P2002 attempts exceeded returns 500");

    // 4.11d Candidate memberNumber collision in getNextMemberNumber (lines 30-32) & successful join
    const joinCount = await prisma.member.count();
    const joinCandidate = `CC-3${String(joinCount + 2).padStart(3, "0")}`;
    const joinColMem = await prisma.member.create({
      data: {
        memberNumber: joinCandidate,
        name: "Join Collision Member",
        email: `joincol.${Date.now()}@champions.club`,
        phone: "9876543210",
        planTier: PlanTier.JUNIOR,
        startDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    createdMemberIds.push(joinColMem.id);

    const resJoinSuccess = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({
        name: "Successful Joiner",
        email: `successjoin.${Date.now()}@champions.club`,
        phone: "9876543210",
        password: "Champions2026!",
        planTier: PlanTier.JUNIOR,
      }),
    }));
    assert(resJoinSuccess.status === 200, "POST /api/members/join with candidate collision succeeds");
    const joinSuccessData = await resJoinSuccess.json();
    if (joinSuccessData.member?.id) createdMemberIds.push(joinSuccessData.member.id);
    if (joinSuccessData.user?.id) createdUserIds.push(joinSuccessData.user.id);
    if (joinSuccessData.transaction?.id) createdTxnIds.push(joinSuccessData.transaction.id);

    // 4.12 Catch block (lines 356-362)
    const origJoinTx = prisma.$transaction;
    (prisma as any).$transaction = async () => {
      throw new Error("Simulated join crash");
    };
    const resJoinCatch = await joinMember(new NextRequest("http://localhost:3000/api/members/join", {
      method: "POST",
      body: JSON.stringify({
        name: "Crash Joiner",
        email: `crashjoin.${Date.now()}@champions.club`,
        phone: "9876543210",
        password: "Champions2026!",
        planTier: PlanTier.GOLD,
      }),
    }));
    prisma.$transaction = origJoinTx;
    assert(resJoinCatch.status === 500, "POST /api/members/join crash triggers catch block returning 500");
  } finally {
    // Cleanup fixtures
    if (createdTxnIds.length > 0) {
      await prisma.transaction.deleteMany({ where: { id: { in: createdTxnIds } } }).catch(() => {});
    }
    if (createdMemberIds.length > 0) {
      await prisma.courtBooking.deleteMany({ where: { memberId: { in: createdMemberIds } } }).catch(() => {});
      await prisma.shopOrder.deleteMany({ where: { memberId: { in: createdMemberIds } } }).catch(() => {});
      await prisma.barTab.deleteMany({ where: { memberId: { in: createdMemberIds } } }).catch(() => {});
      await prisma.session.deleteMany({ where: { user: { memberId: { in: createdMemberIds } } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { memberId: { in: createdMemberIds } } }).catch(() => {});
      await prisma.member.deleteMany({ where: { id: { in: createdMemberIds } } }).catch(() => {});
    }
    if (createdLeadIds.length > 0) {
      await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } }).catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: createdUserIds } } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runMembersCrmWhitebox().catch((err) => {
  console.error("Members CRM whitebox test failed:", err);
  process.exit(1);
});
