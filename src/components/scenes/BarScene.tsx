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
  Pencil,
  Trash2,
  Armchair,
  Check,
} from "lucide-react";
import { formatCurrency, formatTime } from "@/lib/utils";
import { PaymentModal } from "../PaymentModal";
import { useAuth } from "@/contexts/AuthContext";

interface BarSceneProps {
  initialView?: "TABLES" | "KITCHEN" | "CLOSING";
  initialSettledToday?: any[];
  initialKitchenQueue?: any[];
  initialTotalEarnings?: number;
  initialTables?: any[];
  initialSelectedTableId?: string;
  pollIntervalMs?: number;
  onDataLoaded?: (data: {
    tables: any[];
    selectedTable: any;
    selectedMenuItemId?: string;
    settlingTab?: any;
  }) => void;
  onTableSelect?: (table: any) => void;
  tableSelectRef?: React.MutableRefObject<((table: any) => void) | null>;
  menuSelectRef?: React.MutableRefObject<((menuItemId: string) => void) | null>;
  settleTabRef?: React.MutableRefObject<((tab: any) => void) | null>;
}

export function BarScene({
  initialView = "TABLES",
  initialSettledToday = [],
  initialKitchenQueue = [],
  initialTotalEarnings = 0,
  initialTables = [],
  initialSelectedTableId,
  pollIntervalMs = 3500,
  onDataLoaded,
  onTableSelect,
  tableSelectRef,
  menuSelectRef,
  settleTabRef,
}: BarSceneProps = {}) {
  const auth = useAuth?.() || { user: null };
  const user = auth?.user;
  const isChef = user?.role === "CHEF";
  const isCafeManager = user?.role === "CAFE_MANAGER";
  const canManageBar = user?.role === "OWNER" || user?.role === "BAR_STAFF";

  const [tables, setTables] = useState<any[]>(initialTables);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [openTabs, setOpenTabs] = useState<any[]>([]);
  const [kitchenQueue, setKitchenQueue] = useState<any[]>(initialKitchenQueue);
  const [totalBarEarningsToday, setTotalBarEarningsToday] = useState<number>(initialTotalEarnings);
  const [settledToday, setSettledToday] = useState<any[]>(initialSettledToday);

  // Subview resolution based on role
  const resolvedInitialView = isChef ? "KITCHEN" : isCafeManager ? "TABLES" : initialView;
  const [activeTabSubView, setActiveTabSubView] = useState<"TABLES" | "KITCHEN" | "CLOSING">(resolvedInitialView);

  // Sync subview if role changes
  useEffect(() => {
    if (isChef) setActiveTabSubView("KITCHEN");
    else if (isCafeManager) setActiveTabSubView("TABLES");
  }, [isChef, isCafeManager]);

  // Selected Table for Tab Details / Add Items
  const selectedTableIdRef = React.useRef<string | null>(initialSelectedTableId || null);
  const [selectedTable, setSelectedTable] = useState<any | null>(() => {
    if (initialTables && initialTables.length > 0) {
      if (initialSelectedTableId) {
        const matching = initialTables.find((t: any) => t.id === initialSelectedTableId);
        if (matching) return matching;
      }
      return initialTables[0];
    }
    return null;
  });

  useEffect(() => {
    if (selectedTable?.id) {
      selectedTableIdRef.current = selectedTable.id;
    }
  }, [selectedTable]);

  const [showOpenTabModal, setShowOpenTabModal] = useState(false);
  const [openTabMemberId, setOpenTabMemberId] = useState<string>("");
  const [openTabGuestName, setOpenTabGuestName] = useState<string>("");

  // Add Item to Tab Modal
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const selectedMenuItemIdRef = React.useRef<string>("");
  const [selectedMenuItemId, setSelectedMenuItemId] = useState<string>("");

  useEffect(() => {
    if (selectedMenuItemId) {
      selectedMenuItemIdRef.current = selectedMenuItemId;
    }
  }, [selectedMenuItemId]);

  const [itemQty, setItemQty] = useState(1);
  const [kitchenNotes, setKitchenNotes] = useState("");

  // Settling Tab Modal
  const [settlingTab, setSettlingTab] = useState<any | null>(null);

  // Table Management Modal
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [editingTableId, setEditingTableId] = useState<string | null>(null);
  const [tableForm, setTableForm] = useState({
    tableNumber: 1,
    name: "Table 1",
    capacity: 4,
    status: "AVAILABLE",
  });
  const [tableModalError, setTableModalError] = useState<string | null>(null);

  // Menu Item Management Modal
  const [isMenuItemModalOpen, setIsMenuItemModalOpen] = useState(false);
  const [editingMenuItemId, setEditingMenuItemId] = useState<string | null>(null);
  const [menuItemForm, setMenuItemForm] = useState({
    name: "",
    category: "BEVERAGES",
    price: 180,
    prepTimeMinutes: 10,
    isAvailable: true,
  });
  const [menuModalError, setMenuModalError] = useState<string | null>(null);

  // Selection Handlers to preserve user selections
  const handleSelectTable = (table: any) => {
    selectedTableIdRef.current = table?.id || null;
    setSelectedTable(table);
    onTableSelect?.(table);
  };

  const handleSelectMenuItem = (itemId: string) => {
    selectedMenuItemIdRef.current = itemId;
    setSelectedMenuItemId(itemId);
  };

  // Expose refs for test harnesses
  useEffect(() => {
    if (tableSelectRef) tableSelectRef.current = handleSelectTable;
    if (menuSelectRef) menuSelectRef.current = handleSelectMenuItem;
    if (settleTabRef) settleTabRef.current = (tab: any) => setSettlingTab(tab);
  }, [tableSelectRef, menuSelectRef, settleTabRef]);

  // Fetch Data
  const fetchData = async () => {
    try {
      const promises: Promise<Response>[] = [
        fetch("/api/bar/tables"),
        fetch("/api/bar/menu?all=true"),
      ];

      // Chef and Cafe manager do not manage tabs or closing earnings
      if (!isChef && !isCafeManager) {
        promises.push(fetch("/api/bar/tabs"));
        promises.push(fetch("/api/members"));
      } else if (isChef) {
        promises.push(fetch("/api/bar/tabs")); // Chef reads kitchen queue from tabs
      }

      const results = await Promise.all(promises);
      const tablesData = await results[0].json();
      const menuData = await results[1].json();

      let tabsData = { success: false, openTabs: [], kitchenQueue: [], settledToday: [], totalSettledTodayEarnings: 0 };
      let membersData = { success: false, members: [] };

      if (!isChef && !isCafeManager) {
        tabsData = await results[2].json();
        membersData = await results[3].json();
      } else if (isChef) {
        tabsData = await results[2].json();
      }

      if (tablesData.success) {
        const tableList = tablesData.tables || [];
        setTables(tableList);
        setSelectedTable((prevSelected: any) => {
          if (tableList.length === 0) {
            selectedTableIdRef.current = null;
            return null;
          }
          const currentId = selectedTableIdRef.current || prevSelected?.id;
          if (currentId) {
            const freshSelected = tableList.find((t: any) => t.id === currentId);
            if (freshSelected) {
              return freshSelected;
            }
          }
          selectedTableIdRef.current = tableList[0].id;
          return tableList[0];
        });
      }

      if (menuData.success) {
        const items = menuData.menuItems || [];
        setMenuItems(items);
        setSelectedMenuItemId((prev) => {
          const currentId = selectedMenuItemIdRef.current || prev;
          if (currentId && items.some((i: any) => i.id === currentId)) {
            return currentId;
          }
          const defaultId = items.length > 0 ? items[0].id : "";
          selectedMenuItemIdRef.current = defaultId;
          return defaultId;
        });
      }

      if (membersData.success) setMembers(membersData.members);

      if (tabsData.success) {
        const freshOpenTabs = tabsData.openTabs || [];
        setOpenTabs(freshOpenTabs);
        setKitchenQueue(tabsData.kitchenQueue || []);
        setSettledToday(tabsData.settledToday || []);
        setTotalBarEarningsToday(tabsData.totalSettledTodayEarnings || 0);

        setSettlingTab((prevSettling: any) => {
          if (!prevSettling) return null;
          const freshTab = freshOpenTabs.find((t: any) => t.id === prevSettling.id);
          if (freshTab) {
            return Object.assign({}, prevSettling, freshTab);
          }
          return prevSettling;
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Observability notification for testing hooks
  useEffect(() => {
    onDataLoaded?.({
      tables,
      selectedTable,
      selectedMenuItemId,
      settlingTab,
    });
  }, [tables, selectedTable, selectedMenuItemId, settlingTab]);

  // Polling interval
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollIntervalMs);
    return () => clearInterval(interval);
  }, [pollIntervalMs]);

  // Table Management Actions
  const handleOpenAddTable = () => {
    const nextNum = tables.length > 0 ? Math.max(...tables.map((t) => t.tableNumber || 0)) + 1 : 1;
    setEditingTableId(null);
    setTableForm({
      tableNumber: nextNum,
      name: `Table ${nextNum}`,
      capacity: 4,
      status: "AVAILABLE",
    });
    setTableModalError(null);
    setIsTableModalOpen(true);
  };

  const handleOpenEditTable = (table: any) => {
    setEditingTableId(table.id);
    setTableForm({
      tableNumber: table.tableNumber,
      name: table.name,
      capacity: table.capacity,
      status: table.status || "AVAILABLE",
    });
    setTableModalError(null);
    setIsTableModalOpen(true);
  };

  const handleSaveTable = async () => {
    setTableModalError(null);
    try {
      const method = editingTableId ? "PUT" : "POST";
      const payload = editingTableId ? { id: editingTableId, ...tableForm } : tableForm;

      const res = await fetch("/api/bar/tables", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save table");
      }

      setIsTableModalOpen(false);
      fetchData();
    } catch (err: any) {
      setTableModalError(err.message);
    }
  };

  const handleDeleteTable = async (tableId: string, tableName: string) => {
    if (!confirm(`Are you sure you want to delete "${tableName}"?`)) return;

    try {
      const res = await fetch(`/api/bar/tables?id=${encodeURIComponent(tableId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete table");
        return;
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || "Network error while deleting table");
    }
  };

  // Menu Management Actions
  const handleOpenAddMenuItem = () => {
    setEditingMenuItemId(null);
    setMenuItemForm({
      name: "",
      category: "BEVERAGES",
      price: 150,
      prepTimeMinutes: 10,
      isAvailable: true,
    });
    setMenuModalError(null);
    setIsMenuItemModalOpen(true);
  };

  const handleOpenEditMenuItem = (item: any) => {
    setEditingMenuItemId(item.id);
    setMenuItemForm({
      name: item.name,
      category: item.category,
      price: item.price,
      prepTimeMinutes: item.prepTimeMinutes || 10,
      isAvailable: item.isAvailable ?? true,
    });
    setMenuModalError(null);
    setIsMenuItemModalOpen(true);
  };

  const handleSaveMenuItem = async () => {
    setMenuModalError(null);
    try {
      const method = editingMenuItemId ? "PUT" : "POST";
      const payload = editingMenuItemId ? { id: editingMenuItemId, ...menuItemForm } : menuItemForm;

      const res = await fetch("/api/bar/menu", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save menu item");
      }

      setIsMenuItemModalOpen(false);
      fetchData();
    } catch (err: any) {
      setMenuModalError(err.message);
    }
  };

  const handleDeleteMenuItem = async (itemId: string, itemName: string) => {
    if (!confirm(`Are you sure you want to remove menu item "${itemName}"?`)) return;

    try {
      const res = await fetch(`/api/bar/menu?id=${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete menu item");
        return;
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || "Network error while deleting menu item");
    }
  };

  // Tab Operations
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
          guestName: openTabMemberId ? null : openTabGuestName || "Walk-in Guest",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowOpenTabModal(false);
        setOpenTabMemberId("");
        setOpenTabGuestName("");
        fetchData();
      } else {
        alert(data.error || "Failed to open tab");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddItemToTab = async (tabId: string) => {
    if (!selectedMenuItemId) return;
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
              kitchenNotes: kitchenNotes || null,
            },
          ],
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowAddItemModal(false);
        setItemQty(1);
        setKitchenNotes("");
        fetchData();
      } else {
        alert(data.error || "Failed to add items");
      }
    } catch (err) {
      console.error(err);
    }
  };

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

  // Table Vacancy Calculations for Cafe Manager View
  const totalTablesCount = (tables || []).length;
  const occupiedTables = (tables || []).filter((t) => t.tabs && t.tabs.length > 0);
  const vacantTables = (tables || []).filter((t) => !t.tabs || t.tabs.length === 0);
  const totalSeatsCapacity = (tables || []).reduce((sum, t) => sum + (t.capacity || 0), 0);
  const vacantSeatsCount = vacantTables.reduce((sum, t) => sum + (t.capacity || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Coffee className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-white">
              Scene 4: Bar, Cafeteria & Kitchen Display
              {isCafeManager ? " - Table Vacancy Monitor" : isChef ? " - Kitchen Prep KDS" : ""}
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            {isCafeManager
              ? "Live table vacancy status, seating capacity, and real-time floor occupancy."
              : isChef
              ? "Live order tickets dispatch queue, preparation timer, and kitchen order dispatch."
              : "6 Tracked Tables • Automatic Member Discount Without Asking • Running Tabs • Kitchen Prep Queue."}
          </p>
        </div>

        {/* View Switcher Tabs (Only visible for full bar staff / owner, hidden for Chef & Cafe Manager) */}
        {!isChef && !isCafeManager && (
          <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTabSubView("TABLES")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTabSubView === "TABLES"
                  ? "bg-slate-800 text-amber-400 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" /> Table Tabs ({(openTabs || []).length})
            </button>

            <button
              onClick={() => setActiveTabSubView("KITCHEN")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTabSubView === "KITCHEN"
                  ? "bg-slate-800 text-emerald-400 shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ChefHat className="w-3.5 h-3.5" /> Kitchen Queue ({(kitchenQueue || []).length})
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
        )}
      </div>

      {/* CAFE MANAGER EXCLUSIVE VIEW: TABLE VACANCY MONITOR */}
      {isCafeManager && (
        <div className="space-y-6">
          {/* Vacancy KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-xs text-slate-400">Total Tables</span>
              <p className="text-2xl font-black text-white mt-1">{totalTablesCount}</p>
              <span className="text-[11px] text-slate-500">Clubhouse Floor Layout</span>
            </div>

            <div className="p-4 bg-slate-900 border border-emerald-900/60 rounded-2xl bg-emerald-950/10">
              <span className="text-xs text-emerald-400 font-semibold">Vacant & Ready</span>
              <p className="text-2xl font-black text-emerald-400 mt-1">{vacantTables.length}</p>
              <span className="text-[11px] text-emerald-500/80">
                {totalTablesCount > 0 ? `${Math.round((vacantTables.length / totalTablesCount) * 100)}% Vacancy Rate` : "0%"}
              </span>
            </div>

            <div className="p-4 bg-slate-900 border border-amber-900/60 rounded-2xl bg-amber-950/10">
              <span className="text-xs text-amber-400 font-semibold">Currently Occupied</span>
              <p className="text-2xl font-black text-amber-400 mt-1">{occupiedTables.length}</p>
              <span className="text-[11px] text-amber-500/80">Active clubhouse guests</span>
            </div>

            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-xs text-slate-400">Vacant Seats</span>
              <p className="text-2xl font-black text-sky-400 mt-1">{vacantSeatsCount}</p>
              <span className="text-[11px] text-slate-500">of {totalSeatsCapacity} total seats</span>
            </div>
          </div>

          {/* Table Vacancy Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase">Seating Arrangement</span>
                <h2 className="text-base font-bold text-white mt-0.5">Clubhouse Table Layout & Real-Time Vacancy</h2>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Vacant (Ready to Seat)
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Occupied
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {tables.map((table) => {
                const isOccupied = table.tabs && table.tabs.length > 0;
                return (
                  <div
                    key={table.id}
                    className={`p-5 rounded-2xl border transition flex flex-col justify-between ${
                      isOccupied
                        ? "bg-amber-950/20 border-amber-800/80"
                        : "bg-slate-950/80 border-emerald-800/60 shadow-lg shadow-emerald-950/10"
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-center mb-3">
                        <span className="font-mono text-sm font-bold text-white px-2 py-0.5 bg-slate-800 rounded-md">
                          Table #{table.tableNumber}
                        </span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 ${
                            isOccupied
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                          }`}
                        >
                          {isOccupied ? "Occupied" : "Vacant"}
                        </span>
                      </div>

                      <h3 className="font-bold text-white text-base">{table.name}</h3>
                      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                        <Armchair className="w-4 h-4 text-slate-500" />
                        <span>Seating Capacity: <strong className="text-white">{table.capacity} Guests</strong></span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400">Current Status:</span>
                      <span className={`font-semibold ${isOccupied ? "text-amber-400" : "text-emerald-400"}`}>
                        {isOccupied ? "Seated / Active Tab" : "Available to Seat"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 1: TABLES & ACTIVE TABS (Staff & Owner only, hidden for Chef & Cafe Manager) */}
      {!isChef && !isCafeManager && activeTabSubView === "TABLES" && (
        <div className="space-y-6">
          {/* Tables Grid Header */}
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Clubhouse Tables & Running Tabs ({(tables || []).length})
            </h3>
            {canManageBar && (
              <button
                onClick={handleOpenAddTable}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-semibold rounded-xl text-xs transition shadow"
              >
                <Plus className="w-3.5 h-3.5" /> Add Table
              </button>
            )}
          </div>

          {/* Tables Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {(tables || []).map((table) => {
              const hasOpenTab = table.tabs && table.tabs.length > 0;
              const isSelected = selectedTable?.id === table.id;

              return (
                <div
                  key={table.id}
                  onClick={() => handleSelectTable(table)}
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
                      <div className="flex items-center gap-1">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            hasOpenTab
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-emerald-500/20 text-emerald-400"
                          }`}
                        >
                          {hasOpenTab ? "Occupied" : "Free"}
                        </span>
                        {canManageBar && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center ml-0.5"
                          >
                            <button
                              onClick={() => handleOpenEditTable(table)}
                              className="p-0.5 text-slate-400 hover:text-amber-400 rounded"
                              title="Edit Table"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTable(table.id, table.name)}
                              className="p-0.5 text-slate-400 hover:text-rose-400 rounded"
                              title="Delete Table"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-300 truncate">{table.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Capacity: {table.capacity}p</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex justify-between items-center">
                    {hasOpenTab ? (
                      <span className="text-xs font-mono font-bold text-amber-400">
                        {formatCurrency(table.tabs?.[0]?.finalAmount || 0)}
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
                          {formatCurrency(activeTabOnSelectedTable.finalAmount || 0)})
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
                              activeTabOnSelectedTable.guestName ||
                              "Bar Guests"}
                          </span>
                          {activeTabOnSelectedTable.member && (
                            <span className="text-amber-400 font-mono text-[11px] ml-2">
                              [{activeTabOnSelectedTable.member?.planTier || "STANDARD"} MEMBER]
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[11px] font-mono">
                          Opened: {activeTabOnSelectedTable.openedAt ? formatTime(activeTabOnSelectedTable.openedAt) : "-"}
                        </span>
                      </div>

                      {/* Items Ordered List */}
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Ordered Items & Kitchen Status:
                        </h4>

                        {!activeTabOnSelectedTable.items || activeTabOnSelectedTable.items.length === 0 ? (
                          <div className="p-6 text-center text-slate-500 text-xs">
                            No items ordered on this tab yet. Click "+ Add Food/Drinks" above.
                          </div>
                        ) : (
                          (activeTabOnSelectedTable.items || []).map((item: any) => (
                            <div
                              key={item.id}
                              className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex items-center justify-between"
                            >
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white">
                                    {item.menuItem?.name || "Item"}
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
                                  {formatCurrency(item.totalPrice || 0)}
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
                          <span>{formatCurrency(activeTabOnSelectedTable.subtotal || 0)}</span>
                        </div>
                        {(activeTabOnSelectedTable.discountAmount || 0) > 0 && (
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
                            <span>-{formatCurrency(activeTabOnSelectedTable.discountAmount || 0)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-400">
                          <span>GST (5%):</span>
                          <span>{formatCurrency(activeTabOnSelectedTable.taxAmount || 0)}</span>
                        </div>
                        <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
                          <span>Total Amount Due:</span>
                          <span className="text-amber-400">
                            {formatCurrency(activeTabOnSelectedTable.finalAmount || 0)}
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
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-amber-400" /> Bar & Cafeteria Menu
                </h3>
                {canManageBar && (
                  <button
                    onClick={handleOpenAddMenuItem}
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 font-semibold rounded-lg text-[11px] transition"
                  >
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Click any item to dispatch an order ticket to the kitchen display.
              </p>

              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {(menuItems || []).map((item) => (
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
                        {formatCurrency(item.price || 0)}
                      </span>
                      {canManageBar && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleOpenEditMenuItem(item)}
                            className="p-1 text-slate-400 hover:text-amber-400 rounded"
                            title="Edit Menu Item"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteMenuItem(item.id, item.name)}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded"
                            title="Delete Menu Item"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      {activeTabOnSelectedTable && (
                        <button
                          onClick={() => {
                            handleSelectMenuItem(item.id);
                            setShowAddItemModal(true);
                          }}
                          className="p-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition ml-1"
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
      {(!isCafeManager && activeTabSubView === "KITCHEN") && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">
                Chef's Live Kitchen Prep Queue ({kitchenQueue.length} Active Tickets)
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Real-time KDS Dispatch</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kitchenQueue.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500">
                <ChefHat className="w-12 h-12 mx-auto text-slate-800 mb-2" />
                <p className="text-sm font-semibold">Kitchen is all caught up!</p>
                <p className="text-xs text-slate-600 mt-1">
                  All food tickets have been cooked and served to tables.
                </p>
              </div>
            ) : (
              kitchenQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-4 bg-slate-950 rounded-2xl border border-slate-800 flex flex-col justify-between space-y-3 shadow-lg"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-xs font-bold text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                        {item.tab?.table?.name || "Quick Bar / Counter"} (Tab #{item.tab?.tabNumber || "Direct"})
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {formatTime(item.orderedAt)}
                      </span>
                    </div>

                    <h4 className="text-base font-bold text-white">
                      {item.quantity}× {item.menuItem?.name || "Item"}
                    </h4>
                    {item.kitchenNotes && (
                      <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
                        Special Prep: {item.kitchenNotes}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex gap-2">
                    {item.kitchenStatus === "PREPARING" && (
                      <button
                        onClick={() => handleUpdateKitchenStatus(item.id, "READY")}
                        className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Food Ready on Pass
                      </button>
                    )}
                    {item.kitchenStatus === "READY" && (
                      <button
                        onClick={() => handleUpdateKitchenStatus(item.id, "SERVED")}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Served to Table
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: CLOSING TIME BAR EARNINGS */}
      {(!isChef && !isCafeManager && activeTabSubView === "CLOSING") && (
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
              <span className="text-xs text-slate-400 block">Total Shift Revenue</span>
              <span className="text-xl font-mono font-bold text-emerald-400">
                {formatCurrency(totalBarEarningsToday || 0)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Tab #</th>
                  <th className="py-2.5 px-3">Table</th>
                  <th className="py-2.5 px-3">Member / Customer</th>
                  <th className="py-2.5 px-3">Settled Method</th>
                  <th className="py-2.5 px-3">Closed Time</th>
                  <th className="py-2.5 px-3 text-right">Settled Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(!settledToday || settledToday.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No bar tabs have been closed yet today.
                    </td>
                  </tr>
                ) : (
                  settledToday.map((tab) => (
                    <tr key={tab.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono font-medium text-amber-400">
                        {tab.tabNumber}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">
                        {tab.table?.name || "Quick Bar / Counter"}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        {tab.member?.name || tab.guestName || "Walk-in"}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {tab.paymentMethod || "UPI"}
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {tab.closedAt ? formatTime(tab.closedAt) : "-"}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-emerald-400 text-right">
                        {formatCurrency(tab.finalAmount || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Open Running Tab Modal */}
      {showOpenTabModal && selectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">
              Open Tab on {selectedTable.name}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Select Club Member (Auto-Discount)</label>
                <select
                  value={openTabMemberId}
                  onChange={(e) => setOpenTabMemberId(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="">Walk-in Non-Member Guest</option>
                  {(members || []).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.memberNumber}) • {m.planTier}
                    </option>
                  ))}
                </select>
              </div>

              {!openTabMemberId && (
                <div>
                  <label className="text-xs text-slate-400">Guest Name / Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Table of 4 - Tennis Players"
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
                Open Tab
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Items to Tab Modal */}
      {showAddItemModal && activeTabOnSelectedTable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">
              Add Item to Tab #{activeTabOnSelectedTable.tabNumber}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Menu Item</label>
                <select
                  value={selectedMenuItemId}
                  onChange={(e) => handleSelectMenuItem(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  {(menuItems || []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({formatCurrency(item.price || 0)}) - {item.category}
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

      {/* Add / Edit Table Modal */}
      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">
              {editingTableId ? "Edit Bar / Cafe Table" : "Add New Bar / Cafe Table"}
            </h3>

            {tableModalError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300">
                {tableModalError}
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Table Number</label>
                  <input
                    type="number"
                    min={1}
                    value={tableForm.tableNumber}
                    onChange={(e) => setTableForm({ ...tableForm, tableNumber: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Seating Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={tableForm.capacity}
                    onChange={(e) => setTableForm({ ...tableForm, capacity: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Table Display Name</label>
                <input
                  type="text"
                  placeholder="e.g. High-Top 5 or Patio 2"
                  value={tableForm.name}
                  onChange={(e) => setTableForm({ ...tableForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Default Status</label>
                <select
                  value={tableForm.status}
                  onChange={(e) => setTableForm({ ...tableForm, status: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="AVAILABLE">AVAILABLE (Vacant)</option>
                  <option value="OCCUPIED">OCCUPIED</option>
                  <option value="RESERVED">RESERVED</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsTableModalOpen(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveTable}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold"
              >
                {editingTableId ? "Save Table" : "Create Table"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Menu Item Modal */}
      {isMenuItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-white">
              {editingMenuItemId ? "Edit Menu Item" : "Add Food / Drink Item"}
            </h3>

            {menuModalError && (
              <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300">
                {menuModalError}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Item Name</label>
                <input
                  type="text"
                  placeholder="e.g. Avocado Toast or Protein Shake"
                  value={menuItemForm.name}
                  onChange={(e) => setMenuItemForm({ ...menuItemForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400">Category</label>
                  <select
                    value={menuItemForm.category}
                    onChange={(e) => setMenuItemForm({ ...menuItemForm, category: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    <option value="BEVERAGES">BEVERAGES</option>
                    <option value="SNACKS">SNACKS</option>
                    <option value="MAINS">MAINS</option>
                    <option value="ENERGY_DRINKS">ENERGY_DRINKS</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={menuItemForm.price}
                    onChange={(e) => setMenuItemForm({ ...menuItemForm, price: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Estimated Prep Time (Minutes)</label>
                <input
                  type="number"
                  min={1}
                  value={menuItemForm.prepTimeMinutes}
                  onChange={(e) => setMenuItemForm({ ...menuItemForm, prepTimeMinutes: Number(e.target.value) })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>

              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <span className="text-xs text-white">Item Available on Menu</span>
                <input
                  type="checkbox"
                  checked={menuItemForm.isAvailable}
                  onChange={(e) => setMenuItemForm({ ...menuItemForm, isAvailable: e.target.checked })}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setIsMenuItemModalOpen(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveMenuItem}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold"
              >
                {editingMenuItemId ? "Save Item" : "Create Item"}
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
          amount={settlingTab.finalAmount || 0}
          title={`Settle Bar Tab - ${settlingTab.table?.name || "Quick Bar / Counter"}`}
          notes={`Bar bill settled: Tab #${settlingTab.tabNumber || ""} (${settlingTab.items?.length || 0} items)`}
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
