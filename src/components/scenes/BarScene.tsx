"use client";

import React, { useState, useEffect } from "react";
import {
  Coffee,
  UtensilsCrossed,
  Receipt,
  Users,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  DollarSign,
  ChefHat,
  Flame,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency, formatTime } from "@/lib/utils";
import { PaymentModal } from "../PaymentModal";

export function BarScene() {
  const [tables, setTables] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [openTabs, setOpenTabs] = useState<any[]>([]);
  const [kitchenQueue, setKitchenQueue] = useState<any[]>([]);
  const [totalBarEarningsToday, setTotalBarEarningsToday] = useState<number>(0);
  const [settledToday, setSettledToday] = useState<any[]>([]);
  const [activeTabSubView, setActiveTabSubView] = useState<"TABLES" | "KITCHEN" | "CLOSING">("TABLES");

  // Selected Table for Tab Details / Add Items
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [showOpenTabModal, setShowOpenTabModal] = useState(false);
  const [openTabMemberId, setOpenTabMemberId] = useState<string>("");
  const [openTabGuestName, setOpenTabGuestName] = useState<string>("");

  // Add Item to Tab Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("");
  const [itemQty, setItemQty] = useState(1);
  const [kitchenNotes, setKitchenNotes] = useState("");

  // Payment Modal for Settling Tab
  const [settlingTab, setSettlingTab] = useState<any | null>(null);

  // Fetch Data
  const fetchData = async () => {
    try {
      const [tablesRes, menuRes, membersRes, tabsRes] = await Promise.all([
        fetch("/api/bar/tables"),
        fetch("/api/bar/menu"),
        fetch("/api/members"),
        fetch("/api/bar/tabs"),
      ]);

      const tablesData = await tablesRes.json();
      const menuData = await menuRes.json();
      const membersData = await membersRes.json();
      const tabsData = await tabsRes.json();

      if (tablesData.success) {
        setTables(tablesData.tables);
        // keep selectedTable in sync
        if (selectedTable) {
          const freshSelected = tablesData.tables.find((t: any) => t.id === selectedTable.id);
          if (freshSelected) setSelectedTable(freshSelected);
        } else if (tablesData.tables.length > 0) {
          setSelectedTable(tablesData.tables[0]);
        }
      }
      if (menuData.success) {
        setMenuItems(menuData.menuItems);
        if (!selectedMenuItemId && menuData.menuItems.length > 0) {
          setSelectedMenuItemId(menuData.menuItems[0].id);
        }
      }
      if (membersData.success) {
        setMembers(membersData.members);
      }
      if (tabsData.success) {
        setOpenTabs(tabsData.openTabs);
        setKitchenQueue(tabsData.kitchenQueue);
        setTotalBarEarningsToday(tabsData.totalBarEarningsToday);
        setSettledToday(tabsData.settledToday);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Polling every 3.5 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3500);
    return () => clearInterval(interval);
  }, []);

  // Action: Open New Tab
  const handleOpenTab = async () => {
    if (!selectedTable) return;
    try {
      const res = await fetch("/api/bar/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "OPEN_TAB",
          tableId: selectedTable.id,
          memberId: openTabMemberId || null,
          guestName: openTabMemberId ? null : openTabGuestName || "Bar Guests",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowOpenTabModal(false);
        setOpenTabGuestName("");
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Action: Add Item to Tab
  const handleAddItemToTab = async (tabId: string) => {
    try {
      const res = await fetch("/api/bar/tabs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADD_ITEMS",
          tabId,
          items: [
            {
              menuItemId: selectedMenuItemId,
              quantity: itemQty,
              kitchenNotes,
            },
          ],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddItemModal(false);
        setKitchenNotes("");
        setItemQty(1);
        fetchData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Action: Update Kitchen Status (PREPARING -> READY -> SERVED)
  const handleUpdateKitchenStatus = async (
    orderItemId: string,
    kitchenStatus: "READY" | "SERVED"
  ) => {
    try {
      const res = await fetch("/api/bar/tabs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderItemId, kitchenStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const activeTabOnSelectedTable = selectedTable?.tabs?.[0];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Coffee className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-white">Scene 4: Bar, Cafeteria & Kitchen Display</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            6 Tracked Tables • Automatic Member Discount Without Asking • Running Tabs • Kitchen Prep Queue.
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTabSubView("TABLES")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTabSubView === "TABLES"
                ? "bg-slate-800 text-amber-400 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <UtensilsCrossed className="w-3.5 h-3.5" /> Table Tabs ({openTabs.length})
          </button>

          <button
            onClick={() => setActiveTabSubView("KITCHEN")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTabSubView === "KITCHEN"
                ? "bg-slate-800 text-emerald-400 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ChefHat className="w-3.5 h-3.5" /> Kitchen Queue ({kitchenQueue.length})
          </button>

          <button
            onClick={() => setActiveTabSubView("CLOSING")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTabSubView === "CLOSING"
                ? "bg-slate-800 text-sky-400 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Receipt className="w-3.5 h-3.5" /> Closing Earnings
          </button>
        </div>
      </div>

      {/* VIEW 1: TABLES & ACTIVE TABS */}
      {activeTabSubView === "TABLES" && (
        <div className="space-y-6">
          {/* 6 Tables Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {tables.map((table) => {
              const hasOpenTab = table.tabs && table.tabs.length > 0;
              const isSelected = selectedTable?.id === table.id;

              return (
                <div
                  key={table.id}
                  onClick={() => setSelectedTable(table)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                    isSelected
                      ? "ring-2 ring-amber-500 bg-slate-800/90 border-amber-500"
                      : hasOpenTab
                      ? "bg-amber-950/20 border-amber-700/60 hover:border-amber-500"
                      : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-mono text-xs font-bold text-white">
                        T-{table.tableNumber}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                          hasOpenTab
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-emerald-500/20 text-emerald-400"
                        }`}
                      >
                        {hasOpenTab ? "Occupied" : "Free"}
                      </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-300 truncate">{table.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Capacity: {table.capacity}p</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex justify-between items-center">
                    {hasOpenTab ? (
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {formatCurrency(table.tabs[0].finalAmount)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-emerald-500 font-semibold">Available</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active Tab Details & Menu Order Station */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Tab Bill & Active Items (2 Cols) */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              {selectedTable ? (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                    <div>
                      <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                        {selectedTable.name}
                      </span>
                      <h2 className="text-lg font-bold text-white">
                        {activeTabOnSelectedTable
                          ? `Tab #${activeTabOnSelectedTable.tabNumber}`
                          : "No Active Running Tab"}
                      </h2>
                    </div>

                    {activeTabOnSelectedTable ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowAddItemModal(true)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Food/Drinks
                        </button>
                        <button
                          onClick={() => setSettlingTab(activeTabOnSelectedTable)}
                          className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950 flex items-center gap-1.5"
                        >
                          <Receipt className="w-3.5 h-3.5" /> Settle Tab (
                          {formatCurrency(activeTabOnSelectedTable.finalAmount)})
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowOpenTabModal(true)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-amber-950 flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" /> Open Running Tab
                      </button>
                    )}
                  </div>

                  {activeTabOnSelectedTable ? (
                    <div className="space-y-4">
                      {/* Customer / Member Info Banner */}
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                        <div>
                          <span className="text-slate-400">Billed to: </span>
                          <span className="font-bold text-white">
                            {activeTabOnSelectedTable.member?.name ||
                              activeTabOnSelectedTable.guestName}
                          </span>
                          {activeTabOnSelectedTable.member && (
                            <span className="text-amber-400 font-mono text-[11px] ml-2">
                              [{activeTabOnSelectedTable.member.planTier} MEMBER]
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[11px] font-mono">
                          Opened: {formatTime(activeTabOnSelectedTable.openedAt)}
                        </span>
                      </div>

                      {/* Items Ordered List */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Ordered Items & Kitchen Status:
                        </h4>

                        {activeTabOnSelectedTable.items.length === 0 ? (
                          <div className="p-6 text-center text-slate-500 text-xs">
                            No items ordered on this tab yet. Click "+ Add Food/Drinks" above.
                          </div>
                        ) : (
                          activeTabOnSelectedTable.items.map((item: any) => (
                            <div
                              key={item.id}
                              className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white">
                                    {item.menuItem.name}
                                  </span>
                                  <span className="text-slate-400 font-mono">
                                    × {item.quantity}
                                  </span>
                                </div>
                                {item.kitchenNotes && (
                                  <p className="text-[11px] text-amber-400/80 italic mt-0.5">
                                    Note: {item.kitchenNotes}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-4">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    item.kitchenStatus === "SERVED"
                                      ? "bg-slate-800 text-slate-400"
                                      : item.kitchenStatus === "READY"
                                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  }`}
                                >
                                  {item.kitchenStatus}
                                </span>
                                <span className="font-mono font-bold text-white min-w-[60px] text-right">
                                  {formatCurrency(item.totalPrice)}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Calculation Breakdown with Shared Utility */}
                      <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2 text-xs">
                        <div className="flex justify-between text-slate-400">
                          <span>Subtotal:</span>
                          <span>{formatCurrency(activeTabOnSelectedTable.subtotal)}</span>
                        </div>
                        {activeTabOnSelectedTable.discountAmount > 0 && (
                          <div className="flex justify-between text-emerald-400 font-medium">
                            <span>
                              Member Discount (
                              {activeTabOnSelectedTable.member?.planTier === "GOLD"
                                ? "20%"
                                : activeTabOnSelectedTable.member?.planTier === "SILVER"
                                ? "10%"
                                : "5%"}
                              ):
                            </span>
                            <span>-{formatCurrency(activeTabOnSelectedTable.discountAmount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-400">
                          <span>GST (5%):</span>
                          <span>{formatCurrency(activeTabOnSelectedTable.taxAmount)}</span>
                        </div>
                        <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                          <span>Total Amount Due:</span>
                          <span className="text-amber-400">
                            {formatCurrency(activeTabOnSelectedTable.finalAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-16 text-center text-slate-500 space-y-3">
                      <Coffee className="w-12 h-12 mx-auto text-slate-700" />
                      <p className="text-sm">Table is ready for arriving players.</p>
                      <button
                        onClick={() => setShowOpenTabModal(true)}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-amber-950"
                      >
                        Open Tab for this Table
                      </button>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Right: Quick Menu Catalog (1 Col) */}
            <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-amber-400" /> Bar & Cafeteria Menu
              </h3>
              <p className="text-[11px] text-slate-400">
                Click any item to dispatch an order ticket to the kitchen display.
              </p>

              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 hover:border-slate-700 flex justify-between items-center transition text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {item.category} • ~{item.prepTimeMinutes}m prep
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-amber-400">
                        {formatCurrency(item.price)}
                      </span>
                      {activeTabOnSelectedTable && (
                        <button
                          onClick={() => {
                            setSelectedMenuItemId(item.id);
                            setShowAddItemModal(true);
                          }}
                          className="p-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition"
                          title="Add to active tab"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: KITCHEN DISPLAY SYSTEM (KDS) */}
      {activeTabSubView === "KITCHEN" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">
                Live Kitchen Display System (KDS Prep Queue)
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              {kitchenQueue.length} Active Ticket(s) in Prep
            </span>
          </div>

          {kitchenQueue.length === 0 ? (
            <div className="py-16 text-center text-slate-500 space-y-2">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-600/40" />
              <p className="text-sm">Kitchen is all caught up! No pending food order tickets.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kitchenQueue.map((item) => {
                const isReady = item.kitchenStatus === "READY";
                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border space-y-3 transition ${
                      isReady
                        ? "bg-emerald-950/20 border-emerald-500/60"
                        : "bg-slate-950 border-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 font-mono">
                        {item.tab.table.name}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isReady
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse"
                            : "bg-amber-500/20 text-amber-300"
                        }`}
                      >
                        {item.kitchenStatus}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {item.quantity} × {item.menuItem.name}
                      </h4>
                      {item.kitchenNotes && (
                        <p className="text-xs text-amber-400/90 mt-1 italic">
                          "{item.kitchenNotes}"
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1">
                        Ordered at: {formatTime(item.orderedAt)}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex gap-2">
                      {!isReady ? (
                        <button
                          onClick={() => handleUpdateKitchenStatus(item.id, "READY")}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <Flame className="w-3.5 h-3.5" /> Food Ready on Pass
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateKitchenStatus(item.id, "SERVED")}
                          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Served to Table
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: CLOSING TIME BAR EARNINGS */}
      {activeTabSubView === "CLOSING" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="text-xs font-semibold text-sky-400 uppercase">
                End-of-Day Shift Audit
              </span>
              <h2 className="text-base font-bold text-white mt-0.5">
                Bar & Cafeteria Closing Earnings
              </h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Total Bar Revenue Today</p>
              <p className="text-2xl font-extrabold text-emerald-400">
                {formatCurrency(totalBarEarningsToday)}
              </p>
            </div>
          </div>

          {/* Settled Tabs Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Tab #</th>
                  <th className="py-2.5 px-3">Table</th>
                  <th className="py-2.5 px-3">Billed To</th>
                  <th className="py-2.5 px-3">Payment Method</th>
                  <th className="py-2.5 px-3">Closed Time</th>
                  <th className="py-2.5 px-3 text-right">Settled Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {settledToday.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      No bar tabs have been closed yet today.
                    </td>
                  </tr>
                ) : (
                  settledToday.map((tab) => (
                    <tr key={tab.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono font-medium text-white">
                        {tab.tabNumber}
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-semibold">{tab.table.name}</td>
                      <td className="py-3 px-3 text-slate-300">
                        {tab.member?.name || tab.guestName || "Walk-in"}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded font-mono text-[10px]">
                          {tab.paymentMethod || "UPI"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-mono">
                        {tab.closedAt ? formatTime(tab.closedAt) : "-"}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-400 font-mono">
                        {formatCurrency(tab.finalAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Open New Tab */}
      {showOpenTabModal && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">
                Open Running Tab for {selectedTable.name}
              </h3>
              <button
                onClick={() => setShowOpenTabModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Select Member (for Auto-Discount)</label>
                <select
                  value={openTabMemberId}
                  onChange={(e) => setOpenTabMemberId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="">Non-Member / Walk-In Guests</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.planTier} - {m.plan.barDiscountPercent}% Off Bar)
                    </option>
                  ))}
                </select>
              </div>

              {!openTabMemberId && (
                <div>
                  <label className="text-xs text-slate-400">Guest Group / Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Tennis Court 1 Group"
                    value={openTabGuestName}
                    onChange={(e) => setOpenTabGuestName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowOpenTabModal(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleOpenTab}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold"
              >
                Confirm Open Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Item to Tab */}
      {showAddItemModal && activeTabOnSelectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">
                Add Items to Tab #{activeTabOnSelectedTable.tabNumber}
              </h3>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Menu Item</label>
                <select
                  value={selectedMenuItemId}
                  onChange={(e) => setSelectedMenuItemId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({formatCurrency(item.price)}) - {item.category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={itemQty}
                  onChange={(e) => setItemQty(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Kitchen / Barista Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. Less sugar, extra ice, dressing on side"
                  value={kitchenNotes}
                  onChange={(e) => setKitchenNotes(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowAddItemModal(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAddItemToTab(activeTabOnSelectedTable.id)}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
              >
                Send to Kitchen Prep
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Tab via PaymentModal */}
      {settlingTab && (
        <PaymentModal
          isOpen={!!settlingTab}
          onClose={() => setSettlingTab(null)}
          amount={settlingTab.finalAmount}
          title={`Settle Bar Tab - ${settlingTab.table?.name}`}
          notes={`Bar bill settled: Tab #${settlingTab.tabNumber} (${settlingTab.items?.length || 0} items)`}
          type="BAR_BILL"
          category="BAR"
          barTabId={settlingTab.id}
          memberId={settlingTab.memberId || undefined}
          memberName={settlingTab.member?.name || settlingTab.guestName || "Bar Guests"}
          onSuccess={() => {
            fetchData();
            setSettlingTab(null);
          }}
        />
      )}
    </div>
  );
}
