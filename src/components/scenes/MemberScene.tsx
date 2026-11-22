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
  Settings,
  Edit3,
  Sliders,
  Check,
  X,
  ArrowRightLeft,
  ShieldCheck,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PaymentModal } from "../PaymentModal";
import { useAuth } from "@/contexts/AuthContext";
import { addMonths } from "date-fns";
import { PricingCalculator } from "@/lib/pricing";

export function MemberScene({ initialSelectedMember = null }: { initialSelectedMember?: any } = {}) {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";

  const [members, setMembers] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<any | null>(initialSelectedMember);
  const [detailLoading, setDetailLoading] = useState(false);

  // New Member Enrollment State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalError, setAddModalError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    planTier: "GOLD",
    durationMonths: 6,
    notes: "",
  });

  // Admin Plan Editing State
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [planForm, setPlanForm] = useState<{
    name: string;
    monthlyFee: number | string;
    courtDiscountPercent: number;
    shopDiscountPercent: number;
    barDiscountPercent: number;
    maxDailyBookings: number;
    perksText: string;
  }>({
    name: "",
    monthlyFee: 0,
    courtDiscountPercent: 0,
    shopDiscountPercent: 0,
    barDiscountPercent: 0,
    maxDailyBookings: 2,
    perksText: "",
  });
  const [planSaving, setPlanSaving] = useState(false);
  const [planSaveError, setPlanSaveError] = useState<string | null>(null);

  // Front Desk Membership Renewal State
  const [renewingMember, setRenewingMember] = useState<any | null>(null);
  const [renewalTier, setRenewalTier] = useState<string>("GOLD");
  const [renewalDuration, setRenewalDuration] = useState<number>(3);
  const [isCustomMonths, setIsCustomMonths] = useState(false);
  const [customMonthsInput, setCustomMonthsInput] = useState<string>("3");
  const [pendingPayment, setPendingPayment] = useState<any | null>(null);

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

  // Plan Edit Handlers (Admin/Owner)
  const handleStartEditPlan = (p: any) => {
    setEditingPlan(p);
    setPlanForm({
      name: p.name,
      monthlyFee: p.monthlyFee,
      courtDiscountPercent: p.courtDiscountPercent,
      shopDiscountPercent: p.shopDiscountPercent,
      barDiscountPercent: p.barDiscountPercent,
      maxDailyBookings: p.maxDailyBookings,
      perksText: (p.perks || []).join("\n"),
    });
    setPlanSaveError(null);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    setPlanSaving(true);
    setPlanSaveError(null);

    try {
      const perks = planForm.perksText
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await fetch("/api/plans", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPlan.id,
          tier: editingPlan.tier,
          name: planForm.name,
          monthlyFee: Math.max(0, Number(planForm.monthlyFee) || 0),
          courtDiscountPercent: Number(planForm.courtDiscountPercent),
          shopDiscountPercent: Number(planForm.shopDiscountPercent),
          barDiscountPercent: Number(planForm.barDiscountPercent),
          maxDailyBookings: Number(planForm.maxDailyBookings),
          perks,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update plan");
      }

      setEditingPlan(null);
      await fetchData();
      if (selectedMember) {
        handleSelectMember(selectedMember.id);
      }
    } catch (err: any) {
      setPlanSaveError(err.message || "Failed to save plan changes");
    } finally {
      setPlanSaving(false);
    }
  };

  // Renewal Handlers (Front Desk & Owner)
  const handleOpenRenewal = (member: any) => {
    setRenewingMember(member);
    setRenewalTier(member.planTier);
    setRenewalDuration(3);
    setIsCustomMonths(false);
    setCustomMonthsInput("3");
    setPendingPayment(null);
  };

  const parsedCustomMonths = parseInt(customMonthsInput, 10);
  const isCustomDurationValid = !isCustomMonths || (!isNaN(parsedCustomMonths) && parsedCustomMonths >= 1);
  const effectiveDuration = isCustomMonths
    ? Math.max(1, isNaN(parsedCustomMonths) ? 1 : parsedCustomMonths)
    : renewalDuration;

  const selectedRenewalPlan = plans.find((p) => p.tier === renewalTier);
  const renewalFeeCalculation = selectedRenewalPlan
    ? PricingCalculator.calculateMembershipFee({
        monthlyFee: selectedRenewalPlan.monthlyFee,
        durationMonths: effectiveDuration,
        tier: selectedRenewalPlan.tier,
      })
    : null;
  const renewalBasePrice = renewalFeeCalculation ? renewalFeeCalculation.finalPrice : 0;

  const calculateExtendedExpiry = (baseDateStr: string | Date, months: number) => {
    const now = new Date();
    const cur = new Date(baseDateStr);
    const isValid = !isNaN(cur.getTime());
    const base = isValid && cur > now ? cur : now;
    return addMonths(base, months);
  };

  const handleProceedToPayment = () => {
    if (!renewingMember || !selectedRenewalPlan || !isCustomDurationValid) return;
    const isTierSwitch = renewalTier !== renewingMember.planTier;
    const note = isTierSwitch
      ? `Membership Tier Switch & Renewal (${renewingMember.planTier} -> ${renewalTier}): ${selectedRenewalPlan.name} (+${effectiveDuration} mo)`
      : `Membership Renewal: ${selectedRenewalPlan.name} (+${effectiveDuration} mo)`;

    setPendingPayment({
      member: renewingMember,
      tier: renewalTier,
      durationMonths: effectiveDuration,
      amount: renewalBasePrice,
      notes: note,
    });
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
            Fast member lookup, dynamic plan configuration, custom-duration tier renewals, and unified activity ledger.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setAddModalError(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition shadow-lg shadow-emerald-950 text-sm"
          >
            <UserPlus className="w-4 h-4" />
            <span>Enroll New Member</span>
          </button>
        </div>
      </div>

      {/* Plan Entitlement Cards Overview with Admin Controls */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Membership Plans & Entitlement Rules
            </h2>
            {isOwner && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-purple-400" /> Admin Editing Enabled
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">Live synced to POS & Booking engines</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const isGold = p.tier === "GOLD";
            const isSilver = p.tier === "SILVER";
            return (
              <div
                key={p.id}
                className={`p-4 rounded-xl border relative overflow-hidden transition flex flex-col justify-between ${
                  isGold
                    ? "bg-amber-950/20 border-amber-500/40"
                    : isSilver
                    ? "bg-slate-800/40 border-slate-600"
                    : "bg-sky-950/20 border-sky-500/40"
                }`}
              >
                <div>
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
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Daily Court Limit:</span>
                      <span className="font-medium text-slate-200">{p.maxDailyBookings} Sessions</span>
                    </div>
                  </div>

                  {p.perks && p.perks.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-slate-800/60">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold mb-1">Top Perks:</p>
                      <ul className="text-[11px] text-slate-300 space-y-0.5 list-disc list-inside">
                        {p.perks.slice(0, 3).map((perk: string, idx: number) => (
                          <li key={idx} className="truncate">{perk}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {isOwner && (
                  <button
                    onClick={() => handleStartEditPlan(p)}
                    className="mt-4 w-full py-2 px-3 bg-slate-800/80 hover:bg-slate-700/90 border border-slate-600/70 hover:border-slate-500 rounded-lg text-xs font-semibold text-slate-200 hover:text-white flex items-center justify-center gap-1.5 transition shadow-sm"
                  >
                    <Settings className="w-3.5 h-3.5 text-amber-400" />
                    <span>Edit Plan Config</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
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
              const isExpired = m.computedStatus === "EXPIRED";

              return (
                <div
                  key={m.id}
                  onClick={() => handleSelectMember(m.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? "bg-slate-800 border-emerald-500 shadow-md"
                      : isExpired
                      ? "bg-rose-950/30 border-rose-800 hover:border-rose-600"
                      : isExpiringSoon
                      ? "bg-amber-950/20 border-amber-800/80 hover:border-amber-600"
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
                          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full animate-pulse">
                            <AlertTriangle className="w-3 h-3" /> Expiring Soon!
                          </span>
                        )}
                        {isExpired && (
                          <span className="flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full">
                            <AlertTriangle className="w-3 h-3" /> Expired
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

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectMember(m.id);
                        handleOpenRenewal(m);
                      }}
                      title="Renew or Change Tier"
                      className="p-1.5 bg-slate-800 hover:bg-emerald-600/30 text-slate-300 hover:text-emerald-300 rounded-lg border border-slate-700 transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
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
                    {selectedMember.plan?.name || `${selectedMember.planTier || "STANDARD"} Plan`}
                  </span>
                  {selectedMember.isExpiringSoon && (
                    <span className="text-xs font-bold px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Renews in &lt; 7 Days
                    </span>
                  )}
                  {selectedMember.computedStatus === "EXPIRED" && (
                    <span className="text-xs font-bold px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Expired
                    </span>
                  )}
                </div>
              </div>

              {/* Entitlement Breakdown */}
              <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
                <p className="font-semibold text-slate-300">Plan Entitlements ({selectedMember.planTier || "STANDARD"}):</p>
                <div className="grid grid-cols-2 gap-2 text-slate-400">
                  <div className="bg-slate-900 p-2 rounded">
                    <p className="text-[10px] uppercase">Court Discount</p>
                    <p className="font-bold text-emerald-400 text-sm">
                      {selectedMember.plan?.courtDiscountPercent ?? (selectedMember.planTier === "GOLD" ? 50 : selectedMember.planTier === "SILVER" ? 25 : 10)}%
                    </p>
                  </div>
                  <div className="bg-slate-900 p-2 rounded">
                    <p className="text-[10px] uppercase">Shop Discount</p>
                    <p className="font-bold text-amber-400 text-sm">
                      {selectedMember.plan?.shopDiscountPercent ?? (selectedMember.planTier === "GOLD" ? 20 : selectedMember.planTier === "SILVER" ? 10 : 5)}%
                    </p>
                  </div>
                  <div className="bg-slate-900 p-2 rounded">
                    <p className="text-[10px] uppercase">Bar Discount</p>
                    <p className="font-bold text-amber-400 text-sm">
                      {selectedMember.plan?.barDiscountPercent ?? (selectedMember.planTier === "GOLD" ? 20 : selectedMember.planTier === "SILVER" ? 10 : 5)}%
                    </p>
                  </div>
                  <div className="bg-slate-900 p-2 rounded">
                    <p className="text-[10px] uppercase">Daily Play Cap</p>
                    <p className="font-bold text-white text-sm">
                      {selectedMember.plan?.maxDailyBookings ?? 2} Sessions
                    </p>
                  </div>
                </div>
              </div>

              {/* Renewal Action with Tier Switching & Custom Duration */}
              <button
                onClick={() => handleOpenRenewal(selectedMember)}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600/30 to-teal-600/30 hover:from-emerald-600/40 hover:to-teal-600/40 border border-emerald-500/50 text-emerald-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/30"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" />
                <span>Renew / Switch Membership Tier</span>
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
                          <p className="font-medium text-white">{t.table?.name || "Quick Bar / Counter"}</p>
                          <p className="text-slate-400 text-[10px]">{t.openedAt ? formatDate(t.openedAt) : "-"}</p>
                        </div>
                        <span className="font-bold text-white">{formatCurrency(t.finalAmount || 0)}</span>
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

      {/* Admin Membership Plan Configuration Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                  <Settings className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-white">Edit {editingPlan.tier} Plan Configuration</h2>
                  <p className="text-xs text-slate-400">Admin/Owner override for prices & discount policies</p>
                </div>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400">Plan Display Name</label>
                <input
                  type="text"
                  required
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Monthly Membership Fee (₹)</label>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    required
                    value={planForm.monthlyFee}
                    onChange={(e) => setPlanForm({ ...planForm, monthlyFee: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-400">Daily Court Sessions Cap</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    required
                    value={planForm.maxDailyBookings}
                    onChange={(e) => setPlanForm({ ...planForm, maxDailyBookings: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Discounts Group */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <p className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" /> Departmental Discounts (%):
                </p>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Court Booking Discount:</span>
                    <span className="font-bold text-emerald-400">{planForm.courtDiscountPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={planForm.courtDiscountPercent}
                    onChange={(e) => setPlanForm({ ...planForm, courtDiscountPercent: Number(e.target.value) })}
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Pro Gear Shop Discount:</span>
                    <span className="font-bold text-amber-400">{planForm.shopDiscountPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={planForm.shopDiscountPercent}
                    onChange={(e) => setPlanForm({ ...planForm, shopDiscountPercent: Number(e.target.value) })}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Bar & Café Discount:</span>
                    <span className="font-bold text-sky-400">{planForm.barDiscountPercent}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={planForm.barDiscountPercent}
                    onChange={(e) => setPlanForm({ ...planForm, barDiscountPercent: Number(e.target.value) })}
                    className="w-full accent-sky-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Plan Perks / Entitlements (one per line)</label>
                <textarea
                  rows={3}
                  value={planForm.perksText}
                  onChange={(e) => setPlanForm({ ...planForm, perksText: e.target.value })}
                  placeholder="e.g. Free Towel Service&#10;Priority Court Access"
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              {planSaveError && (
                <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900 rounded-lg p-2 text-center">
                  {planSaveError}
                </p>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPlan(null)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={planSaving}
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-amber-950 flex items-center justify-center gap-1.5"
                >
                  {planSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Save Plan Configuration</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Front Desk Membership Renewal & Tier Switching Modal */}
      {renewingMember && !pendingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-emerald-400" /> Renew & Extend Membership
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Member: <span className="text-white font-semibold">{renewingMember.name}</span> ({renewingMember.memberNumber})
                </p>
              </div>
              <button
                onClick={() => setRenewingMember(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Current Status Overview */}
            <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
              <div>
                <span className="text-slate-400">Current Plan: </span>
                <span className="font-bold text-amber-400">{renewingMember.planTier}</span>
              </div>
              <div>
                <span className="text-slate-400">Expiry Date: </span>
                <span className="font-bold text-slate-200">{formatDate(renewingMember.expiryDate)}</span>
              </div>
            </div>

            {/* Step 1: Membership Tier Selection (Allows Tier Change) */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-400" /> Select Membership Tier:
              </label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {plans.map((p) => {
                  const isCurrent = p.tier === renewingMember.planTier;
                  const isSelected = p.tier === renewalTier;
                  return (
                    <button
                      key={p.tier}
                      type="button"
                      onClick={() => setRenewalTier(p.tier)}
                      className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500 text-white shadow-md shadow-emerald-950"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase">{p.tier}</span>
                          {isCurrent && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-extrabold text-emerald-400 mt-1">
                          {formatCurrency(p.monthlyFee)}
                          <span className="text-[10px] text-slate-400 font-normal">/mo</span>
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {p.courtDiscountPercent}% off courts
                      </p>
                    </button>
                  );
                })}
              </div>

              {renewalTier !== renewingMember.planTier && (
                <div className="mt-2 p-2 bg-purple-950/30 border border-purple-800/60 rounded-lg text-xs text-purple-300 flex items-center gap-1.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-purple-400" />
                  <span>
                    Switching tier from <strong>{renewingMember.planTier}</strong> to <strong>{renewalTier}</strong> upon completion.
                  </span>
                </div>
              )}
            </div>

            {/* Step 2: Renewal Duration Selection (Presets + Custom Input) */}
            <div>
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Renewal Duration:
              </label>

              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {[
                  { label: "1 Mo", val: 1 },
                  { label: "3 Mo", val: 3 },
                  { label: "6 Mo", val: 6 },
                  { label: "12 Mo", val: 12 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => {
                      setIsCustomMonths(false);
                      setRenewalDuration(preset.val);
                    }}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold transition text-center ${
                      !isCustomMonths && renewalDuration === preset.val
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Duration Toggle & Input */}
              <div className="mt-2.5">
                <div className="flex items-center justify-between mb-1">
                  <button
                    type="button"
                    onClick={() => setIsCustomMonths(!isCustomMonths)}
                    className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>{isCustomMonths ? "Use Standard Duration Presets" : "+ Enter Custom Duration (Months)"}</span>
                  </button>
                </div>

                {isCustomMonths && (
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <label className="text-xs text-slate-400">Custom Months to Add:</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={customMonthsInput}
                        onChange={(e) => setCustomMonthsInput(e.target.value)}
                        placeholder="e.g. 2, 4, 5, 8, 18..."
                        className="flex-1 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white font-semibold focus:outline-none focus:border-emerald-500"
                      />
                      <span className="self-center text-xs text-slate-400 font-medium">Months</span>
                    </div>
                    {!isCustomDurationValid && (
                      <p className="text-[11px] text-rose-400 font-medium">
                        Please enter a valid duration of at least 1 month.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Calculation & Extended Expiry Summary */}
            <div className="bg-slate-950 rounded-xl p-3.5 border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-400">
                <span>Selected Plan Rate:</span>
                <span className="text-slate-200 font-mono">
                  {formatCurrency(selectedRenewalPlan?.monthlyFee || 0)} / month
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>Duration to Extend:</span>
                <span className="text-slate-200 font-mono">+{effectiveDuration} month(s)</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span>New Expiry Date:</span>
                <span className="text-emerald-400 font-semibold">
                  {formatDate(calculateExtendedExpiry(renewingMember.expiryDate, effectiveDuration))}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between items-center">
                <span className="font-bold text-white text-sm">Total Renewal Due:</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {formatCurrency(renewalBasePrice)}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRenewingMember(null)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!isCustomDurationValid || effectiveDuration < 1 || renewalBasePrice <= 0}
                onClick={handleProceedToPayment}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-950 flex items-center justify-center gap-1.5"
              >
                <CreditCard className="w-4 h-4" />
                <span>Proceed to Payment</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Renewal via Unified POS PaymentModal */}
      {pendingPayment && (
        <PaymentModal
          isOpen={!!pendingPayment}
          onClose={() => setPendingPayment(null)}
          amount={pendingPayment.amount}
          title={`Renew ${pendingPayment.tier} Plan (+${pendingPayment.durationMonths} Mo)`}
          notes={pendingPayment.notes}
          type="MEMBERSHIP_FEE"
          category="MEMBERSHIP"
          memberId={pendingPayment.member.id}
          memberName={pendingPayment.member.name}
          onSuccess={async (transaction: any) => {
            try {
              const res = await fetch(`/api/members/${pendingPayment.member.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "RENEW",
                  planTier: pendingPayment.tier,
                  durationMonths: pendingPayment.durationMonths,
                  transactionId: transaction.id,
                }),
              });
              const data = await res.json();
              if (data.success) {
                setPendingPayment(null);
                setRenewingMember(null);
                await fetchData();
                handleSelectMember(pendingPayment.member.id);
              }
            } catch (err) {
              console.error("Failed to complete renewal:", err);
            }
          }}
        />
      )}

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

            {addModalError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{addModalError}</span>
              </div>
            )}

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
                onClick={() => {
                  setShowAddModal(false);
                  setAddModalError(null);
                }}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!formData.name || !formData.email || !formData.phone}
                onClick={async () => {
                  setAddModalError(null);
                  try {
                    const res = await fetch("/api/members", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(formData),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setShowAddModal(false);
                      setAddModalError(null);
                      fetchData();
                      handleSelectMember(data.member.id);
                    } else {
                      setAddModalError(data.error || "Failed to enroll member.");
                    }
                  } catch (err: any) {
                    console.error("Member enrollment network error:", err);
                    setAddModalError("Network error. Please try again.");
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
    </div>
  );
}
