"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Search,
  Sparkles,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Clock,
  Phone,
  Mail,
  History,
  CreditCard,
  ChevronRight,
  RefreshCw,
  Trophy,
  Coffee,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PaymentModal } from "../PaymentModal";

export function MemberScene() {
  const [members, setMembers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // New Member Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    planTier: "GOLD",
    durationMonths: 6,
    notes: "",
  });

  // Renewal Modal State
  const [renewingMember, setRenewingMember] = useState<any | null>(null);

  // Fetch Members & Plans
  const fetchData = async () => {
    try {
      const [membersRes, plansRes] = await Promise.all([
        fetch(`/api/members?search=${encodeURIComponent(search)}${selectedTier !== "ALL" ? `&tier=${selectedTier}` : ""}`),
        fetch("/api/plans"),
      ]);
      const membersData = await membersRes.json();
      const plansData = await plansRes.json();

      if (membersData.success) setMembers(membersData.members);
      if (plansData.success) setPlans(plansData.plans);
    } catch (err) {
      console.error("Failed to load members", err);
    } finally {
      setLoading(false);
    }
  };

  // Real-Time Polling every 4 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [search, selectedTier]);

  // View Member Detail & History
  const handleSelectMember = async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/members/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedMember(data.member);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const activePlan = plans.find((p) => p.tier === formData.planTier);
  const signupAmount = activePlan ? activePlan.monthlyFee * formData.durationMonths : 0;

  return (
    <div className="space-y-6">
      {/* Top Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Users className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-white">Scene 1: Front Desk & Memberships</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Fast member lookup, plan entitlements, automatic expiry detection, and club history.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition shadow-lg shadow-emerald-950 text-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Enroll New Member</span>
        </button>
      </div>

      {/* Plan Entitlement Cards Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const isGold = p.tier === "GOLD";
          const isSilver = p.tier === "SILVER";
          return (
            <div
              key={p.id}
              className={`p-4 rounded-xl border relative overflow-hidden transition ${
                isGold
                  ? "bg-amber-950/20 border-amber-500/40"
                  : isSilver
                  ? "bg-slate-800/40 border-slate-600"
                  : "bg-sky-950/20 border-sky-500/40"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                    isGold
                      ? "bg-amber-500/20 text-amber-400"
                      : isSilver
                      ? "bg-slate-700 text-slate-200"
                      : "bg-sky-500/20 text-sky-400"
                  }`}
                >
                  {p.tier} TIER
                </span>
                <span className="text-base font-bold text-white">
                  {formatCurrency(p.monthlyFee)}
                  <span className="text-xs text-slate-400 font-normal">/mo</span>
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white">{p.name}</h3>
              <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Court Bookings:</span>
                  <span className="font-semibold text-emerald-400">
                    {p.courtDiscountPercent === 100 ? "100% FREE" : `${p.courtDiscountPercent}% OFF`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Gear Shop Discount:</span>
                  <span className="font-medium text-amber-400">{p.shopDiscountPercent}% OFF</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Bar & Café Discount:</span>
                  <span className="font-medium text-amber-400">{p.barDiscountPercent}% OFF</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, member # (e.g. CC-1001), phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        <div className="flex gap-2">
          {["ALL", "GOLD", "SILVER", "JUNIOR"].map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition ${
                selectedTier === tier
                  ? "bg-slate-700 text-white border border-slate-500"
                  : "bg-slate-900 text-slate-400 border border-slate-800 hover:text-white"
              }`}
            >
              {tier}
            </button>
          ))}
        </div>
      </div>

      {/* Main Members Grid & Detail View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Members List */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading members...</div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">
              No members found matching your search.
            </div>
          ) : (
            members.map((m) => {
              const isSelected = selectedMember?.id === m.id;
              const isExpiringSoon = m.computedStatus === "EXPIRING_SOON";

              return (
                <div
                  key={m.id}
                  onClick={() => handleSelectMember(m.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? "bg-slate-800 border-emerald-500 shadow-md"
                      : isExpiringSoon
                      ? "bg-rose-950/20 border-rose-800/80 hover:border-rose-600"
                      : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                        m.planTier === "GOLD"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                          : m.planTier === "SILVER"
                          ? "bg-slate-700 text-slate-200 border border-slate-600"
                          : "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                      }`}
                    >
                      {m.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-white text-sm">{m.name}</h4>
                        <span className="font-mono text-[11px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                          {m.memberNumber}
                        </span>
                        {isExpiringSoon && (
                          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> Expiring Soon!
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-3">
                        <span>{m.phone}</span>
                        <span>•</span>
                        <span>{m.email}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-3">
                    <div>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          m.planTier === "GOLD"
                            ? "bg-amber-500/20 text-amber-300"
                            : m.planTier === "SILVER"
                            ? "bg-slate-700 text-slate-300"
                            : "bg-sky-500/20 text-sky-300"
                        }`}
                      >
                        {m.planTier}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Expires: {formatDate(m.expiryDate)}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Member Profile & Club History Drawer */}
        <div className="lg:col-span-1">
          {selectedMember ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sticky top-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <History className="w-4 h-4 text-emerald-400" /> Member Dossier
                </h3>
                <span className="font-mono text-xs text-emerald-400 font-semibold">
                  {selectedMember.memberNumber}
                </span>
              </div>

              {/* Profile Header */}
              <div>
                <h2 className="text-lg font-bold text-white">{selectedMember.name}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded ${
                      selectedMember.planTier === "GOLD"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : selectedMember.planTier === "SILVER"
                        ? "bg-slate-700 text-slate-200"
                        : "bg-sky-500/20 text-sky-400"
                    }`}
                  >
                    {selectedMember.plan.name}
                  </span>
                  {selectedMember.isExpiringSoon && (
                    <span className="text-xs font-bold px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Renews in &lt; 7 Days
                    </span>
                  )}
                </div>
              </div>

              {/* Entitlement Breakdown */}
              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
                <p className="font-semibold text-slate-300">Plan Entitlements:</p>
                <div className="grid grid-cols-2 gap-2 text-slate-400">
                  <div className="bg-slate-900 p-2 rounded">
                    <p className="text-[10px] uppercase">Court Discount</p>
                    <p className="font-bold text-emerald-400 text-sm">
                      {selectedMember.plan.courtDiscountPercent}%
                    </p>
                  </div>
                  <div className="bg-slate-900 p-2 rounded">
                    <p className="text-[10px] uppercase">Shop Discount</p>
                    <p className="font-bold text-amber-400 text-sm">
                      {selectedMember.plan.shopDiscountPercent}%
                    </p>
                  </div>
                  <div className="bg-slate-900 p-2 rounded">
                    <p className="text-[10px] uppercase">Bar Discount</p>
                    <p className="font-bold text-amber-400 text-sm">
                      {selectedMember.plan.barDiscountPercent}%
                    </p>
                  </div>
                  <div className="bg-slate-900 p-2 rounded">
                    <p className="text-[10px] uppercase">Daily Play Cap</p>
                    <p className="font-bold text-white text-sm">
                      {selectedMember.plan.maxDailyBookings} Sessions
                    </p>
                  </div>
                </div>
              </div>

              {/* Renewal Action if expiring */}
              <button
                onClick={() => setRenewingMember(selectedMember)}
                className="w-full py-2.5 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Renew Membership Plan</span>
              </button>

              {/* Club Activity History Tabs */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <p className="text-xs font-semibold text-slate-300">Recent Club Activity:</p>

                {/* Court Bookings */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                    <Trophy className="w-3 h-3" /> Court Bookings ({selectedMember.courtBookings?.length || 0})
                  </span>
                  {selectedMember.courtBookings?.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">No court history yet</p>
                  ) : (
                    selectedMember.courtBookings?.slice(0, 3).map((b: any) => (
                      <div
                        key={b.id}
                        className="p-2 bg-slate-950/80 rounded border border-slate-800/80 text-[11px] flex justify-between"
                      >
                        <div>
                          <p className="font-medium text-white">{b.court.name}</p>
                          <p className="text-slate-400 text-[10px]">{formatDate(b.startTime)}</p>
                        </div>
                        <span className="font-bold text-emerald-400">
                          {b.finalPrice === 0 ? "FREE" : formatCurrency(b.finalPrice)}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {/* Bar Tabs */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1">
                    <Coffee className="w-3 h-3" /> Bar Visits ({selectedMember.barTabs?.length || 0})
                  </span>
                  {selectedMember.barTabs?.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">No bar tabs yet</p>
                  ) : (
                    selectedMember.barTabs?.slice(0, 3).map((t: any) => (
                      <div
                        key={t.id}
                        className="p-2 bg-slate-950/80 rounded border border-slate-800/80 text-[11px] flex justify-between"
                      >
                        <div>
                          <p className="font-medium text-white">{t.table.name}</p>
                          <p className="text-slate-400 text-[10px]">{formatDate(t.openedAt)}</p>
                        </div>
                        <span className="font-bold text-white">{formatCurrency(t.finalAmount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-slate-400">
              <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm">Select any member on the left to inspect their dossier & history.</p>
            </div>
          )}
        </div>
      </div>

      {/* Enroll New Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" /> New Member Front Desk Enrollment
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Manisha Singhania"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Email Address</label>
                  <input
                    type="email"
                    placeholder="manisha@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98200 12345"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Membership Tier</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {["GOLD", "SILVER", "JUNIOR"].map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setFormData({ ...formData, planTier: tier })}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                        formData.planTier === tier
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Duration (Months)</label>
                <select
                  value={formData.durationMonths}
                  onChange={(e) =>
                    setFormData({ ...formData, durationMonths: Number(e.target.value) })
                  }
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                >
                  <option value={1}>1 Month</option>
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months (Half-Yearly)</option>
                  <option value={12}>12 Months (Annual)</option>
                </select>
              </div>

              {/* Total Fee Preview */}
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <span className="text-xs text-slate-400">Enrollment Fee (Auto-calculated):</span>
                <span className="text-lg font-bold text-emerald-400">
                  {formatCurrency(signupAmount)}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!formData.name || !formData.email || !formData.phone}
                onClick={async () => {
                  const res = await fetch("/api/members", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setShowAddModal(false);
                    fetchData();
                    handleSelectMember(data.member.id);
                  }
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-950"
              >
                Confirm & Enroll
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Renew Modal using reusable PaymentModal */}
      {renewingMember && (
        <PaymentModal
          isOpen={!!renewingMember}
          onClose={() => setRenewingMember(null)}
          amount={renewingMember.plan.monthlyFee * 3}
          title={`Renew Membership (+3 Months)`}
          notes={`3-Month Renewal for ${renewingMember.name} (${renewingMember.plan.name})`}
          type="MEMBERSHIP_FEE"
          category="MEMBERSHIP"
          memberId={renewingMember.id}
          memberName={renewingMember.name}
          onSuccess={async () => {
            await fetch(`/api/members/${renewingMember.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "RENEW", durationMonths: 3 }),
            });
            fetchData();
            handleSelectMember(renewingMember.id);
            setRenewingMember(null);
          }}
        />
      )}
    </div>
  );
}
