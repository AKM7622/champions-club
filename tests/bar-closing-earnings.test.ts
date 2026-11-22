import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot } from "react-dom/client";
import { NextRequest } from "next/server";
import { GET as getBarTabs, POST as postBarTab, PATCH as patchBarTab } from "../src/app/api/bar/tabs/route";
import { POST as postTransaction } from "../src/app/api/transactions/route";
import { BarScene } from "../src/components/scenes/BarScene";
import { MemberScene } from "../src/components/scenes/MemberScene";
import { CourtScene } from "../src/components/scenes/CourtScene";
import { ShopScene } from "../src/components/scenes/ShopScene";
import { prisma } from "../src/lib/db";
import { TabStatus, TableStatus, PaymentMethod, TransactionType, TransactionCategory, PlanTier, KitchenStatus } from "@prisma/client";

async function runBarClosingEarningsTests() {
  console.log("=== STARTING BAR CLOSING EARNINGS & SCENE 4 TEST SUITE ===");
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
  // 1. Scene 4 BarScene Component Rendering
  // ==========================================
  console.log("\n[1] Testing Scene 4 BarScene Closing Earnings rendering...");

  // 1.1 Empty settled tabs view
  const emptyHtml = renderToStaticMarkup(
    React.createElement(BarScene, {
      initialView: "CLOSING",
      initialSettledToday: [],
      initialTotalEarnings: 0,
    })
  );
  assert(emptyHtml.includes("No bar tabs have been closed yet today."), "Empty state displays when no tabs are closed");
  assert(emptyHtml.includes("Bar &amp; Cafeteria Closing Earnings") || emptyHtml.includes("Bar & Cafeteria Closing Earnings"), "Closing earnings heading is present");

  // 1.2 Settled tab with valid table
  const normalTab = {
    id: "tab-with-table",
    tabNumber: "TAB-01-999",
    table: { id: "t1", name: "High-Top 1", tableNumber: 1 },
    member: { id: "m1", name: "Alice Champion" },
    guestName: null,
    paymentMethod: "CARD",
    closedAt: new Date("2026-11-22T14:30:00Z").toISOString(),
    finalAmount: 1250,
  };

  const normalHtml = renderToStaticMarkup(
    React.createElement(BarScene, {
      initialView: "CLOSING",
      initialSettledToday: [normalTab],
      initialTotalEarnings: 1250,
    })
  );
  assert(normalHtml.includes("TAB-01-999"), "Tab number is rendered");
  assert(normalHtml.includes("High-Top 1"), "Table name is rendered for tab with table");
  assert(normalHtml.includes("Alice Champion"), "Member name is rendered");
  assert(normalHtml.includes("CARD"), "Payment method is rendered");

  // 1.3 CRITICAL: Settled tab with table = null (Counter / Takeaway / Unassigned Tab)
  const tabWithoutTableNull = {
    id: "tab-no-table-null",
    tabNumber: "TAB-BAR-101",
    table: null,
    member: null,
    guestName: "Walk-in Golfer",
    paymentMethod: "UPI",
    closedAt: new Date("2026-11-22T15:00:00Z").toISOString(),
    finalAmount: 580,
  };

  let nullTableRenderError: any = null;
  let nullTableHtml = "";
  try {
    nullTableHtml = renderToStaticMarkup(
      React.createElement(BarScene, {
        initialView: "CLOSING",
        initialSettledToday: [tabWithoutTableNull],
        initialTotalEarnings: 580,
      })
    );
  } catch (err) {
    nullTableRenderError = err;
  }
  assert(!nullTableRenderError, "Rendering tab with table=null does NOT throw runtime exception");
  assert(nullTableHtml.includes("Quick Bar / Counter"), "tab with table=null renders 'Quick Bar / Counter' fallback");
  assert(nullTableHtml.includes("TAB-BAR-101"), "Tab number TAB-BAR-101 rendered");
  assert(nullTableHtml.includes("Walk-in Golfer"), "Guest name rendered");

  // 1.4 CRITICAL: Settled tab with table = undefined
  const tabWithoutTableUndefined = {
    id: "tab-no-table-undef",
    tabNumber: "TAB-BAR-102",
    table: undefined,
    member: null,
    guestName: null, // Walk-in fallback
    paymentMethod: null, // Fallback to UPI
    closedAt: null, // Fallback to "-"
    finalAmount: 0,
  };

  let undefTableRenderError: any = null;
  let undefTableHtml = "";
  try {
    undefTableHtml = renderToStaticMarkup(
      React.createElement(BarScene, {
        initialView: "CLOSING",
        initialSettledToday: [tabWithoutTableUndefined],
        initialTotalEarnings: 0,
      })
    );
  } catch (err) {
    undefTableRenderError = err;
  }
  assert(!undefTableRenderError, "Rendering tab with table=undefined does NOT throw runtime exception");
  assert(undefTableHtml.includes("Quick Bar / Counter"), "tab with table=undefined renders 'Quick Bar / Counter' fallback");
  assert(undefTableHtml.includes("Walk-in"), "null guest and null member falls back to 'Walk-in'");
  assert(undefTableHtml.includes("UPI"), "null paymentMethod falls back to 'UPI'");
  assert(undefTableHtml.includes("-"), "null closedAt falls back to '-'");

  // 1.5 Multiple settled tabs in closing report including mixed table and no-table tabs
  const mixedHtml = renderToStaticMarkup(
    React.createElement(BarScene, {
      initialView: "CLOSING",
      initialSettledToday: [normalTab, tabWithoutTableNull, tabWithoutTableUndefined],
      initialTotalEarnings: 1830,
    })
  );
  assert(mixedHtml.includes("High-Top 1"), "Mixed report includes normal table");
  assert(mixedHtml.includes("Quick Bar / Counter"), "Mixed report includes counter fallbacks");
  assert(mixedHtml.includes("Alice Champion"), "Mixed report includes member");
  assert(mixedHtml.includes("Walk-in Golfer"), "Mixed report includes guest");
  assert(mixedHtml.includes("Walk-in"), "Mixed report includes walk-in fallback");

  // 1.6 Edge case: initialSettledToday = null / undefined
  let nullArrayRenderError: any = null;
  let nullArrayHtml = "";
  try {
    nullArrayHtml = renderToStaticMarkup(
      React.createElement(BarScene, {
        initialView: "CLOSING",
        initialSettledToday: null as any,
        initialTotalEarnings: null as any,
      })
    );
  } catch (err) {
    nullArrayRenderError = err;
  }
  assert(!nullArrayRenderError, "Rendering with initialSettledToday=null does NOT throw runtime exception");
  assert(nullArrayHtml.includes("No bar tabs have been closed yet today."), "Empty state displays safely on null array");

  // 1.7 Edge case: TABLES view renders active running tab safely
  const tablesHtml = renderToStaticMarkup(
    React.createElement(BarScene, {
      initialView: "TABLES",
    })
  );
  assert(tablesHtml.includes("Scene 4: Bar, Cafeteria") && tablesHtml.includes("Kitchen Display"), "TABLES view renders banner");

  // ==========================================
  // 2. Kitchen Display System (KDS) Queue Rendering
  // ==========================================
  console.log("\n[2] Testing KDS Queue rendering with missing / null table relations...");

  // 2.1 Empty kitchen queue
  const emptyKdsHtml = renderToStaticMarkup(
    React.createElement(BarScene, {
      initialView: "KITCHEN",
      initialKitchenQueue: [],
    })
  );
  assert(emptyKdsHtml.includes("Kitchen is all caught up!"), "Empty KDS shows caught up message");

  // 2.2 Kitchen order item with table = null
  const kdsItemNullTable = {
    id: "order-null-table",
    quantity: 2,
    kitchenStatus: "PREPARING",
    kitchenNotes: "No ice",
    orderedAt: new Date().toISOString(),
    menuItem: { name: "Iced Cold Brew" },
    tab: {
      id: "tab-kds-1",
      table: null,
    },
  };

  let kdsRenderError: any = null;
  let kdsHtml = "";
  try {
    kdsHtml = renderToStaticMarkup(
      React.createElement(BarScene, {
        initialView: "KITCHEN",
        initialKitchenQueue: [kdsItemNullTable],
      })
    );
  } catch (err) {
    kdsRenderError = err;
  }
  assert(!kdsRenderError, "KDS item with tab.table=null does NOT throw runtime exception");
  assert(kdsHtml.includes("Quick Bar / Counter"), "KDS item with tab.table=null renders fallback");
  assert(kdsHtml.includes("Iced Cold Brew"), "Menu item name renders properly");
  assert(kdsHtml.includes("Food Ready on Pass"), "Action button for PREPARING item is present");

  // 2.3 Kitchen order item with tab = undefined or menuItem = undefined
  const kdsItemMissingTab = {
    id: "order-missing-tab",
    quantity: 1,
    kitchenStatus: "READY",
    kitchenNotes: null,
    orderedAt: new Date().toISOString(),
    menuItem: null,
    tab: null,
  };

  let kdsMissingError: any = null;
  let kdsMissingHtml = "";
  try {
    kdsMissingHtml = renderToStaticMarkup(
      React.createElement(BarScene, {
        initialView: "KITCHEN",
        initialKitchenQueue: [kdsItemMissingTab],
      })
    );
  } catch (err) {
    kdsMissingError = err;
  }
  assert(!kdsMissingError, "KDS item with null tab and menuItem does NOT throw runtime exception");
  assert(kdsMissingHtml.includes("Quick Bar / Counter"), "KDS item with null tab renders fallback");
  assert(kdsMissingHtml.includes("Item"), "KDS item with null menuItem renders 'Item' fallback");
  assert(kdsMissingHtml.includes("Served to Table"), "Action button for READY item is present");

  // ==========================================
  // 3. MemberScene Bar Visits Rendering
  // ==========================================
  console.log("\n[3] Testing MemberScene dossier bar tabs rendering with null table...");
  const memberSceneHtml = renderToStaticMarkup(React.createElement(MemberScene));
  assert(memberSceneHtml.length > 0, "MemberScene renders without error");

  const memberWithNullTableTab = {
    id: "m-test-tab-null",
    name: "Dossier Member",
    email: "dossier@member.test",
    phone: "9988776655",
    planTier: "GOLD",
    courtBookings: [],
    shopOrders: [],
    transactions: [],
    barTabs: [
      {
        id: "member-tab-null-table",
        table: null,
        openedAt: null,
        finalAmount: null,
      },
    ],
  };

  const memberSceneDetailHtml = renderToStaticMarkup(
    React.createElement(MemberScene, { initialSelectedMember: memberWithNullTableTab })
  );
  assert(memberSceneDetailHtml.includes("Quick Bar / Counter"), "MemberScene dossier bar tab renders 'Quick Bar / Counter' fallback");
  assert(memberSceneDetailHtml.includes("Dossier Member"), "MemberScene dossier renders member name");

  // ==========================================
  // 4. API Integration: /api/bar/tabs GET settledToday query
  // ==========================================
  console.log("\n[4] Testing /api/bar/tabs API endpoint with settled tabs...");

  // Ensure test table exists
  let barTable = await prisma.barTable.findFirst();
  if (!barTable) {
    barTable = await prisma.barTable.create({
      data: { tableNumber: 88, name: "Bar Patio Table 88", capacity: 4, status: TableStatus.AVAILABLE },
    });
  }

  // Create test closed tab with table
  const testClosedTab = await prisma.barTab.create({
    data: {
      tabNumber: `TAB-TEST-${Date.now().toString().slice(-4)}`,
      tableId: barTable.id,
      guestName: "Settled Test Guest",
      status: TabStatus.CLOSED,
      closedAt: new Date(),
      subtotal: 500,
      discountAmount: 50,
      taxAmount: 22.5,
      finalAmount: 472.5,
      paymentMethod: PaymentMethod.UPI,
    },
    include: { table: true },
  });

  const resTabs = await getBarTabs(new NextRequest("http://localhost:3000/api/bar/tabs"));
  assert(resTabs.status === 200, "GET /api/bar/tabs returns 200");
  const tabsData = await resTabs.json();
  assert(tabsData.success === true, "tabsData.success is true");
  assert(Array.isArray(tabsData.settledToday), "settledToday is an array");
  assert(typeof tabsData.totalBarEarningsToday === "number", "totalBarEarningsToday is a number");
  assert(tabsData.totalBarEarningsToday > 0, "totalBarEarningsToday includes today's settled tabs");

  // Verify that table is included in settledToday tabs
  const foundTab = tabsData.settledToday.find((t: any) => t.id === testClosedTab.id);
  assert(foundTab !== undefined, "Found our newly closed test tab in settledToday");
  assert(foundTab.table !== null && foundTab.table !== undefined, "settledToday tab includes 'table' relation");
  assert(foundTab.table.name === barTable.name, "settledToday tab table.name matches database table name");

  // 4.2 Test GET /api/bar/tabs when a tab in settledToday has table: null (mocked)
  const origFindMany = prisma.barTab.findMany;
  (prisma.barTab as any).findMany = async (args: any) => {
    if (args?.where?.status === TabStatus.CLOSED) {
      return [
        {
          id: "mock-closed-tab-1",
          tabNumber: "TAB-MOCK-01",
          table: null, // simulates a tab with null table
          member: null,
          items: [],
          finalAmount: 350,
          closedAt: new Date(),
        },
        {
          id: "mock-closed-tab-2",
          tabNumber: "TAB-MOCK-02",
          table: { name: "Lounge 3" },
          member: null,
          items: [],
          finalAmount: 150,
          closedAt: new Date(),
        },
      ];
    }
    return origFindMany.call(prisma.barTab, args);
  };

  const resMocked = await getBarTabs(new NextRequest("http://localhost:3000/api/bar/tabs"));
  prisma.barTab.findMany = origFindMany;

  assert(resMocked.status === 200, "GET /api/bar/tabs with null table tabs returns 200");
  const mockedData = await resMocked.json();
  assert(mockedData.totalBarEarningsToday === 500, "totalBarEarningsToday correctly calculated (350 + 150 = 500)");
  assert(mockedData.settledToday.length === 2, "settledToday returns 2 tabs");
  assert(mockedData.settledToday[0].table === null, "Tab 1 table is null as mocked");

  // 4.3 Test GET /api/bar/tabs when tabs have undefined/null finalAmount
  (prisma.barTab as any).findMany = async (args: any) => {
    if (args?.where?.status === TabStatus.CLOSED) {
      return [
        {
          id: "mock-closed-tab-nan",
          tabNumber: "TAB-MOCK-NAN",
          table: null,
          member: null,
          items: [],
          finalAmount: null, // null finalAmount
          closedAt: new Date(),
        },
      ];
    }
    return origFindMany.call(prisma.barTab, args);
  };

  const resNullFinal = await getBarTabs(new NextRequest("http://localhost:3000/api/bar/tabs"));
  prisma.barTab.findMany = origFindMany;
  assert(resNullFinal.status === 200, "GET /api/bar/tabs with null finalAmount returns 200");
  const nullFinalData = await resNullFinal.json();
  assert(nullFinalData.totalBarEarningsToday === 0, "totalBarEarningsToday with null finalAmount is 0 (not NaN)");

  // Clean up created fixture
  await prisma.barTab.delete({ where: { id: testClosedTab.id } }).catch(() => {});

  // 4.4 Test PATCH /api/bar/tabs order item status update
  let testMenuItem = await prisma.barMenuItem.findFirst();
  if (!testMenuItem) {
    testMenuItem = await prisma.barMenuItem.create({
      data: { name: "Latte", category: "BEVERAGE", price: 180, prepTimeMinutes: 5, isAvailable: true },
    });
  }

  const patchTab = await prisma.barTab.create({
    data: {
      tabNumber: `TAB-PATCH-${Date.now().toString().slice(-4)}`,
      tableId: barTable.id,
      guestName: "Patch Test Guest",
      status: TabStatus.OPEN,
    },
  });

  const patchOrderItem = await prisma.barOrderItem.create({
    data: {
      tabId: patchTab.id,
      menuItemId: testMenuItem.id,
      quantity: 1,
      unitPrice: testMenuItem.price,
      totalPrice: testMenuItem.price,
      kitchenStatus: KitchenStatus.PREPARING,
    },
  });

  const resPatch = await patchBarTab(
    new NextRequest("http://localhost:3000/api/bar/tabs", {
      method: "PATCH",
      body: JSON.stringify({
        orderItemId: patchOrderItem.id,
        kitchenStatus: KitchenStatus.READY,
      }),
    })
  );
  assert(resPatch.status === 200, "PATCH /api/bar/tabs returns 200");
  const patchData = await resPatch.json();
  assert(patchData.success === true, "PATCH response success is true");
  assert(patchData.orderItem.kitchenStatus === "READY", "Order item status updated to READY");
  assert(patchData.orderItem.tab !== undefined, "Order item includes tab relation");
  assert(patchData.orderItem.tab.table !== undefined, "Order item tab includes table relation");
  assert(patchData.message.includes("marked as READY"), "PATCH message formatted properly");

  // Cleanup patch items
  await prisma.barOrderItem.delete({ where: { id: patchOrderItem.id } }).catch(() => {});
  await prisma.barTab.delete({ where: { id: patchTab.id } }).catch(() => {});

  // ==========================================
  // 5. Transaction Settlement Robustness
  // ==========================================
  console.log("\n[5] Testing transaction settlement robustness with tabs without tables...");

  // Create an open tab
  const openTab = await prisma.barTab.create({
    data: {
      tabNumber: `TAB-SETTLE-${Date.now().toString().slice(-4)}`,
      tableId: barTable.id,
      guestName: "Settle Guest",
      status: TabStatus.OPEN,
      subtotal: 300,
      finalAmount: 300,
    },
  });

  // Close tab via POST /api/transactions
  const resSettleTxn = await postTransaction(
    new NextRequest("http://localhost:3000/api/transactions", {
      method: "POST",
      body: JSON.stringify({
        type: TransactionType.BAR_BILL,
        category: TransactionCategory.BAR,
        amount: 300,
        paymentMethod: PaymentMethod.UPI,
        barTabId: openTab.id,
      }),
    })
  );
  assert(resSettleTxn.status === 200, "POST /api/transactions successfully settles and closes tab");

  // Verify tab is now CLOSED in DB
  const settledDbTab = await prisma.barTab.findUnique({ where: { id: openTab.id } });
  assert(settledDbTab?.status === TabStatus.CLOSED, "Tab status is updated to CLOSED");
  assert(settledDbTab?.paymentStatus === "PAID", "Tab paymentStatus is updated to PAID");

  // Cleanup
  if (settledDbTab?.transactionId) {
    await prisma.transaction.delete({ where: { id: settledDbTab.transactionId } }).catch(() => {});
  }
  await prisma.barTab.delete({ where: { id: openTab.id } }).catch(() => {});

  // ==========================================
  // 6. Scene 4 BarScene Table Selection Retention Across Polling Intervals
  // ==========================================
  console.log("\n[6] Testing Scene 4 BarScene table selection retention across polling intervals...");

  // 6.1 Static markup rendering with initialTables and initialSelectedTableId
  const sampleTables = [
    { id: "tbl-001", tableNumber: 1, name: "Table 1 - Patio", capacity: 4, tabs: [] },
    {
      id: "tbl-002",
      tableNumber: 2,
      name: "Table 2 - Lounge",
      capacity: 4,
      tabs: [{ id: "tab-2", tabNumber: "TAB-02-10", finalAmount: 450, items: [] }],
    },
    {
      id: "tbl-003",
      tableNumber: 3,
      name: "Table 3 - High Bar",
      capacity: 6,
      tabs: [{ id: "tab-3", tabNumber: "TAB-03-25", finalAmount: 890, items: [] }],
    },
  ];

  const htmlTbl3 = renderToStaticMarkup(
    React.createElement(BarScene, {
      initialView: "TABLES",
      initialTables: sampleTables,
      initialSelectedTableId: "tbl-003",
    })
  );
  assert(htmlTbl3.includes("Table 3 - High Bar"), "Table 3 is rendered as selected title when initialSelectedTableId is tbl-003");
  assert(htmlTbl3.includes("Tab #TAB-03-25"), "Table 3's active running tab details are rendered");
  assert(htmlTbl3.includes("ring-2 ring-amber-500"), "Selected table card has active highlight ring");

  const htmlTblDefault = renderToStaticMarkup(
    React.createElement(BarScene, {
      initialView: "TABLES",
      initialTables: sampleTables,
    })
  );
  assert(htmlTblDefault.includes("Table 1 - Patio"), "Default selection without initialSelectedTableId selects tables[0] (Table 1)");

  // 6.2 Real Mounting & Polling Lifecycle Verification
  const origWindow = (globalThis as any).window;
  const origDocument = (globalThis as any).document;
  const origFetch = (globalThis as any).fetch;
  const origIframe = (globalThis as any).HTMLIFrameElement;

  let mockDoc: any;
  function createMockNode() {
    return {
      nodeType: 1,
      tagName: "DIV",
      childNodes: [] as any[],
      options: [] as any[],
      style: {},
      ownerDocument: mockDoc,
      appendChild(child: any) {
        this.childNodes.push(child);
        child.parentNode = this;
        if (child.tagName === "OPTION") this.options.push(child);
        return child;
      },
      removeChild(child: any) { const i = this.childNodes.indexOf(child); if (i !== -1) this.childNodes.splice(i, 1); return child; },
      insertBefore(newChild: any, refChild: any) { const i = this.childNodes.indexOf(refChild); if (i !== -1) this.childNodes.splice(i, 0, newChild); else this.childNodes.push(newChild); return newChild; },
      setAttribute() {},
      removeAttribute() {},
      addEventListener() {},
      removeEventListener() {},
    };
  }

  mockDoc = {
    nodeType: 9,
    createElement: (tag: string) => {
      const el = createMockNode();
      el.tagName = tag.toUpperCase();
      return el;
    },
    createTextNode: (text: string) => ({ nodeType: 3, nodeValue: text, ownerDocument: mockDoc }),
    createElementNS: (ns: string, tag: string) => {
      const el = createMockNode();
      el.tagName = tag.toUpperCase();
      return el;
    },
    addEventListener() {},
    removeEventListener() {},
  };

  (globalThis as any).window = globalThis;
  (globalThis as any).document = mockDoc;
  (globalThis as any).HTMLIFrameElement = class {};

  // 6.2.1: Selection retention over multiple consecutive polling intervals
  {
    let pollCount = 0;
    const dynamicTables = [
      { id: "tbl-1", tableNumber: 1, name: "Table 1", capacity: 4, tabs: [] },
      { id: "tbl-2", tableNumber: 2, name: "Table 2", capacity: 4, tabs: [] },
      { id: "tbl-3", tableNumber: 3, name: "Table 3", capacity: 4, tabs: [{ id: "tab-3", tabNumber: "TAB-03", finalAmount: 500 }] },
      { id: "tbl-4", tableNumber: 4, name: "Table 4", capacity: 4, tabs: [] },
      { id: "tbl-5", tableNumber: 5, name: "Table 5", capacity: 4, tabs: [] },
      { id: "tbl-6", tableNumber: 6, name: "Table 6", capacity: 4, tabs: [] },
    ];

    (globalThis as any).fetch = async (url: string) => {
      if (url.includes("/api/bar/tables")) {
        pollCount++;
        return {
          json: async () => ({
            success: true,
            tables: dynamicTables.map((t) => ({
              ...t,
              name: t.id === "tbl-3" ? `Table 3 (poll #${pollCount})` : t.name,
              tabs: t.id === "tbl-3" ? [{ id: "tab-3", tabNumber: "TAB-03", finalAmount: 500 + pollCount * 50 }] : t.tabs,
            })),
          }),
        };
      }
      if (url.includes("/api/bar/menu")) return { json: async () => ({ success: true, menuItems: [{ id: "m-1", name: "Coffee", price: 100 }] }) };
      if (url.includes("/api/members")) return { json: async () => ({ success: true, members: [] }) };
      if (url.includes("/api/bar/tabs")) return { json: async () => ({ success: true, openTabs: [], kitchenQueue: [], settledToday: [], totalBarEarningsToday: 0 }) };
      return { json: async () => ({ success: false }) };
    };

    const selectionsHistory: any[] = [];
    const container1 = mockDoc.createElement("div");
    const root1 = createRoot(container1);

    root1.render(
      React.createElement(BarScene, {
        pollIntervalMs: 40,
        initialSelectedTableId: "tbl-3",
        onDataLoaded: (data: any) => {
          if (data.selectedTable) {
            selectionsHistory.push({ ...data.selectedTable });
          }
        },
      })
    );

    // Wait for multiple polling cycles (40ms * 4 = 160ms + margin)
    await new Promise((r) => setTimeout(r, 220));
    root1.unmount();

    assert(pollCount >= 3, `Polling interval fired multiple times in background (fired ${pollCount} times)`);
    assert(selectionsHistory.length >= 3, `Received state updates across polling intervals (count: ${selectionsHistory.length})`);
    const allSelectedTbl3 = selectionsHistory.every((s) => s.id === "tbl-3");
    assert(allSelectedTbl3, "CRITICAL: Table 3 selection was preserved across ALL polling intervals without resetting to Table 1");
    const lastSelection = selectionsHistory[selectionsHistory.length - 1];
    assert(
      lastSelection?.tabs?.[0]?.finalAmount > 500,
      `CRITICAL: Selected Table 3 received fresh live data updates (latest amount: ${lastSelection?.tabs?.[0]?.finalAmount})`
    );
  }

  // 6.2.2: Initial load without initialSelectedTableId selects tables[0]
  {
    let initialSelectedTable: any = null;
    const container2 = mockDoc.createElement("div");
    const root2 = createRoot(container2);

    root2.render(
      React.createElement(BarScene, {
        pollIntervalMs: 50,
        onDataLoaded: (data: any) => {
          if (!initialSelectedTable && data.selectedTable) {
            initialSelectedTable = data.selectedTable;
          }
        },
      })
    );

    await new Promise((r) => setTimeout(r, 60));
    root2.unmount();
    assert(initialSelectedTable?.id === "tbl-1", "Initial load without pre-selection selects tables[0] (Table 1)");
  }

  // 6.2.3: Deleted table fallback to tables[0]
  {
    let deletePollCount = 0;
    let tablesList = [
      { id: "tbl-1", tableNumber: 1, name: "Table 1", capacity: 4, tabs: [] },
      { id: "tbl-2", tableNumber: 2, name: "Table 2", capacity: 4, tabs: [] },
      { id: "tbl-3", tableNumber: 3, name: "Table 3", capacity: 4, tabs: [] },
    ];

    (globalThis as any).fetch = async (url: string) => {
      if (url.includes("/api/bar/tables")) {
        deletePollCount++;
        if (deletePollCount >= 2) {
          tablesList = tablesList.filter((t) => t.id !== "tbl-3");
        }
        return { json: async () => ({ success: true, tables: tablesList }) };
      }
      if (url.includes("/api/bar/menu")) return { json: async () => ({ success: true, menuItems: [] }) };
      if (url.includes("/api/members")) return { json: async () => ({ success: true, members: [] }) };
      if (url.includes("/api/bar/tabs")) return { json: async () => ({ success: true, openTabs: [], kitchenQueue: [], settledToday: [], totalBarEarningsToday: 0 }) };
      return { json: async () => ({ success: false }) };
    };

    let postDeleteSelection: any = null;
    const container3 = mockDoc.createElement("div");
    const root3 = createRoot(container3);

    root3.render(
      React.createElement(BarScene, {
        pollIntervalMs: 40,
        initialSelectedTableId: "tbl-3",
        onDataLoaded: (data: any) => {
          postDeleteSelection = data.selectedTable;
        },
      })
    );

    await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 60));
    root3.unmount();

    assert(postDeleteSelection?.id === "tbl-1", "When selected table is deleted in backend, selection safely falls back to tables[0] (Table 1)");
  }

  // 6.2.4: Empty tables array handling
  {
    (globalThis as any).fetch = async (url: string) => {
      if (url.includes("/api/bar/tables")) return { json: async () => ({ success: true, tables: [] }) };
      if (url.includes("/api/bar/menu")) return { json: async () => ({ success: true, menuItems: [] }) };
      if (url.includes("/api/members")) return { json: async () => ({ success: true, members: [] }) };
      if (url.includes("/api/bar/tabs")) return { json: async () => ({ success: true, openTabs: [], kitchenQueue: [], settledToday: [], totalBarEarningsToday: 0 }) };
      return { json: async () => ({ success: false }) };
    };

    let emptyTableSelection: any = "NOT_NULL";
    const container4 = mockDoc.createElement("div");
    const root4 = createRoot(container4);

    root4.render(
      React.createElement(BarScene, {
        pollIntervalMs: 40,
        onDataLoaded: (data: any) => {
          emptyTableSelection = data.selectedTable;
        },
      })
    );

    await new Promise((r) => setTimeout(r, 60));
    root4.unmount();

    assert(emptyTableSelection === null, "When backend returns empty tables array, selectedTable safely resolves to null without throwing");
  }

  // 6.2.5: Dynamic user table selection via interaction and retention across multiple polling ticks
  {
    let dynamicPollCount = 0;
    const dynamicTables = [
      { id: "tbl-1", tableNumber: 1, name: "Table 1", capacity: 4, tabs: [] },
      { id: "tbl-2", tableNumber: 2, name: "Table 2", capacity: 4, tabs: [] },
      { id: "tbl-3", tableNumber: 3, name: "Table 3", capacity: 4, tabs: [] },
      { id: "tbl-4", tableNumber: 4, name: "Table 4", capacity: 4, tabs: [{ id: "tab-4", tabNumber: "TAB-04", finalAmount: 320 }] },
      { id: "tbl-5", tableNumber: 5, name: "Table 5", capacity: 4, tabs: [] },
      { id: "tbl-6", tableNumber: 6, name: "Table 6", capacity: 4, tabs: [] },
    ];

    (globalThis as any).fetch = async (url: string) => {
      if (url.includes("/api/bar/tables")) {
        dynamicPollCount++;
        return {
          json: async () => ({
            success: true,
            tables: dynamicTables.map((t) => ({
              ...t,
              tabs: t.id === "tbl-4" ? [{ id: "tab-4", tabNumber: "TAB-04", finalAmount: 320 + dynamicPollCount * 30 }] : t.tabs,
            })),
          }),
        };
      }
      if (url.includes("/api/bar/menu")) return { json: async () => ({ success: true, menuItems: [{ id: "m-1", name: "Coffee", price: 100 }] }) };
      if (url.includes("/api/members")) return { json: async () => ({ success: true, members: [] }) };
      if (url.includes("/api/bar/tabs")) return { json: async () => ({ success: true, openTabs: [], kitchenQueue: [], settledToday: [], totalBarEarningsToday: 0 }) };
      return { json: async () => ({ success: false }) };
    };

    const tableSelectRef = { current: null as any };
    let latestSelectedTable: any = null;
    const container5 = mockDoc.createElement("div");
    const root5 = createRoot(container5);

    root5.render(
      React.createElement(BarScene, {
        pollIntervalMs: 35,
        tableSelectRef,
        onDataLoaded: (data: any) => {
          latestSelectedTable = data.selectedTable;
        },
      })
    );

    // Initial load: wait for first fetch -> selects Table 1
    await new Promise((r) => setTimeout(r, 45));
    assert(latestSelectedTable?.id === "tbl-1", "Default initial load starts on Table 1");

    // User dynamically switches to Table 4
    tableSelectRef.current(dynamicTables[3]); // tbl-4
    await new Promise((r) => setTimeout(r, 20));
    assert(latestSelectedTable?.id === "tbl-4", "User selection switches immediately to Table 4");

    // Wait across 3+ subsequent background polling cycles
    await new Promise((r) => setTimeout(r, 140));
    root5.unmount();

    assert(dynamicPollCount >= 3, `Dynamic switching test fired ${dynamicPollCount} background polls`);
    assert(latestSelectedTable?.id === "tbl-4", "CRITICAL: Table 4 selection persisted across subsequent polls after dynamic user click");
    assert(latestSelectedTable?.tabs?.[0]?.finalAmount > 320, "Table 4 received fresh live tab updates from backend");
  }

  // 6.2.6: Rapid switching between tables (T-2 then immediately T-5) under active polling
  {
    const tablesList = [
      { id: "tbl-1", tableNumber: 1, name: "Table 1", capacity: 4, tabs: [] },
      { id: "tbl-2", tableNumber: 2, name: "Table 2", capacity: 4, tabs: [] },
      { id: "tbl-3", tableNumber: 3, name: "Table 3", capacity: 4, tabs: [] },
      { id: "tbl-4", tableNumber: 4, name: "Table 4", capacity: 4, tabs: [] },
      { id: "tbl-5", tableNumber: 5, name: "Table 5", capacity: 4, tabs: [] },
      { id: "tbl-6", tableNumber: 6, name: "Table 6", capacity: 4, tabs: [] },
    ];

    (globalThis as any).fetch = async (url: string) => {
      if (url.includes("/api/bar/tables")) {
        // slight delay to simulate network latency
        await new Promise((r) => setTimeout(r, 10));
        return { json: async () => ({ success: true, tables: tablesList }) };
      }
      if (url.includes("/api/bar/menu")) return { json: async () => ({ success: true, menuItems: [] }) };
      if (url.includes("/api/members")) return { json: async () => ({ success: true, members: [] }) };
      if (url.includes("/api/bar/tabs")) return { json: async () => ({ success: true, openTabs: [], kitchenQueue: [], settledToday: [], totalBarEarningsToday: 0 }) };
      return { json: async () => ({ success: false }) };
    };

    const tableSelectRef = { current: null as any };
    let latestTable: any = null;
    const container6 = mockDoc.createElement("div");
    const root6 = createRoot(container6);

    root6.render(
      React.createElement(BarScene, {
        pollIntervalMs: 30,
        tableSelectRef,
        onDataLoaded: (data: any) => {
          latestTable = data.selectedTable;
        },
      })
    );

    await new Promise((r) => setTimeout(r, 40));

    // Rapid table switches: click T-2 then immediately T-5
    tableSelectRef.current(tablesList[1]); // T-2
    tableSelectRef.current(tablesList[4]); // T-5

    // Wait for in-flight fetch and subsequent poll
    await new Promise((r) => setTimeout(r, 100));
    root6.unmount();

    assert(latestTable?.id === "tbl-5", "CRITICAL: Rapid switching settles cleanly on Table 5 without race-condition reversion to Table 2 or Table 1");
  }

  // 6.2.7: Quick Order Menu Item selection retention across polling ticks
  {
    const menuItems = [
      { id: "m-1", name: "Cappuccino", price: 120, category: "COFFEE" },
      { id: "m-2", name: "Club Sandwich", price: 250, category: "FOOD" },
      { id: "m-3", name: "Protein Shake", price: 200, category: "DRINKS" },
    ];

    (globalThis as any).fetch = async (url: string) => {
      if (url.includes("/api/bar/tables")) return { json: async () => ({ success: true, tables: [{ id: "tbl-1", tableNumber: 1, name: "Table 1", capacity: 4, tabs: [] }] }) };
      if (url.includes("/api/bar/menu")) return { json: async () => ({ success: true, menuItems }) };
      if (url.includes("/api/members")) return { json: async () => ({ success: true, members: [] }) };
      if (url.includes("/api/bar/tabs")) return { json: async () => ({ success: true, openTabs: [], kitchenQueue: [], settledToday: [], totalBarEarningsToday: 0 }) };
      return { json: async () => ({ success: false }) };
    };

    const menuSelectRef = { current: null as any };
    let selectedItemId = "";
    const container7 = mockDoc.createElement("div");
    const root7 = createRoot(container7);

    root7.render(
      React.createElement(BarScene, {
        pollIntervalMs: 35,
        menuSelectRef,
        onDataLoaded: (data: any) => {
          selectedItemId = data.selectedMenuItemId || "";
        },
      })
    );

    await new Promise((r) => setTimeout(r, 45));
    assert(selectedItemId === "m-1", "Menu item initially defaults to first item (m-1)");

    // User selects m-2 (Club Sandwich)
    menuSelectRef.current("m-2");
    await new Promise((r) => setTimeout(r, 20));
    assert(selectedItemId === "m-2", "Menu item selection immediately updates to m-2");

    // Wait across multiple background polls
    await new Promise((r) => setTimeout(r, 120));
    root7.unmount();

    assert(selectedItemId === "m-2", "CRITICAL: Menu item selection m-2 is retained across background polling intervals");
  }

  // 6.2.8: Settling Tab synchronization and retention across polling ticks
  {
    let settlePollCount = 0;
    const testTab = { id: "tab-settle-sync", tabNumber: "TAB-SYNC-1", finalAmount: 400 };

    (globalThis as any).fetch = async (url: string) => {
      if (url.includes("/api/bar/tables")) return { json: async () => ({ success: true, tables: [{ id: "tbl-1", tableNumber: 1, name: "Table 1", capacity: 4, tabs: [] }] }) };
      if (url.includes("/api/bar/menu")) return { json: async () => ({ success: true, menuItems: [] }) };
      if (url.includes("/api/members")) return { json: async () => ({ success: true, members: [] }) };
      if (url.includes("/api/bar/tabs")) {
        settlePollCount++;
        return {
          json: async () => ({
            success: true,
            openTabs: [{ ...testTab, finalAmount: 400 + settlePollCount * 25 }],
            kitchenQueue: [],
            settledToday: [],
            totalBarEarningsToday: 0,
          }),
        };
      }
      return { json: async () => ({ success: false }) };
    };

    const settleTabRef = { current: null as any };
    let observedSettlingTab: any = null;
    const container8 = mockDoc.createElement("div");
    const root8 = createRoot(container8);

    root8.render(
      React.createElement(BarScene, {
        pollIntervalMs: 35,
        settleTabRef,
        onDataLoaded: (data: any) => {
          observedSettlingTab = data.settlingTab;
        },
      })
    );

    await new Promise((r) => setTimeout(r, 45));
    assert(observedSettlingTab === null, "Settling tab is initially null");

    // Open settling tab modal
    settleTabRef.current(testTab);
    await new Promise((r) => setTimeout(r, 20));
    assert(observedSettlingTab?.id === "tab-settle-sync", "Settling tab is set to active tab");

    // Wait across background polling cycles
    await new Promise((r) => setTimeout(r, 120));
    root8.unmount();

    assert(observedSettlingTab?.id === "tab-settle-sync", "CRITICAL: Settling tab modal remains open across polling intervals");
    assert(observedSettlingTab?.finalAmount > 400, "Settling tab received fresh amount updates from open tabs poll");
  }

  // 6.2.9: CourtScene selection retention across background polls
  {
    let courtPoll = 0;
    const sampleMembers = [
      { id: "mem-1", name: "Alice", memberNumber: "CC-1001", planTier: "GOLD" },
      { id: "mem-2", name: "Bob", memberNumber: "CC-1002", planTier: "SILVER" },
    ];

    (globalThis as any).fetch = async (url: string) => {
      if (url.includes("/api/courts")) return { json: async () => ({ success: true, courts: [] }) };
      if (url.includes("/api/bookings")) return { json: async () => ({ success: true, bookings: [] }) };
      if (url.includes("/api/members")) {
        courtPoll++;
        return { json: async () => ({ success: true, members: sampleMembers }) };
      }
      return { json: async () => ({ success: false }) };
    };

    const memberSelectRef = { current: null as any };
    let activeMemberId = "";
    const container9 = mockDoc.createElement("div");
    const root9 = createRoot(container9);

    root9.render(
      React.createElement(CourtScene, {
        pollIntervalMs: 35,
        memberSelectRef,
        onDataLoaded: (data: any) => {
          activeMemberId = data.selectedMemberId;
        },
      })
    );

    await new Promise((r) => setTimeout(r, 45));
    assert(activeMemberId === "mem-1", "CourtScene initial load selects mem-1");

    // User switches to mem-2
    memberSelectRef.current("mem-2");
    await new Promise((r) => setTimeout(r, 20));
    assert(activeMemberId === "mem-2", "CourtScene user switches to mem-2");

    // Wait across polling cycles
    await new Promise((r) => setTimeout(r, 120));
    root9.unmount();

    assert(activeMemberId === "mem-2", "CRITICAL: CourtScene selected member mem-2 preserved across background polls");
  }

  // 6.2.10: ShopScene selection retention across background polls
  {
    const sampleMembers = [
      { id: "mem-1", name: "Alice", memberNumber: "CC-1001", planTier: "GOLD" },
      { id: "mem-2", name: "Bob", memberNumber: "CC-1002", planTier: "SILVER" },
    ];

    (globalThis as any).fetch = async (url: string) => {
      if (url.includes("/api/shop/products")) return { json: async () => ({ success: true, products: [] }) };
      if (url.includes("/api/shop/orders")) return { json: async () => ({ success: true, orders: [] }) };
      if (url.includes("/api/members")) return { json: async () => ({ success: true, members: sampleMembers }) };
      return { json: async () => ({ success: false }) };
    };

    const memberSelectRef = { current: null as any };
    let activeShopMemberId = "";
    const container10 = mockDoc.createElement("div");
    const root10 = createRoot(container10);

    root10.render(
      React.createElement(ShopScene, {
        pollIntervalMs: 35,
        memberSelectRef,
        onDataLoaded: (data: any) => {
          activeShopMemberId = data.selectedMemberId;
        },
      })
    );

    await new Promise((r) => setTimeout(r, 45));
    assert(activeShopMemberId === "mem-1", "ShopScene initial load selects mem-1");

    // User switches to mem-2
    memberSelectRef.current("mem-2");
    await new Promise((r) => setTimeout(r, 20));
    assert(activeShopMemberId === "mem-2", "ShopScene user switches to mem-2");

    // Wait across polling cycles
    await new Promise((r) => setTimeout(r, 120));
    root10.unmount();

    assert(activeShopMemberId === "mem-2", "CRITICAL: ShopScene selected member mem-2 preserved across background polls");
  }

  // Restore global environment
  (globalThis as any).window = origWindow;
  (globalThis as any).document = origDocument;
  (globalThis as any).fetch = origFetch;
  (globalThis as any).HTMLIFrameElement = origIframe;

  // 6.3 Audit tests: CourtScene and ShopScene render without throwing and retain state safely
  const courtHtml = renderToStaticMarkup(React.createElement(CourtScene));
  assert(courtHtml.length > 0, "CourtScene renders without throwing");

  const shopHtml = renderToStaticMarkup(React.createElement(ShopScene));
  assert(shopHtml.length > 0, "ShopScene renders without throwing");

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) process.exit(1);
}

runBarClosingEarningsTests().catch((err) => {
  console.error("Unhandled error in bar closing earnings tests:", err);
  process.exit(1);
});
