"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Trophy,
  Calendar,
  Clock,
  ShoppingBag,
  Coffee,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  ArrowRight,
  RefreshCw,
  CreditCard,
  Zap,
  Lock,
} from "lucide-react";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { PaymentModal } from "../PaymentModal";
import { ChangePasswordModal } from "../ChangePasswordModal";
import { useAuth } from "@/contexts/AuthContext";

interface MemberPortalProps {
  onNavigateToCourts: () => void;
  onNavigateToShop: () => void;
  initialMember?: any;
}

export function MemberPortal({ onNavigateToCourts, onNavigateToShop, initialMember }: MemberPortalProps) {
  const { user, refreshUser } = useAuth();
  const [memberDetails, setMemberDetails] = useState<any | null>(initialMember || null);
  const [loading, setLoading] = useState(!initialMember);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const memberId = user?.member?.id || initialMember?.id;

  const fetchMemberProfile = async () => {
    if (!memberId) {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/members/${memberId}`);
      const data = await res.json();
      if (data.success) {
        setMemberDetails(data.member);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemberProfile();
    const interval = setInterval(fetchMemberProfile, 4000);
    return () => clearInterval(interval);
  }, [memberId]);

  if (loading && !memberDetails) {
    return (
      <div className="py-20 text-center text-slate-400">
        Loading your personal membership dossier...
      </div>
    );
  }

  if (!memberDetails) {
    return (
      <div className="py-20 text-center text-slate-400">
        <p className="font-semibold text-white">No active membership profile found.</p>
        <p className="text-xs text-slate-500 mt-1">Please sign in with a member account or explore memberships online.</p>
      </div>
    );
  }

  const { plan, courtBookings = [], shopOrders = [], barTabs = [], transactions = [] } = memberDetails;
  const isExpiringSoon = memberDetails.isExpiringSoon;
  const isGold = memberDetails.planTier === "GOLD";
  const isSilver = memberDetails.planTier === "SILVER";

  // Check if member has an active open bar tab
  const activeBarTab = barTabs.find((t: any) => t.status === "OPEN");

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 p-6 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Champions Club Member Portal
          </span>
          <h1 className="text-2xl font-black text-white mt-1">
            Welcome back, {memberDetails.name}!
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage your personal court reservations, gear shop orders, active bar tabs, and loyalty benefits.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onNavigateToCourts}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-950 flex items-center gap-1.5"
          >
            <Trophy className="w-4 h-4" /> Book a Court
          </button>
          <button
            onClick={onNavigateToShop}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs transition flex items-center gap-1.5"
          >
            <ShoppingBag className="w-4 h-4" /> Order Pro Gear
          </button>
          <button
            onClick={() => setIsPasswordModalOpen(true)}
            className="px-4 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs transition flex items-center gap-1.5"
          >
            <Lock className="w-4 h-4 text-emerald-400" /> Security & Password
          </button>
        </div>
      </div>

      {/* Digital Membership Card & Tier Entitlements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Interactive Digital Membership Card */}
        <div className="lg:col-span-1">
          <div
            className={`rounded-3xl p-6 border relative overflow-hidden shadow-2xl flex flex-col justify-between min-h-[260px] ${
              isGold
                ? "bg-gradient-to-br from-amber-900/60 via-slate-900 to-amber-950/80 border-amber-500/60 shadow-amber-950/30"
                : isSilver
                ? "bg-gradient-to-br from-slate-800/80 via-slate-900 to-slate-800/80 border-slate-600"
                : "bg-gradient-to-br from-sky-950/80 via-slate-900 to-sky-950/60 border-sky-500/60"
            }`}
          >
            {/* Top row */}
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
                  Digital Club Pass
                </p>
                <h3 className="text-xl font-black text-white mt-0.5">{memberDetails.name}</h3>
                <span className="font-mono text-xs font-bold text-emerald-400 mt-1 inline-block">
                  {memberDetails.memberNumber}
                </span>
              </div>
              <span
                className={`text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider ${
                  isGold
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                    : isSilver
                    ? "bg-slate-200 text-slate-900"
                    : "bg-sky-400 text-slate-950"
                }`}
              >
                {memberDetails.planTier} TIER
              </span>
            </div>

            {/* Middle: Expiry status */}
            <div className="my-4">
              {isExpiringSoon ? (
                <div className="p-3 bg-rose-950/80 border border-rose-600 rounded-2xl flex items-center justify-between text-xs animate-pulse">
                  <div className="flex items-center gap-2 text-rose-300 font-bold">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>Renews in &lt; 7 Days!</span>
                  </div>
                  <button
                    onClick={() => setIsRenewModalOpen(true)}
                    className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold"
                  >
                    Renew Now
                  </button>
                </div>
              ) : (
                <div className="flex justify-between items-center text-xs text-slate-300 font-mono">
                  <span>Valid Through:</span>
                  <span className="font-bold text-white">{formatDate(memberDetails.expiryDate)}</span>
                </div>
              )}
            </div>

            {/* Bottom Row */}
            <div className="pt-3 border-t border-slate-700/60 flex justify-between items-center text-[11px]">
              <span className="text-slate-400 font-medium">The Champions Club</span>
              <button
                onClick={() => setIsRenewModalOpen(true)}
                className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Extend Plan
              </button>
            </div>
          </div>
        </div>

        {/* Right: Tier Perks Grid (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Your Tier Benefits ({plan.name})
              </h3>
              <span className="text-xs text-emerald-400 font-bold">Active Benefits</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Court Play
                </span>
                <p className="text-xl font-extrabold text-emerald-400 mt-1">
                  {plan.courtDiscountPercent === 100 ? "FREE" : `${plan.courtDiscountPercent}% OFF`}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">All 4 courts daily</p>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Pro Gear Shop
                </span>
                <p className="text-xl font-extrabold text-amber-400 mt-1">
                  {plan.shopDiscountPercent}% OFF
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Rackets, balls & shoes</p>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">
                  Bar & Cafeteria
                </span>
                <p className="text-xl font-extrabold text-sky-400 mt-1">
                  {plan.barDiscountPercent}% OFF
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Automatic on all tabs</p>
              </div>

              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 uppercase font-semibold">Daily Cap</span>
                <p className="text-xl font-extrabold text-white mt-1">
                  {plan.maxDailyBookings} Sessions
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Per calendar day</p>
              </div>
            </div>

            {/* Perks list */}
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
              {plan.perks.map((perk: string, i: number) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {perk}
                </span>
              ))}
            </div>
          </div>

          {activeBarTab && (
            <div className="mt-4 p-4 bg-amber-950/30 border border-amber-600/60 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    You have an open bar tab at {activeBarTab.table?.name || "Quick Bar / Counter"}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Tab #{activeBarTab.tabNumber} • {activeBarTab.items?.length || 0} item(s) ordered
                  </p>
                </div>
              </div>
              <span className="text-base font-extrabold text-amber-400 font-mono">
                {formatCurrency(activeBarTab.finalAmount || 0)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Member Activity Dossier (Court Bookings, Shop Orders, Transactions) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Your Court Bookings */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Trophy className="w-4 h-4 text-emerald-400" /> Your Court Sessions (
              {courtBookings.length})
            </h3>
            <button
              onClick={onNavigateToCourts}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold"
            >
              Book New <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {courtBookings.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                You haven't booked any court sessions yet.
              </p>
            ) : (
              courtBookings.map((b: any) => (
                <div
                  key={b.id}
                  className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs flex justify-between items-center"
                >
                  <div>
                    <p className="font-bold text-white">{b.court.name}</p>
                    <p className="text-slate-400 text-[11px]">
                      {formatDate(b.startTime)} • {formatTime(b.startTime)} - {formatTime(b.endTime)}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-400">
                      {b.finalPrice === 0 ? "FREE (Gold Perk)" : formatCurrency(b.finalPrice)}
                    </span>
                    <span className="text-[10px] text-slate-400 block">{b.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Your Pro Shop Purchases */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-amber-400" /> Your Pro Shop Orders (
              {shopOrders.length})
            </h3>
            <button
              onClick={onNavigateToShop}
              className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
            >
              Order Online <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {shopOrders.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No gear purchases yet.</p>
            ) : (
              shopOrders.map((ord: any) => (
                <div
                  key={ord.id}
                  className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs flex justify-between items-center"
                >
                  <div>
                    <p className="font-bold text-white">
                      {ord.items?.map((i: any) => i.product.name).join(", ") || "Gear Purchase"}
                    </p>
                    <p className="text-slate-400 text-[11px]">
                      {ord.orderNumber} • {ord.orderType}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-amber-400">
                      {formatCurrency(ord.finalPrice)}
                    </span>
                    <span className="text-[10px] text-emerald-400 block font-semibold">
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Renewal Modal */}
      {isRenewModalOpen && (
        <PaymentModal
          isOpen={isRenewModalOpen}
          onClose={() => setIsRenewModalOpen(false)}
          amount={plan.monthlyFee * 3}
          title={`Renew ${plan.name} (+3 Months)`}
          notes={`3-Month Renewal for ${memberDetails.name} (${plan.name})`}
          type="MEMBERSHIP_FEE"
          category="MEMBERSHIP"
          memberId={memberDetails.id}
          memberName={memberDetails.name}
          onSuccess={async () => {
            await fetch(`/api/members/${memberDetails.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "RENEW", durationMonths: 3 }),
            });
            fetchMemberProfile();
            refreshUser();
            setIsRenewModalOpen(false);
          }}
        />
      )}

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}
