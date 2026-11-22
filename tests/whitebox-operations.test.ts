import { NextRequest } from "next/server";
import { GET as getCourts } from "../src/app/api/courts/route";
import { GET as getBookings, POST as postBooking, PATCH as patchBooking } from "../src/app/api/bookings/route";
import { GET as getProducts, PATCH as patchProduct } from "../src/app/api/shop/products/route";
import { GET as getOrders, POST as postOrder } from "../src/app/api/shop/orders/route";
import { GET as getBarMenu } from "../src/app/api/bar/menu/route";
import { GET as getBarTables } from "../src/app/api/bar/tables/route";
import { GET as getBarTabs, POST as postBarTab, PATCH as patchBarTab } from "../src/app/api/bar/tabs/route";
import { GET as getFinanceAnalytics } from "../src/app/api/finance/analytics/route";
import { GET as getInvoices, POST as postInvoice, PATCH as patchInvoice } from "../src/app/api/invoices/route";
import { GET as getLeaves, PATCH as patchLeave } from "../src/app/api/hr/leaves/route";
import { GET as getTransactions, POST as postTransaction } from "../src/app/api/transactions/route";
import { prisma } from "../src/lib/db";
import {
  BookingStatus,
  PaymentStatus,
  PaymentMethod,
  OrderType,
  OrderStatus,
  TabStatus,
  TableStatus,
  KitchenStatus,
  TransactionType,
  TransactionCategory,
  PlanTier,
  LeaveStatus,
} from "@prisma/client";

async function runOperationsWhitebox() {
  console.log("=== STARTING OPERATIONS & POS WHITE-BOX TEST SUITE ===");
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

  // Create isolated Member fixture with GOLD plan
  const memberEmail = `wb.ops.member.${Date.now()}@champions.club`;
  const member = await prisma.member.create({
    data: {
      memberNumber: `CC-OP-${Date.now().toString().slice(-4)}`,
      name: "Operations Test Member",
      email: memberEmail,
      phone: "9876543210",
      planTier: PlanTier.GOLD,
      startDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // Track created fixtures for cleanup
  const cleanupBookingIds: string[] = [];
  const cleanupOrderIds: string[] = [];
  const cleanupTabIds: string[] = [];
  const cleanupTxnIds: string[] = [];
  const cleanupInvoiceIds: string[] = [];
  const cleanupLeaveIds: string[] = [];
  const cleanupProductIds: string[] = [];

  // Fetch or ensure a court exists
  let testCourt = await prisma.court.findFirst();
  if (!testCourt) {
    testCourt = await prisma.court.create({
      data: { name: "Court 1", sport: "TENNIS", hourlyRate: 800, surface: "HARD" },
    });
  }

  // Fetch or ensure a product exists
  let testProduct = await prisma.shopProduct.findFirst();
  if (!testProduct) {
    testProduct = await prisma.shopProduct.create({
      data: {
        sku: `SKU-${Date.now()}`,
        name: "Test Racket",
        category: "RACKET",
        price: 2500,
        stockQuantity: 20,
        reorderThreshold: 5,
      },
    });
    cleanupProductIds.push(testProduct.id);
  }

  // Fetch or ensure a bar table exists
  let testTable = await prisma.barTable.findFirst({ where: { status: TableStatus.AVAILABLE } });
  if (!testTable) {
    testTable = await prisma.barTable.create({
      data: { tableNumber: 99, capacity: 4, status: TableStatus.AVAILABLE },
    });
  }

  // Fetch or ensure a bar menu item exists
  let testMenuItem = await prisma.barMenuItem.findFirst({ where: { isAvailable: true } });
  if (!testMenuItem) {
    testMenuItem = await prisma.barMenuItem.create({
      data: { name: "Cold Brew Coffee", category: "BEVERAGES", price: 200, isAvailable: true },
    });
  }

  // Fetch or ensure a staff member exists for leave tests
  let testStaff = await prisma.staffMember.findFirst();
  if (!testStaff) {
    testStaff = await prisma.staffMember.create({
      data: {
        name: "Coach Test",
        email: `staff.${Date.now()}@champions.club`,
        phone: "9876543210",
        role: "COACH",
        monthlySalary: 35000,
        hireDate: new Date(),
      },
    });
  }

  try {
    // ==========================================
    // 1. Courts (/api/courts)
    // ==========================================
    console.log("\n[1] Testing /api/courts...");
    const resCourts = await getCourts();
    assert(resCourts.status === 200, "GET /api/courts returns 200");

    // Catch block
    const origCourtFind = prisma.court.findMany;
    (prisma.court as any).findMany = async () => {
      throw new Error("Simulated courts failure");
    };
    const resCourtsCatch = await getCourts();
    prisma.court.findMany = origCourtFind;
    assert(resCourtsCatch.status === 500, "GET /api/courts error triggers catch block returning 500");

    // ==========================================
    // 2. Bookings (/api/bookings)
    // ==========================================
    console.log("\n[2] Testing /api/bookings...");
    // 2.1 GET with & without query params
    const resBookingsAll = await getBookings(new NextRequest("http://localhost:3000/api/bookings"));
    assert(resBookingsAll.status === 200, "GET /api/bookings returns 200");

    const resBookingsFiltered = await getBookings(
      new NextRequest(`http://localhost:3000/api/bookings?date=2026-11-21&courtId=${testCourt.id}&memberId=${member.id}`)
    );
    assert(resBookingsFiltered.status === 200, "GET /api/bookings with filters returns 200");

    // GET catch block
    const origBookingFind = prisma.courtBooking.findMany;
    (prisma.courtBooking as any).findMany = async () => {
      throw new Error("Simulated bookings query failure");
    };
    const resBookingsCatch = await getBookings(new NextRequest("http://localhost:3000/api/bookings"));
    prisma.courtBooking.findMany = origBookingFind;
    assert(resBookingsCatch.status === 500, "GET /api/bookings error returns 500");

    // 2.2 POST validations
    const resBookNoParams = await postBooking(new NextRequest("http://localhost:3000/api/bookings", { method: "POST", body: JSON.stringify({}) }));
    assert(resBookNoParams.status === 400, "POST /api/bookings missing courtId/startTime returns 400");

    const resBookNoCourt = await postBooking(
      new NextRequest("http://localhost:3000/api/bookings", {
        method: "POST",
        body: JSON.stringify({ courtId: "non-existent-court", startTimeStr: new Date().toISOString() }),
      })
    );
    assert(resBookNoCourt.status === 404, "POST /api/bookings court not found returns 404");

    const resBookNoMember = await postBooking(
      new NextRequest("http://localhost:3000/api/bookings", {
        method: "POST",
        body: JSON.stringify({ courtId: testCourt.id, memberId: "non-existent-member", startTimeStr: new Date().toISOString() }),
      })
    );
    assert(resBookNoMember.status === 404, "POST /api/bookings member not found returns 404");

    // Valid booking 1 (member booking on Gold plan -> 100% discount, finalPrice = 0, status PAID)
    const futureDate1 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    futureDate1.setHours(10, 0, 0, 0);
    const resBooking1 = await postBooking(
      new NextRequest("http://localhost:3000/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          courtId: testCourt.id,
          memberId: member.id,
          startTimeStr: futureDate1.toISOString(),
          notes: "Regular morning game",
        }),
      })
    );
    assert(resBooking1.status === 200, "POST /api/bookings member booking succeeds with 100% Gold discount");
    const bookData1 = await resBooking1.json();
    cleanupBookingIds.push(bookData1.booking.id);

    // Conflict prevention check (line 94: conflicting booking at same time on same court)
    const resConflict = await postBooking(
      new NextRequest("http://localhost:3000/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          courtId: testCourt.id,
          guestName: "Another Player",
          startTimeStr: futureDate1.toISOString(),
        }),
      })
    );
    assert(resConflict.status === 409, "POST /api/bookings prevents overlapping booking with 409 Conflict");

    // Walk-in guest booking (no memberId, calculates full price)
    const futureDate2 = new Date(futureDate1.getTime() + 2 * 60 * 60 * 1000); // 2 hours later
    const resWalkIn = await postBooking(
      new NextRequest("http://localhost:3000/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          courtId: testCourt.id,
          guestName: "Walkin Guest",
          guestPhone: "+91 99999 11111",
          startTimeStr: futureDate2.toISOString(),
        }),
      })
    );
    assert(resWalkIn.status === 200, "POST /api/bookings walk-in guest booking succeeds");
    const walkInData = await resWalkIn.json();
    cleanupBookingIds.push(walkInData.booking.id);

    // Social play booking (isSocialPlay: true) on court 1
    const futureDate3 = new Date(futureDate1.getTime() + 4 * 60 * 60 * 1000);
    const resSocial = await postBooking(
      new NextRequest("http://localhost:3000/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          courtId: testCourt.id,
          memberId: member.id,
          isSocialPlay: true,
          socialPlayersCount: 4,
          startTimeStr: futureDate3.toISOString(),
        }),
      })
    );
    assert(resSocial.status === 200, "POST /api/bookings social play booking succeeds");
    const socialData = await resSocial.json();
    cleanupBookingIds.push(socialData.booking.id);

    // 3rd booking on same day on a non-conflicting time (+6 hours) exceeds Gold plan maxDailyBookings (2)
    const futureDate1Session3 = new Date(futureDate1.getTime() + 6 * 60 * 60 * 1000);
    const resLimitExceeded = await postBooking(
      new NextRequest("http://localhost:3000/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          courtId: testCourt.id,
          memberId: member.id,
          startTimeStr: futureDate1Session3.toISOString(),
        }),
      })
    );
    assert(resLimitExceeded.status === 400, "POST /api/bookings exceeds daily limit and returns 400");

    // POST catch block
    const resBookCatch = await postBooking(new NextRequest("http://localhost:3000/api/bookings", { method: "POST", body: "invalid{" }));
    assert(resBookCatch.status === 500, "POST /api/bookings malformed json returns 500");

    // 2.3 PATCH booking
    const resPatchNoBookId = await patchBooking(new NextRequest("http://localhost:3000/api/bookings", { method: "PATCH", body: JSON.stringify({}) }));
    assert(resPatchNoBookId.status === 400, "PATCH /api/bookings missing bookingId returns 400");

    const resPatchBadAction = await patchBooking(
      new NextRequest("http://localhost:3000/api/bookings", {
        method: "PATCH",
        body: JSON.stringify({ bookingId: bookData1.booking.id, action: "UNKNOWN" }),
      })
    );
    assert(resPatchBadAction.status === 400, "PATCH /api/bookings unknown action returns 400");

    const resCancelBooking = await patchBooking(
      new NextRequest("http://localhost:3000/api/bookings", {
        method: "PATCH",
        body: JSON.stringify({ bookingId: bookData1.booking.id, action: "CANCEL" }),
      })
    );
    assert(resCancelBooking.status === 200, "PATCH /api/bookings CANCEL returns 200");

    // PATCH catch block
    const resPatchBookingCatch = await patchBooking(new NextRequest("http://localhost:3000/api/bookings", { method: "PATCH", body: "invalid{" }));
    assert(resPatchBookingCatch.status === 500, "PATCH /api/bookings malformed json returns 500");

    // ==========================================
    // 3. Pro Shop Products (/api/shop/products)
    // ==========================================
    console.log("\n[3] Testing /api/shop/products...");
    // 3.1 GET with category and search
    const resProducts = await getProducts(new NextRequest("http://localhost:3000/api/shop/products?category=RACKET&search=Racket"));
    assert(resProducts.status === 200, "GET /api/shop/products with category and search returns 200");

    const resProductsAll = await getProducts(new NextRequest("http://localhost:3000/api/shop/products"));
    assert(resProductsAll.status === 200, "GET /api/shop/products without filters returns 200");

    // GET catch block
    const origProductFind = prisma.shopProduct.findMany;
    (prisma.shopProduct as any).findMany = async () => {
      throw new Error("Simulated products query failure");
    };
    const resProdGetCatch = await getProducts(new NextRequest("http://localhost:3000/api/shop/products"));
    prisma.shopProduct.findMany = origProductFind;
    assert(resProdGetCatch.status === 500, "GET /api/shop/products error returns 500");

    // 3.2 PATCH restock
    const resRestockBad = await patchProduct(
      new NextRequest("http://localhost:3000/api/shop/products", {
        method: "PATCH",
        body: JSON.stringify({ productId: testProduct.id, addedStock: -5 }),
      })
    );
    assert(resRestockBad.status === 400, "PATCH /api/shop/products invalid addedStock returns 400");

    const resRestockGood = await patchProduct(
      new NextRequest("http://localhost:3000/api/shop/products", {
        method: "PATCH",
        body: JSON.stringify({ productId: testProduct.id, addedStock: 10 }),
      })
    );
    assert(resRestockGood.status === 200, "PATCH /api/shop/products valid restock returns 200");

    // PATCH catch block
    const resProdPatchCatch = await patchProduct(new NextRequest("http://localhost:3000/api/shop/products", { method: "PATCH", body: "invalid{" }));
    assert(resProdPatchCatch.status === 500, "PATCH /api/shop/products malformed json returns 500");

    // ==========================================
    // 4. Pro Shop Orders (/api/shop/orders)
    // ==========================================
    console.log("\n[4] Testing /api/shop/orders...");
    // 4.1 GET with limit
    const resOrders = await getOrders(new NextRequest("http://localhost:3000/api/shop/orders?limit=10"));
    assert(resOrders.status === 200, "GET /api/shop/orders returns 200");

    // GET catch block
    const origOrderFind = prisma.shopOrder.findMany;
    (prisma.shopOrder as any).findMany = async () => {
      throw new Error("Simulated order query error");
    };
    const resOrderGetCatch = await getOrders(new NextRequest("http://localhost:3000/api/shop/orders"));
    prisma.shopOrder.findMany = origOrderFind;
    assert(resOrderGetCatch.status === 500, "GET /api/shop/orders error returns 500");

    // 4.2 POST validations
    const resOrderEmpty = await postOrder(new NextRequest("http://localhost:3000/api/shop/orders", { method: "POST", body: JSON.stringify({ items: [] }) }));
    assert(resOrderEmpty.status === 400, "POST /api/shop/orders empty items returns 400");

    const resOrderBadProd = await postOrder(
      new NextRequest("http://localhost:3000/api/shop/orders", {
        method: "POST",
        body: JSON.stringify({ items: [{ productId: "non-existent-prod", quantity: 1 }] }),
      })
    );
    assert(resOrderBadProd.status === 400, "POST /api/shop/orders non-existent product returns 400");

    const resOrderOversell = await postOrder(
      new NextRequest("http://localhost:3000/api/shop/orders", {
        method: "POST",
        body: JSON.stringify({ items: [{ productId: testProduct.id, quantity: 999999 }] }),
      })
    );
    assert(resOrderOversell.status === 400, "POST /api/shop/orders oversell inventory returns 400");

    // Valid IN_STORE order with member discount (Gold 20%)
    const resOrderStore = await postOrder(
      new NextRequest("http://localhost:3000/api/shop/orders", {
        method: "POST",
        body: JSON.stringify({
          memberId: member.id,
          orderType: OrderType.IN_STORE,
          items: [{ productId: testProduct.id, quantity: 1 }],
          paymentMethod: PaymentMethod.UPI,
        }),
      })
    );
    assert(resOrderStore.status === 200, "POST /api/shop/orders IN_STORE order succeeds");
    const storeOrderData = await resOrderStore.json();
    cleanupOrderIds.push(storeOrderData.order.id);
    if (storeOrderData.transaction?.id) cleanupTxnIds.push(storeOrderData.transaction.id);

    // Valid ONLINE_DELIVERY order with counter customer
    const resOrderOnline = await postOrder(
      new NextRequest("http://localhost:3000/api/shop/orders", {
        method: "POST",
        body: JSON.stringify({
          customerName: "Online Buyer",
          customerPhone: "+91 98888 77777",
          orderType: OrderType.ONLINE_DELIVERY,
          deliveryAddress: "Flat 402, Champions Residency, Pune",
          items: [{ productId: testProduct.id, quantity: 1 }],
          paymentMethod: PaymentMethod.CARD,
        }),
      })
    );
    assert(resOrderOnline.status === 200, "POST /api/shop/orders ONLINE_DELIVERY order succeeds");
    const onlineOrderData = await resOrderOnline.json();
    cleanupOrderIds.push(onlineOrderData.order.id);
    if (onlineOrderData.transaction?.id) cleanupTxnIds.push(onlineOrderData.transaction.id);

    // ==========================================
    // 5. Bar & Café Menu & Tables (/api/bar/menu, /api/bar/tables)
    // ==========================================
    console.log("\n[5] Testing /api/bar/menu & /api/bar/tables...");
    const resMenu = await getBarMenu();
    assert(resMenu.status === 200, "GET /api/bar/menu returns 200");

    const origMenuFind = prisma.barMenuItem.findMany;
    (prisma.barMenuItem as any).findMany = async () => {
      throw new Error("Simulated menu failure");
    };
    const resMenuCatch = await getBarMenu();
    prisma.barMenuItem.findMany = origMenuFind;
    assert(resMenuCatch.status === 500, "GET /api/bar/menu error returns 500");

    const resTables = await getBarTables();
    assert(resTables.status === 200, "GET /api/bar/tables returns 200");

    const origTableFind = prisma.barTable.findMany;
    (prisma.barTable as any).findMany = async () => {
      throw new Error("Simulated tables failure");
    };
    const resTablesCatch = await getBarTables();
    prisma.barTable.findMany = origTableFind;
    assert(resTablesCatch.status === 500, "GET /api/bar/tables error returns 500");

    // ==========================================
    // 6. Bar Tabs & Kitchen Queue (/api/bar/tabs)
    // ==========================================
    console.log("\n[6] Testing /api/bar/tabs...");
    // 6.1 GET bar tabs
    const resTabsGet = await getBarTabs(new NextRequest("http://localhost:3000/api/bar/tabs"));
    assert(resTabsGet.status === 200, "GET /api/bar/tabs returns 200");

    const origTabFind = prisma.barTab.findMany;
    (prisma.barTab as any).findMany = async () => {
      throw new Error("Simulated tab query error");
    };
    const resTabsCatch = await getBarTabs(new NextRequest("http://localhost:3000/api/bar/tabs"));
    prisma.barTab.findMany = origTabFind;
    assert(resTabsCatch.status === 500, "GET /api/bar/tabs error returns 500");

    // 6.2 POST OPEN_TAB validations & success
    const resOpenNoTable = await postBarTab(
      new NextRequest("http://localhost:3000/api/bar/tabs", {
        method: "POST",
        body: JSON.stringify({ action: "OPEN_TAB" }),
      })
    );
    assert(resOpenNoTable.status === 400, "POST /api/bar/tabs OPEN_TAB missing tableId returns 400");

    // Open valid tab
    const resOpenTab = await postBarTab(
      new NextRequest("http://localhost:3000/api/bar/tabs", {
        method: "POST",
        body: JSON.stringify({ action: "OPEN_TAB", tableId: testTable.id, memberId: member.id }),
      })
    );
    assert(resOpenTab.status === 200, "POST /api/bar/tabs OPEN_TAB succeeds");
    const openTabData = await resOpenTab.json();
    const createdTabId = openTabData.tab.id;
    cleanupTabIds.push(createdTabId);

    // Duplicate open tab on same table
    const resOpenDup = await postBarTab(
      new NextRequest("http://localhost:3000/api/bar/tabs", {
        method: "POST",
        body: JSON.stringify({ action: "OPEN_TAB", tableId: testTable.id }),
      })
    );
    assert(resOpenDup.status === 400, "POST /api/bar/tabs OPEN_TAB duplicate on same table returns 400");

    // 6.3 POST ADD_ITEMS validations & success
    const resAddBadItems = await postBarTab(
      new NextRequest("http://localhost:3000/api/bar/tabs", {
        method: "POST",
        body: JSON.stringify({ action: "ADD_ITEMS", tabId: createdTabId, items: [] }),
      })
    );
    assert(resAddBadItems.status === 400, "POST /api/bar/tabs ADD_ITEMS empty items returns 400");

    const resAddNotFound = await postBarTab(
      new NextRequest("http://localhost:3000/api/bar/tabs", {
        method: "POST",
        body: JSON.stringify({ action: "ADD_ITEMS", tabId: "non-existent-tab", items: [{ menuItemId: testMenuItem.id, quantity: 1 }] }),
      })
    );
    assert(resAddNotFound.status === 404, "POST /api/bar/tabs ADD_ITEMS tab not found returns 404");

    // Add items successfully (includes non-existent item id to test line 155 continue)
    const resAddSuccess = await postBarTab(
      new NextRequest("http://localhost:3000/api/bar/tabs", {
        method: "POST",
        body: JSON.stringify({
          action: "ADD_ITEMS",
          tabId: createdTabId,
          items: [
            { menuItemId: testMenuItem.id, quantity: 2, kitchenNotes: "Extra ice" },
            { menuItemId: "non-existent-item", quantity: 1 },
          ],
        }),
      })
    );
    assert(resAddSuccess.status === 200, "POST /api/bar/tabs ADD_ITEMS adds item and recalculates tab bill");
    const addData = await resAddSuccess.json();
    const orderItemId = addData.tab.items[0]?.id;

    // Unknown action
    const resBadTabAction = await postBarTab(
      new NextRequest("http://localhost:3000/api/bar/tabs", {
        method: "POST",
        body: JSON.stringify({ action: "UNKNOWN_ACTION" }),
      })
    );
    assert(resBadTabAction.status === 400, "POST /api/bar/tabs invalid action returns 400");

    // POST catch block
    const resTabPostCatch = await postBarTab(new NextRequest("http://localhost:3000/api/bar/tabs", { method: "POST", body: "invalid{" }));
    assert(resTabPostCatch.status === 500, "POST /api/bar/tabs malformed json returns 500");

    // 6.4 PATCH kitchen status (lines 210-239)
    const resPatchTabNoBody = await patchBarTab(new NextRequest("http://localhost:3000/api/bar/tabs", { method: "PATCH", body: JSON.stringify({}) }));
    assert(resPatchTabNoBody.status === 400, "PATCH /api/bar/tabs missing orderItemId returns 400");

    if (orderItemId) {
      // Status READY (line 223: sets readyAt)
      const resReady = await patchBarTab(
        new NextRequest("http://localhost:3000/api/bar/tabs", {
          method: "PATCH",
          body: JSON.stringify({ orderItemId, kitchenStatus: KitchenStatus.READY }),
        })
      );
      assert(resReady.status === 200, "PATCH /api/bar/tabs mark READY returns 200");

      // Status SERVED (line 224: sets servedAt)
      const resServed = await patchBarTab(
        new NextRequest("http://localhost:3000/api/bar/tabs", {
          method: "PATCH",
          body: JSON.stringify({ orderItemId, kitchenStatus: KitchenStatus.SERVED }),
        })
      );
      assert(resServed.status === 200, "PATCH /api/bar/tabs mark SERVED returns 200");
    }

    // PATCH catch block
    const resTabPatchCatch = await patchBarTab(new NextRequest("http://localhost:3000/api/bar/tabs", { method: "PATCH", body: "invalid{" }));
    assert(resTabPatchCatch.status === 500, "PATCH /api/bar/tabs malformed json returns 500");

    // ==========================================
    // 7. Finance Analytics (/api/finance/analytics)
    // ==========================================
    console.log("\n[7] Testing /api/finance/analytics...");
    const resFinance = await getFinanceAnalytics();
    assert(resFinance.status === 200, "GET /api/finance/analytics returns 200");

    const origTxnFind = prisma.transaction.findMany;
    (prisma.transaction as any).findMany = async () => {
      throw new Error("Simulated finance query error");
    };
    const resFinanceCatch = await getFinanceAnalytics();
    prisma.transaction.findMany = origTxnFind;
    assert(resFinanceCatch.status === 500, "GET /api/finance/analytics error returns 500");

    // ==========================================
    // 8. Invoices (/api/invoices)
    // ==========================================
    console.log("\n[8] Testing /api/invoices...");
    // 8.1 GET invoices
    const resInvoicesGet = await getInvoices();
    assert(resInvoicesGet.status === 200, "GET /api/invoices returns 200");

    const origInvFind = prisma.invoice.findMany;
    (prisma.invoice as any).findMany = async () => {
      throw new Error("Simulated invoice find error");
    };
    const resInvGetCatch = await getInvoices();
    prisma.invoice.findMany = origInvFind;
    assert(resInvGetCatch.status === 500, "GET /api/invoices error returns 500");

    // 8.2 POST invoice validations & creation
    const resInvNoBody = await postInvoice(new NextRequest("http://localhost:3000/api/invoices", { method: "POST", body: JSON.stringify({}) }));
    assert(resInvNoBody.status === 400, "POST /api/invoices missing clientName returns 400");

    const resInvSuccess = await postInvoice(
      new NextRequest("http://localhost:3000/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          clientName: "Acme Sports Corp",
          clientEmail: "events@acmesports.com",
          clientType: "CORPORATE",
          amount: 50000,
          description: "Annual Corporate Sports Day Package",
          dueInDays: 30,
        }),
      })
    );
    assert(resInvSuccess.status === 200, "POST /api/invoices corporate invoice created successfully");
    const invData = await resInvSuccess.json();
    const createdInvoiceId = invData.invoice.id;
    cleanupInvoiceIds.push(createdInvoiceId);

    // POST catch block
    const resInvPostCatch = await postInvoice(new NextRequest("http://localhost:3000/api/invoices", { method: "POST", body: "invalid{" }));
    assert(resInvPostCatch.status === 500, "POST /api/invoices malformed json returns 500");

    // 8.3 PATCH invoice settlement
    const resPatchInvNoId = await patchInvoice(new NextRequest("http://localhost:3000/api/invoices", { method: "PATCH", body: JSON.stringify({}) }));
    assert(resPatchInvNoId.status === 400, "PATCH /api/invoices missing invoiceId returns 400");

    const resPatchInv404 = await patchInvoice(
      new NextRequest("http://localhost:3000/api/invoices", {
        method: "PATCH",
        body: JSON.stringify({ invoiceId: "non-existent-invoice" }),
      })
    );
    assert(resPatchInv404.status === 404, "PATCH /api/invoices invoice not found returns 404");

    const resSettleInv = await patchInvoice(
      new NextRequest("http://localhost:3000/api/invoices", {
        method: "PATCH",
        body: JSON.stringify({ invoiceId: createdInvoiceId, paymentMethod: PaymentMethod.CARD }),
      })
    );
    assert(resSettleInv.status === 200, "PATCH /api/invoices invoice settled into unified ledger");
    const settleData = await resSettleInv.json();
    if (settleData.transaction?.id) cleanupTxnIds.push(settleData.transaction.id);

    // PATCH catch block
    const resInvPatchCatch = await patchInvoice(new NextRequest("http://localhost:3000/api/invoices", { method: "PATCH", body: "invalid{" }));
    assert(resInvPatchCatch.status === 500, "PATCH /api/invoices malformed json returns 500");

    // ==========================================
    // 9. HR Leaves (/api/hr/leaves)
    // ==========================================
    console.log("\n[9] Testing /api/hr/leaves...");
    // 9.1 GET leaves
    const resLeavesGet = await getLeaves();
    assert(resLeavesGet.status === 200, "GET /api/hr/leaves returns 200");

    const origLeaveFind = prisma.leave.findMany;
    (prisma.leave as any).findMany = async () => {
      throw new Error("Simulated leave query failure");
    };
    const resLeaveGetCatch = await getLeaves();
    prisma.leave.findMany = origLeaveFind;
    assert(resLeaveGetCatch.status === 500, "GET /api/hr/leaves error returns 500");

    // Create a leave entry for PATCH test
    const leave = await prisma.leave.create({
      data: {
        staffId: testStaff.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        reason: "Personal leave",
        status: LeaveStatus.PENDING,
      },
    });
    cleanupLeaveIds.push(leave.id);

    // 9.2 PATCH leave status
    const resLeavePatchNoBody = await patchLeave(new NextRequest("http://localhost:3000/api/hr/leaves", { method: "PATCH", body: JSON.stringify({}) }));
    assert(resLeavePatchNoBody.status === 400, "PATCH /api/hr/leaves missing leaveId/status returns 400");

    const resLeaveApprove = await patchLeave(
      new NextRequest("http://localhost:3000/api/hr/leaves", {
        method: "PATCH",
        body: JSON.stringify({ leaveId: leave.id, status: LeaveStatus.APPROVED }),
      })
    );
    assert(resLeaveApprove.status === 200, "PATCH /api/hr/leaves APPROVED returns 200");

    // PATCH catch block
    const resLeavePatchCatch = await patchLeave(new NextRequest("http://localhost:3000/api/hr/leaves", { method: "PATCH", body: "invalid{" }));
    assert(resLeavePatchCatch.status === 500, "PATCH /api/hr/leaves malformed json returns 500");

    // ==========================================
    // 10. Unified Transactions Ledger (/api/transactions)
    // ==========================================
    console.log("\n[10] Testing /api/transactions...");
    // 10.1 GET with filters and summary aggregate
    const resTxnGet = await getTransactions(
      new NextRequest("http://localhost:3000/api/transactions?category=MEMBERSHIP&paymentMethod=UPI&limit=25")
    );
    assert(resTxnGet.status === 200, "GET /api/transactions with category/paymentMethod returns 200");

    const resTxnAll = await getTransactions(new NextRequest("http://localhost:3000/api/transactions"));
    assert(resTxnAll.status === 200, "GET /api/transactions returns 200");

    // GET catch block
    const origTxnFindMany = prisma.transaction.findMany;
    (prisma.transaction as any).findMany = async () => {
      throw new Error("Simulated transaction list error");
    };
    const resTxnGetCatch = await getTransactions(new NextRequest("http://localhost:3000/api/transactions"));
    prisma.transaction.findMany = origTxnFindMany;
    assert(resTxnGetCatch.status === 500, "GET /api/transactions error returns 500");

    // 10.2 POST validations
    const resTxnMissing = await postTransaction(
      new NextRequest("http://localhost:3000/api/transactions", { method: "POST", body: JSON.stringify({ amount: 500 }) })
    );
    assert(resTxnMissing.status === 400, "POST /api/transactions missing required fields returns 400");

    // Standalone transaction
    const resTxnStandalone = await postTransaction(
      new NextRequest("http://localhost:3000/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: TransactionType.CORPORATE_INVOICE,
          category: TransactionCategory.CORPORATE,
          amount: 1500,
          paymentMethod: PaymentMethod.CASH,
          notes: "Equipment rental deposit",
        }),
      })
    );
    assert(resTxnStandalone.status === 200, "POST /api/transactions standalone transaction succeeds");
    const standaloneData = await resTxnStandalone.json();
    cleanupTxnIds.push(standaloneData.transaction.id);

    // Transaction linked to Court Booking (lines 100-109)
    const resTxnBooking = await postTransaction(
      new NextRequest("http://localhost:3000/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: TransactionType.COURT_BOOKING,
          category: TransactionCategory.COURT,
          amount: 800,
          paymentMethod: PaymentMethod.UPI,
          courtBookingId: walkInData.booking.id,
        }),
      })
    );
    assert(resTxnBooking.status === 200, "POST /api/transactions linked to court booking succeeds");
    const bookTxnData = await resTxnBooking.json();
    cleanupTxnIds.push(bookTxnData.transaction.id);

    // Transaction linked to Shop Order (lines 112-122)
    const resTxnOrder = await postTransaction(
      new NextRequest("http://localhost:3000/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: TransactionType.SHOP_PURCHASE,
          category: TransactionCategory.SHOP,
          amount: 2500,
          paymentMethod: PaymentMethod.UPI,
          shopOrderId: storeOrderData.order.id,
        }),
      })
    );
    assert(resTxnOrder.status === 200, "POST /api/transactions linked to shop order succeeds");
    const orderTxnData = await resTxnOrder.json();
    cleanupTxnIds.push(orderTxnData.transaction.id);

    // Transaction linked to Bar Tab (lines 125-151)
    const resTxnBar = await postTransaction(
      new NextRequest("http://localhost:3000/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: TransactionType.BAR_BILL,
          category: TransactionCategory.BAR,
          amount: 400,
          paymentMethod: PaymentMethod.UPI,
          barTabId: createdTabId,
        }),
      })
    );
    assert(resTxnBar.status === 200, "POST /api/transactions linked to bar tab succeeds and closes tab");
    const barTxnData = await resTxnBar.json();
    cleanupTxnIds.push(barTxnData.transaction.id);

    // POST catch block
    const resTxnPostCatch = await postTransaction(new NextRequest("http://localhost:3000/api/transactions", { method: "POST", body: "invalid{" }));
    assert(resTxnPostCatch.status === 500, "POST /api/transactions malformed json returns 500");
  } finally {
    // Isolated Cleanup
    if (cleanupTxnIds.length > 0) {
      await prisma.transaction.deleteMany({ where: { id: { in: cleanupTxnIds } } }).catch(() => {});
    }
    if (cleanupBookingIds.length > 0) {
      await prisma.courtBooking.deleteMany({ where: { id: { in: cleanupBookingIds } } }).catch(() => {});
    }
    if (cleanupOrderIds.length > 0) {
      await prisma.shopOrderItem.deleteMany({ where: { orderId: { in: cleanupOrderIds } } }).catch(() => {});
      await prisma.shopOrder.deleteMany({ where: { id: { in: cleanupOrderIds } } }).catch(() => {});
    }
    if (cleanupTabIds.length > 0) {
      await prisma.barOrderItem.deleteMany({ where: { tabId: { in: cleanupTabIds } } }).catch(() => {});
      await prisma.barTab.deleteMany({ where: { id: { in: cleanupTabIds } } }).catch(() => {});
    }
    if (cleanupInvoiceIds.length > 0) {
      await prisma.invoice.deleteMany({ where: { id: { in: cleanupInvoiceIds } } }).catch(() => {});
    }
    if (cleanupLeaveIds.length > 0) {
      await prisma.leave.deleteMany({ where: { id: { in: cleanupLeaveIds } } }).catch(() => {});
    }
    if (cleanupProductIds.length > 0) {
      await prisma.shopProduct.deleteMany({ where: { id: { in: cleanupProductIds } } }).catch(() => {});
    }
    await prisma.member.delete({ where: { id: member.id } }).catch(() => {});
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runOperationsWhitebox().catch((err) => {
  console.error("Operations whitebox test failed:", err);
  process.exit(1);
});
