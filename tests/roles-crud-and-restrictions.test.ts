import { NextRequest } from "next/server";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { middleware } from "../src/middleware";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/auth-token";
import { prisma } from "../src/lib/db";
import { SportType, MenuCategory, ProductCategory, StaffRole, UserRole, PlanTier } from "@prisma/client";

// Import API Handlers
import { GET as getCourts, POST as postCourt, PUT as putCourt, DELETE as deleteCourt } from "../src/app/api/courts/route";
import { GET as getProducts, POST as postProduct, PUT as putProduct, DELETE as deleteProduct } from "../src/app/api/shop/products/route";
import { GET as getBarTables, POST as postBarTable, PUT as putBarTable, DELETE as deleteBarTable } from "../src/app/api/bar/tables/route";
import { GET as getBarMenu, POST as postBarMenu, PUT as putBarMenu, DELETE as deleteBarMenu } from "../src/app/api/bar/menu/route";
import { GET as getStaff, POST as postStaff, PUT as putStaff, DELETE as deleteStaff } from "../src/app/api/hr/staff/route";
import { POST as postBooking } from "../src/app/api/bookings/route";

// Import UI Components
import { BarScene } from "../src/components/scenes/BarScene";
import { CourtScene } from "../src/components/scenes/CourtScene";
import { AuthContext } from "../src/contexts/AuthContext";

async function runRolesCrudAndRestrictionsTests() {
  console.log("=== STARTING ROLES CRUD, VIEW RESTRICTIONS & BOOKING CONSTRAINTS TEST SUITE ===");
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

  // Record initial counts to ensure database counts stay intact
  const initialCourtsCount = await prisma.court.count();
  const initialProductsCount = await prisma.shopProduct.count();
  const initialTablesCount = await prisma.barTable.count();
  const initialMenuItemsCount = await prisma.barMenuItem.count();
  const initialStaffCount = await prisma.staffMember.count();
  const initialUsersCount = await prisma.user.count();
  const initialBookingsCount = await prisma.courtBooking.count();

  // Helper to create authenticated requests with session tokens
  async function createAuthRequest(url: string, role: string, options: { method?: string; body?: any } = {}) {
    const token = await signSessionToken({
      sessionToken: `test-${role.toLowerCase()}-${Date.now()}`,
      userId: `user-${role.toLowerCase()}`,
      role: role as any,
      exp: Date.now() + 60000,
    });

    const headers: Record<string, string> = {
      Cookie: `${SESSION_COOKIE_NAME}=${token}`,
    };
    if (options.body) {
      headers["Content-Type"] = "application/json";
    }

    return new NextRequest(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  }

  // ==========================================
  // 1. API CRUD Capabilities (Direct Handlers)
  // ==========================================
  console.log("\n[1] Testing Direct API CRUD Handlers for Items...");

  // 1.1 Courts CRUD (/api/courts)
  const courtPayload = {
    name: `Test Court ${Date.now()}`,
    sport: SportType.TENNIS,
    hourlyRate: 1200,
    surface: "Synthetic Grass",
    description: "Professional grade synthetic tennis court",
  };

  const createCourtRes = await postCourt(
    new NextRequest("http://localhost:3000/api/courts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(courtPayload),
    })
  );
  assert(createCourtRes.status === 201, "POST /api/courts creates new court (201)");
  const createCourtData = await createCourtRes.json();
  const createdCourtId = createCourtData.court?.id;
  assert(Boolean(createdCourtId), "Created court has valid ID");

  const updateCourtRes = await putCourt(
    new NextRequest("http://localhost:3000/api/courts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: createdCourtId,
        name: `Updated Court ${Date.now()}`,
        hourlyRate: 1500,
        surface: "Clay",
      }),
    })
  );
  assert(updateCourtRes.status === 200, "PUT /api/courts updates existing court (200)");
  const updateCourtData = await updateCourtRes.json();
  assert(updateCourtData.court?.hourlyRate === 1500, "Court hourly rate updated to 1500");

  const deleteCourtRes = await deleteCourt(
    new NextRequest(`http://localhost:3000/api/courts?id=${encodeURIComponent(createdCourtId)}`, {
      method: "DELETE",
    })
  );
  assert(deleteCourtRes.status === 200, "DELETE /api/courts removes court (200)");
  const verifyCourtDeleted = await prisma.court.findUnique({ where: { id: createdCourtId } });
  assert(verifyCourtDeleted === null, "Court is completely removed from database");

  // 1.2 Products / Gear CRUD (/api/shop/products)
  const productPayload = {
    name: `Test Pro Racket ${Date.now()}`,
    category: ProductCategory.RACKET,
    sku: `SKU-TEST-${Date.now().toString().slice(-6)}`,
    price: 8500,
    stockQuantity: 15,
    description: "Tournament grade tennis racket",
  };

  const createProdRes = await postProduct(
    new NextRequest("http://localhost:3000/api/shop/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productPayload),
    })
  );
  assert(createProdRes.status === 201, "POST /api/shop/products creates new gear product (201)");
  const createProdData = await createProdRes.json();
  const createdProdId = createProdData.product?.id;
  assert(Boolean(createdProdId), "Created product has valid ID");

  const updateProdRes = await putProduct(
    new NextRequest("http://localhost:3000/api/shop/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: createdProdId,
        price: 9200,
        stockQuantity: 20,
      }),
    })
  );
  assert(updateProdRes.status === 200, "PUT /api/shop/products updates product price & stock (200)");
  const updateProdData = await updateProdRes.json();
  assert(updateProdData.product?.price === 9200, "Product price updated to 9200");

  const deleteProdRes = await deleteProduct(
    new NextRequest(`http://localhost:3000/api/shop/products?id=${encodeURIComponent(createdProdId)}`, {
      method: "DELETE",
    })
  );
  assert(deleteProdRes.status === 200, "DELETE /api/shop/products removes product (200)");
  const verifyProdDeleted = await prisma.shopProduct.findUnique({ where: { id: createdProdId } });
  assert(verifyProdDeleted === null, "Product is completely removed from database");

  // 1.3 Bar & Cafe Tables CRUD (/api/bar/tables)
  const tablePayload = {
    tableNumber: 99,
    name: `VIP Lounge Table ${Date.now()}`,
    capacity: 6,
  };

  const createTableRes = await postBarTable(
    new NextRequest("http://localhost:3000/api/bar/tables", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tablePayload),
    })
  );
  assert(createTableRes.status === 201, "POST /api/bar/tables creates new table (201)");
  const createTableData = await createTableRes.json();
  const createdTableId = createTableData.table?.id;
  assert(Boolean(createdTableId), "Created table has valid ID");

  const updateTableRes = await putBarTable(
    new NextRequest("http://localhost:3000/api/bar/tables", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: createdTableId,
        capacity: 8,
        name: "Expanded VIP Table",
      }),
    })
  );
  assert(updateTableRes.status === 200, "PUT /api/bar/tables updates table capacity & name (200)");
  const updateTableData = await updateTableRes.json();
  assert(updateTableData.table?.capacity === 8, "Table capacity updated to 8");

  const deleteTableRes = await deleteBarTable(
    new NextRequest(`http://localhost:3000/api/bar/tables?id=${encodeURIComponent(createdTableId)}`, {
      method: "DELETE",
    })
  );
  assert(deleteTableRes.status === 200, "DELETE /api/bar/tables removes table (200)");
  const verifyTableDeleted = await prisma.barTable.findUnique({ where: { id: createdTableId } });
  assert(verifyTableDeleted === null, "Table is completely removed from database");

  // 1.4 Bar & Cafe Menu Items CRUD (/api/bar/menu)
  const menuPayload = {
    name: `Artisan Matcha Latte ${Date.now()}`,
    category: MenuCategory.BEVERAGES,
    price: 240,
    prepTimeMinutes: 5,
    isAvailable: true,
  };

  const createMenuRes = await postBarMenu(
    new NextRequest("http://localhost:3000/api/bar/menu", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(menuPayload),
    })
  );
  assert(createMenuRes.status === 201, "POST /api/bar/menu creates new menu item (201)");
  const createMenuData = await createMenuRes.json();
  const createdMenuId = createMenuData.menuItem?.id;
  assert(Boolean(createdMenuId), "Created menu item has valid ID");

  const updateMenuRes = await putBarMenu(
    new NextRequest("http://localhost:3000/api/bar/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: createdMenuId,
        price: 280,
        name: "Deluxe Matcha Latte",
      }),
    })
  );
  assert(updateMenuRes.status === 200, "PUT /api/bar/menu updates menu item price (200)");
  const updateMenuData = await updateMenuRes.json();
  assert(updateMenuData.menuItem?.price === 280, "Menu item price updated to 280");

  const deleteMenuRes = await deleteBarMenu(
    new NextRequest(`http://localhost:3000/api/bar/menu?id=${encodeURIComponent(createdMenuId)}`, {
      method: "DELETE",
    })
  );
  assert(deleteMenuRes.status === 200, "DELETE /api/bar/menu removes menu item (200)");
  const verifyMenuDeleted = await prisma.barMenuItem.findUnique({ where: { id: createdMenuId } });
  assert(verifyMenuDeleted === null, "Menu item is completely removed from database");

  // 1.5 HR Staff & Linked User Credentials CRUD (/api/hr/staff)
  const staffTestEmail = `test.staff.${Date.now()}@champions.club`;
  const staffPayload = {
    name: "Vikram Malhotra",
    email: staffTestEmail,
    role: StaffRole.COURT_COACH,
    phone: "+91 99887 76655",
    monthlySalary: 45000,
    hourlyWage: 200,
    userRole: UserRole.COACH,
    password: "Password123!",
    createLoginAccount: true,
  };

  const createStaffRes = await postStaff(
    new NextRequest("http://localhost:3000/api/hr/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(staffPayload),
    })
  );
  assert(createStaffRes.status === 201, "POST /api/hr/staff creates staff member & user account (201)");
  const createStaffData = await createStaffRes.json();
  const createdStaffId = createStaffData.staff?.id;
  assert(Boolean(createdStaffId), "Created staff member has valid ID");
  assert(Boolean(createStaffData.staff?.user?.id), "Linked user account created");

  const updateStaffRes = await putStaff(
    new NextRequest("http://localhost:3000/api/hr/staff", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: createdStaffId,
        monthlySalary: 50000,
        name: "Vikram Malhotra (Senior Coach)",
      }),
    })
  );
  assert(updateStaffRes.status === 200, "PUT /api/hr/staff updates staff salary & title (200)");
  const updateStaffData = await updateStaffRes.json();
  assert(updateStaffData.staff?.monthlySalary === 50000, "Monthly salary updated to 50000");

  const deleteStaffRes = await deleteStaff(
    new NextRequest(`http://localhost:3000/api/hr/staff?id=${encodeURIComponent(createdStaffId)}`, {
      method: "DELETE",
    })
  );
  assert(deleteStaffRes.status === 200, "DELETE /api/hr/staff removes staff member and user (200)");
  const verifyStaffDeleted = await prisma.staffMember.findUnique({ where: { id: createdStaffId } });
  const verifyUserDeleted = await prisma.user.findUnique({ where: { email: staffTestEmail } });
  assert(verifyStaffDeleted === null, "Staff member completely removed from database");
  assert(verifyUserDeleted === null, "Associated user credentials completely removed from database");

  // ==========================================
  // 2. Middleware Granular RBAC Permissions
  // ==========================================
  console.log("\n[2] Testing Middleware RBAC Role Boundary Rules...");

  // 2.1 OWNER has full access everywhere
  const ownerCourtsRes = await middleware(await createAuthRequest("http://localhost:3000/api/courts", "OWNER", { method: "POST", body: {} }));
  assert(ownerCourtsRes.status !== 403, "OWNER allowed on /api/courts POST");

  const ownerProductsRes = await middleware(await createAuthRequest("http://localhost:3000/api/shop/products", "OWNER", { method: "POST", body: {} }));
  assert(ownerProductsRes.status !== 403, "OWNER allowed on /api/shop/products POST");

  const ownerTablesRes = await middleware(await createAuthRequest("http://localhost:3000/api/bar/tables", "OWNER", { method: "POST", body: {} }));
  assert(ownerTablesRes.status !== 403, "OWNER allowed on /api/bar/tables POST");

  const ownerStaffRes = await middleware(await createAuthRequest("http://localhost:3000/api/hr/staff", "OWNER", { method: "POST", body: {} }));
  assert(ownerStaffRes.status !== 403, "OWNER allowed on /api/hr/staff POST");

  const ownerFinanceRes = await middleware(await createAuthRequest("http://localhost:3000/api/finance/analytics", "OWNER"));
  assert(ownerFinanceRes.status !== 403, "OWNER allowed on /api/finance/analytics");

  // 2.2 PRO_SHOP: Can manage gear, blocked elsewhere
  const proShopProdRes = await middleware(await createAuthRequest("http://localhost:3000/api/shop/products", "PRO_SHOP", { method: "POST", body: {} }));
  assert(proShopProdRes.status !== 403, "PRO_SHOP allowed to mutate gear on /api/shop/products");

  const proShopCourtsRes = await middleware(await createAuthRequest("http://localhost:3000/api/courts", "PRO_SHOP", { method: "POST", body: {} }));
  assert(proShopCourtsRes.status === 403, "PRO_SHOP blocked (403) from mutating courts");

  const proShopTablesRes = await middleware(await createAuthRequest("http://localhost:3000/api/bar/tables", "PRO_SHOP", { method: "POST", body: {} }));
  assert(proShopTablesRes.status === 403, "PRO_SHOP blocked (403) from mutating bar tables");

  const proShopHRRes = await middleware(await createAuthRequest("http://localhost:3000/api/hr/staff", "PRO_SHOP", { method: "POST", body: {} }));
  assert(proShopHRRes.status === 403, "PRO_SHOP blocked (403) from mutating staff");

  const proShopFinanceRes = await middleware(await createAuthRequest("http://localhost:3000/api/finance/analytics", "PRO_SHOP"));
  assert(proShopFinanceRes.status === 403, "PRO_SHOP blocked (403) from finance reports");

  // 2.3 BAR_STAFF: Can manage bar tables and menu, blocked elsewhere
  const barStaffTablesRes = await middleware(await createAuthRequest("http://localhost:3000/api/bar/tables", "BAR_STAFF", { method: "POST", body: {} }));
  assert(barStaffTablesRes.status !== 403, "BAR_STAFF allowed on /api/bar/tables POST");

  const barStaffMenuRes = await middleware(await createAuthRequest("http://localhost:3000/api/bar/menu", "BAR_STAFF", { method: "POST", body: {} }));
  assert(barStaffMenuRes.status !== 403, "BAR_STAFF allowed on /api/bar/menu POST");

  const barStaffCourtsRes = await middleware(await createAuthRequest("http://localhost:3000/api/courts", "BAR_STAFF", { method: "POST", body: {} }));
  assert(barStaffCourtsRes.status === 403, "BAR_STAFF blocked (403) from courts");

  const barStaffShopRes = await middleware(await createAuthRequest("http://localhost:3000/api/shop/products", "BAR_STAFF", { method: "POST", body: {} }));
  assert(barStaffShopRes.status === 403, "BAR_STAFF blocked (403) from shop products");

  const barStaffHRRes = await middleware(await createAuthRequest("http://localhost:3000/api/hr/staff", "BAR_STAFF", { method: "POST", body: {} }));
  assert(barStaffHRRes.status === 403, "BAR_STAFF blocked (403) from HR staff");

  // 2.4 HR: Can manage staff members & credentials, blocked elsewhere
  const hrStaffRes = await middleware(await createAuthRequest("http://localhost:3000/api/hr/staff", "HR", { method: "POST", body: {} }));
  assert(hrStaffRes.status !== 403, "HR allowed on /api/hr/staff POST");

  const hrCourtsRes = await middleware(await createAuthRequest("http://localhost:3000/api/courts", "HR", { method: "POST", body: {} }));
  assert(hrCourtsRes.status === 403, "HR blocked (403) from courts");

  const hrShopRes = await middleware(await createAuthRequest("http://localhost:3000/api/shop/products", "HR", { method: "POST", body: {} }));
  assert(hrShopRes.status === 403, "HR blocked (403) from shop products");

  const hrTablesRes = await middleware(await createAuthRequest("http://localhost:3000/api/bar/tables", "HR", { method: "POST", body: {} }));
  assert(hrTablesRes.status === 403, "HR blocked (403) from bar tables");

  const hrFinanceRes = await middleware(await createAuthRequest("http://localhost:3000/api/finance/analytics", "HR"));
  assert(hrFinanceRes.status === 403, "HR blocked (403) from finance analytics");

  // 2.5 COACH (Court Manager): Can manage courts, blocked elsewhere
  const coachCourtsRes = await middleware(await createAuthRequest("http://localhost:3000/api/courts", "COACH", { method: "POST", body: {} }));
  assert(coachCourtsRes.status !== 403, "COACH allowed to mutate courts on /api/courts POST");

  const coachShopRes = await middleware(await createAuthRequest("http://localhost:3000/api/shop/products", "COACH", { method: "POST", body: {} }));
  assert(coachShopRes.status === 403, "COACH blocked (403) from shop products");

  const coachTablesRes = await middleware(await createAuthRequest("http://localhost:3000/api/bar/tables", "COACH", { method: "POST", body: {} }));
  assert(coachTablesRes.status === 403, "COACH blocked (403) from bar tables");

  const coachHRRes = await middleware(await createAuthRequest("http://localhost:3000/api/hr/staff", "COACH", { method: "POST", body: {} }));
  assert(coachHRRes.status === 403, "COACH blocked (403) from HR records");

  // ==========================================
  // 3. Role View Restrictions (Chef & Cafe Manager)
  // ==========================================
  console.log("\n[3] Testing Chef & Cafe Manager Role View Restrictions...");

  // 3.1 CHEF: API restrictions (blocked from tab opening, closing earnings, modifying tables/menu)
  const chefOpenTabRes = await middleware(await createAuthRequest("http://localhost:3000/api/bar/tabs", "CHEF", { method: "POST", body: { action: "OPEN_TAB" } }));
  assert(chefOpenTabRes.status === 403, "CHEF blocked (403) from opening tabs via POST /api/bar/tabs");

  const chefTablesRes = await middleware(await createAuthRequest("http://localhost:3000/api/bar/tables", "CHEF", { method: "POST", body: {} }));
  assert(chefTablesRes.status === 403, "CHEF blocked (403) from creating tables");

  const chefMenuRes = await middleware(await createAuthRequest("http://localhost:3000/api/bar/menu", "CHEF", { method: "POST", body: {} }));
  assert(chefMenuRes.status === 403, "CHEF blocked (403) from adding menu items");

  const chefPatchOrderRes = await middleware(await createAuthRequest("http://localhost:3000/api/bar/tabs", "CHEF", { method: "PATCH", body: { orderItemId: "item-1", kitchenStatus: "READY" } }));
  assert(chefPatchOrderRes.status !== 403, "CHEF allowed to update kitchen status via PATCH /api/bar/tabs");

  // 3.2 CHEF: UI restriction in BarScene (ONLY Kitchen Display System KDS)
  const chefAuthContextValue: any = {
    user: { id: "user-chef", email: "chef@champions.club", name: "Executive Chef", role: "CHEF" },
    loading: false,
    logout: () => {},
    login: async () => true,
    switchDemoPersona: async () => {},
  };

  const chefBarHtml = renderToStaticMarkup(
    React.createElement(
      AuthContext.Provider,
      { value: chefAuthContextValue },
      React.createElement(BarScene, {
        initialKitchenQueue: [
          {
            id: "kds-1",
            quantity: 2,
            kitchenStatus: "PREPARING",
            orderedAt: new Date().toISOString(),
            menuItem: { name: "Margherita Pizza" },
            tab: { table: { name: "Table 4" }, tabNumber: "TAB-404" },
          },
        ],
      })
    )
  );
  assert(chefBarHtml.includes("Chef") && chefBarHtml.includes("Kitchen Prep Queue"), "CHEF view renders KDS prep queue heading");
  assert(chefBarHtml.includes("Margherita Pizza"), "CHEF view renders active ticket item");
  assert(!chefBarHtml.includes("Closing Earnings"), "CHEF view DOES NOT render Closing Earnings tab switcher");
  assert(!chefBarHtml.includes("Table Tabs ("), "CHEF view DOES NOT render Table Tabs tab switcher");
  assert(!chefBarHtml.includes("Open Tab for this Table"), "CHEF view DOES NOT render Open Tab controls");

  // 3.3 CAFE_MANAGER: API restrictions (blocked from mutating tables, menu, tabs)
  const cafeManagerTableRes = await middleware(await createAuthRequest("http://localhost:3000/api/bar/tables", "CAFE_MANAGER", { method: "POST", body: {} }));
  assert(cafeManagerTableRes.status === 403, "CAFE_MANAGER blocked (403) from mutating tables");

  const cafeManagerMenuRes = await middleware(await createAuthRequest("http://localhost:3000/api/bar/menu", "CAFE_MANAGER", { method: "POST", body: {} }));
  assert(cafeManagerMenuRes.status === 403, "CAFE_MANAGER blocked (403) from mutating menu");

  // 3.4 CAFE_MANAGER: UI restriction in BarScene (ONLY Table Vacancy Monitor)
  const cafeManagerAuthContextValue: any = {
    user: { id: "user-cafe-mgr", email: "cafe.manager@champions.club", name: "Cafe Floor Manager", role: "CAFE_MANAGER" },
    loading: false,
    logout: () => {},
    login: async () => true,
    switchDemoPersona: async () => {},
  };

  const sampleTables = [
    { id: "tbl-1", tableNumber: 1, name: "Table 1", capacity: 4, tabs: [] },
    { id: "tbl-2", tableNumber: 2, name: "Table 2", capacity: 4, tabs: [{ id: "tab-2" }] },
  ];

  const cafeMgrBarHtml = renderToStaticMarkup(
    React.createElement(
      AuthContext.Provider,
      { value: cafeManagerAuthContextValue },
      React.createElement(BarScene, {
        initialTables: sampleTables,
      })
    )
  );
  assert(cafeMgrBarHtml.includes("Table Vacancy Monitor"), "CAFE_MANAGER view renders Table Vacancy Monitor banner");
  assert(cafeMgrBarHtml.includes("Clubhouse Table Layout") && cafeMgrBarHtml.includes("Vacancy"), "CAFE_MANAGER view renders floor layout vacancy");
  assert(cafeMgrBarHtml.includes("Vacant") && (cafeMgrBarHtml.includes("Ready") || cafeMgrBarHtml.includes("&amp;")), "CAFE_MANAGER view renders Vacant & Ready KPI");
  assert(!cafeMgrBarHtml.includes("Kitchen Queue ("), "CAFE_MANAGER view DOES NOT render Kitchen Queue tab switcher");
  assert(!cafeMgrBarHtml.includes("Closing Earnings"), "CAFE_MANAGER view DOES NOT render Closing Earnings tab switcher");
  assert(!cafeMgrBarHtml.includes("+ Add Table"), "CAFE_MANAGER view DOES NOT render + Add Table button");

  // ==========================================
  // 4. Court Booking Boundary Constraints
  // ==========================================
  console.log("\n[4] Testing Court Booking Date/Time Constraints...");

  const existingCourt = await prisma.court.findFirst();
  const courtId = existingCourt?.id || "court-1";
  const existingMember = await prisma.member.findFirst();
  const memberId = existingMember?.id || "member-1";

  // 4.1 Reject past date (< today)
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Yesterday
  const pastDateIso = pastDate.toISOString().split("T")[0];
  const pastBookingReq = new NextRequest("http://localhost:3000/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courtId,
      memberId,
      startTimeStr: `${pastDateIso}T10:00:00.000Z`,
      startTime: `${pastDateIso}T10:00:00.000Z`,
    }),
  });
  const pastBookingRes = await postBooking(pastBookingReq);
  assert(pastBookingRes.status === 400, "POST /api/bookings with past date rejects with HTTP 400");
  const pastBookingData = await pastBookingRes.json();
  assert(pastBookingData.error?.includes("past"), "Rejection error clearly specifies past date restriction");

  // 4.2 Reject past time slot on today's date
  const today = new Date();
  const todayIso = today.toISOString().split("T")[0];
  // 2 hours ago today (or 00:00 if early morning)
  const pastTimeToday = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const pastTimeTodayIso = pastTimeToday.toISOString();

  // Only test past time slot today if pastTimeToday is still today in UTC
  if (pastTimeTodayIso.split("T")[0] === todayIso) {
    const pastTimeReq = new NextRequest("http://localhost:3000/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courtId,
        memberId,
        startTimeStr: pastTimeTodayIso,
        startTime: pastTimeTodayIso,
      }),
    });
    const pastTimeRes = await postBooking(pastTimeReq);
    assert(pastTimeRes.status === 400, "POST /api/bookings with past time today rejects with HTTP 400");
    const pastTimeData = await pastTimeRes.json();
    assert(pastTimeData.error?.includes("past"), "Rejection error specifies past time slot restriction");
  } else {
    // If midnight UTC boundary, test with 00:00 UTC if now > 01:00 UTC
    const earlySlotToday = new Date(`${todayIso}T00:00:00.000Z`);
    if (Date.now() > earlySlotToday.getTime()) {
      const earlySlotReq = new NextRequest("http://localhost:3000/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtId,
          memberId,
          startTimeStr: `${todayIso}T00:00:00.000Z`,
          startTime: `${todayIso}T00:00:00.000Z`,
        }),
      });
      const earlySlotRes = await postBooking(earlySlotReq);
      assert(earlySlotRes.status === 400, "POST /api/bookings with early past time today rejects with HTTP 400");
    }
  }

  // 4.3 Reject date > 1 month from today
  const farFutureDate = new Date();
  farFutureDate.setDate(farFutureDate.getDate() + 45); // 45 days in future
  const farFutureIso = farFutureDate.toISOString().split("T")[0];

  const farFutureReq = new NextRequest("http://localhost:3000/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courtId,
      memberId,
      startTimeStr: `${farFutureIso}T14:00:00.000Z`,
      startTime: `${farFutureIso}T14:00:00.000Z`,
    }),
  });
  const farFutureRes = await postBooking(farFutureReq);
  assert(farFutureRes.status === 400, "POST /api/bookings for > 1 month ahead rejects with HTTP 400");
  const farFutureData = await farFutureRes.json();
  assert(farFutureData.error?.includes("1 month"), "Rejection error clearly specifies 1 month maximum window");

  // 4.4 Accept valid booking slot (e.g. 12 days from today in an unbooked hour)
  const validFutureDate = new Date();
  validFutureDate.setDate(validFutureDate.getDate() + 12);
  const validFutureIso = validFutureDate.toISOString().split("T")[0];

  const existingBookingsOnDay = await prisma.courtBooking.findMany({
    where: {
      courtId,
      status: { not: "CANCELLED" },
      startTime: {
        gte: new Date(`${validFutureIso}T00:00:00.000Z`),
        lte: new Date(`${validFutureIso}T23:59:59.999Z`),
      },
    },
  });
  const bookedHours = new Set(existingBookingsOnDay.map((b) => new Date(b.startTime).getUTCHours()));
  let freeHour = 6;
  for (let h = 6; h <= 21; h++) {
    if (!bookedHours.has(h)) {
      freeHour = h;
      break;
    }
  }
  const freeHourStr = freeHour.toString().padStart(2, "0");

  const validBookingReq = new NextRequest("http://localhost:3000/api/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courtId,
      memberId,
      startTimeStr: `${validFutureIso}T${freeHourStr}:00:00.000Z`,
      startTime: `${validFutureIso}T${freeHourStr}:00:00.000Z`,
    }),
  });
  const validBookingRes = await postBooking(validBookingReq);
  const validBookingData = await validBookingRes.json();
  assert(validBookingRes.status === 200 || validBookingRes.status === 201, "POST /api/bookings for valid date (within 1 month) succeeds");
  const validBookingId = validBookingData.booking?.id;
  assert(Boolean(validBookingId), "Valid booking returned booking id");

  // Clean up created booking
  if (validBookingId) {
    await prisma.transaction.deleteMany({ where: { courtBooking: { id: validBookingId } } });
    await prisma.courtBooking.delete({ where: { id: validBookingId } });
  }

  // 4.5 UI Constraints in CourtScene: min/max on date picker and past time slot disabling
  const courtSceneHtml = renderToStaticMarkup(React.createElement(CourtScene));
  const maxAllowedDate = new Date();
  maxAllowedDate.setMonth(maxAllowedDate.getMonth() + 1);
  const expectedMaxStr = maxAllowedDate.toISOString().split("T")[0];

  assert(courtSceneHtml.includes(`min="${todayIso}"`), "CourtScene date picker sets min to today's date");
  assert(courtSceneHtml.includes(`max="${expectedMaxStr}"`), "CourtScene date picker sets max to exactly 1 month from today");

  // ==========================================
  // 5. Database Count Integrity Verification
  // ==========================================
  console.log("\n[5] Verifying Database Count Integrity...");
  const finalCourtsCount = await prisma.court.count();
  const finalProductsCount = await prisma.shopProduct.count();
  const finalTablesCount = await prisma.barTable.count();
  const finalMenuItemsCount = await prisma.barMenuItem.count();
  const finalStaffCount = await prisma.staffMember.count();
  const finalUsersCount = await prisma.user.count();
  const finalBookingsCount = await prisma.courtBooking.count();

  assert(finalCourtsCount === initialCourtsCount, `Courts count preserved (${finalCourtsCount} === ${initialCourtsCount})`);
  assert(finalProductsCount === initialProductsCount, `Products count preserved (${finalProductsCount} === ${initialProductsCount})`);
  assert(finalTablesCount === initialTablesCount, `Tables count preserved (${finalTablesCount} === ${initialTablesCount})`);
  assert(finalMenuItemsCount === initialMenuItemsCount, `Menu items count preserved (${finalMenuItemsCount} === ${initialMenuItemsCount})`);
  assert(finalStaffCount === initialStaffCount, `Staff count preserved (${finalStaffCount} === ${initialStaffCount})`);
  assert(finalUsersCount === initialUsersCount, `Users count preserved (${finalUsersCount} === ${initialUsersCount})`);
  assert(finalBookingsCount === initialBookingsCount, `Bookings count preserved (${finalBookingsCount} === ${initialBookingsCount})`);

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runRolesCrudAndRestrictionsTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
