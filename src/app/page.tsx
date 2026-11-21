"use client";

import React, { useState, useEffect } from "react";
import {
  Trophy,
  Users,
  ShoppingBag,
  Coffee,
  Globe,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  CreditCard,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import { MemberScene } from "@/components/scenes/MemberScene";
import { CourtScene } from "@/components/scenes/CourtScene";
import { ShopScene } from "@/components/scenes/ShopScene";
import { BarScene } from "@/components/scenes/BarScene";
import { OnlineScene } from "@/components/scenes/OnlineScene";
import { FinanceScene } from "@/components/scenes/FinanceScene";
import { formatCurrency } from "@/lib/utils";

type SceneKey = "SCENE_1" | "SCENE_2" | "SCENE_3" | "SCENE_4" | "SCENE_5" | "SCENE_6";

export default function HomePage() {
  const [activeScene, setActiveScene] = useState<SceneKey>("SCENE_1");
  const [quickStats, setQuickStats] = useState<any>({
    memberCount: 15,
    courtCount: 4,
    revenueToday: 0,
    openTabsCount: 0,
  });

  // Background Polling for Global Stats (every 4 seconds)
  useEffect(() => {
    const fetchGlobalStats = async () => {
      try {
        const [membersRes, courtsRes, financeRes, barRes] = await Promise.all([
          fetch("/api/members"),
          fetch("/api/courts"),
          fetch("/api/finance/analytics"),
          fetch("/api/bar/tabs"),
        ]);

        const mData = await membersRes.json();
        const cData = await courtsRes.json();
        const fData = await financeRes.json();
        const bData = await barRes.json();

        setQuickStats({
          memberCount: mData.success ? mData.members.length : 15,
          courtCount: cData.success ? cData.courts.length : 4,
          revenueToday: fData.success ? fData.summary.revenueToday : 0,
          openTabsCount: bData.success ? bData.openTabs.length : 0,
        });
      } catch (err) {
        // silent fallback
      }
    };

    fetchGlobalStats();
    const interval = setInterval(fetchGlobalStats, 4000);
    return () => clearInterval(interval);
  }, []);

  const scenes = [
    {
      key: "SCENE_1" as SceneKey,
      label: "1. Front Desk & CRM",
      sublabel: "A new member walks in",
      icon: Users,
      badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    },
    {
      key: "SCENE_2" as SceneKey,
      label: "2. Court Engine",
      sublabel: "Busy evening & social play",
      icon: Trophy,
      badgeColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    },
    {
      key: "SCENE_3" as SceneKey,
      label: "3. Pro Gear Shop",
      sublabel: "Single-shelf stock & pre-match",
      icon: ShoppingBag,
      badgeColor: "text-amber-400 bg-amber-500/10 border-amber-500/30",
    },
    {
      key: "SCENE_4" as SceneKey,
      label: "4. Bar & Kitchen KDS",
      sublabel: "Post-match tabs & discounts",
      icon: Coffee,
      badgeColor: "text-sky-400 bg-sky-500/10 border-sky-500/30",
    },
    {
      key: "SCENE_5" as SceneKey,
      label: "5. Online Discovery",
      sublabel: "Stranger finds club online",
      icon: Globe,
      badgeColor: "text-teal-400 bg-teal-500/10 border-teal-500/30",
    },
    {
      key: "SCENE_6" as SceneKey,
      label: "6. Owner's Finance & HR",
      sublabel: "End of month P&L aggregation",
      icon: TrendingUp,
      badgeColor: "text-purple-400 bg-purple-500/10 border-purple-500/30",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
              <Trophy className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base tracking-tight">
                  THE CHAMPIONS CLUB
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Sync (3s)
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Unified Sports Club Management System • Tennis, Cricket, Bar, Pro Shop & CRM
              </p>
            </div>
          </div>

          {/* Quick Real-Time Metrics Badges */}
          <div className="hidden lg:flex items-center gap-3 text-xs">
            <div className="px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-2">
              <span className="text-slate-400">Courts:</span>
              <span className="font-bold text-emerald-400 font-mono">
                {quickStats.courtCount} Active
              </span>
            </div>

            <div className="px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-2">
              <span className="text-slate-400">Members:</span>
              <span className="font-bold text-amber-400 font-mono">
                {quickStats.memberCount} Enrolled
              </span>
            </div>

            <div className="px-3 py-1.5 bg-slate-950 rounded-xl border border-slate-800 flex items-center gap-2">
              <span className="text-slate-400">Today's Ledger:</span>
              <span className="font-bold text-white font-mono">
                {formatCurrency(quickStats.revenueToday)}
              </span>
            </div>
          </div>
        </div>

        {/* Scene Navigation Ribbon */}
        <div className="bg-slate-950/90 border-t border-slate-800/80 overflow-x-auto scrollbar-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 py-1.5">
            {scenes.map((scene) => {
              const Icon = scene.icon;
              const isActive = activeScene === scene.key;

              return (
                <button
                  key={scene.key}
                  onClick={() => setActiveScene(scene.key)}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    isActive
                      ? "bg-slate-800 text-white border border-slate-700 shadow-md shadow-slate-950"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-emerald-400" : "text-slate-500"
                    }`}
                  />
                  <div className="text-left">
                    <p className="leading-tight">{scene.label}</p>
                    <p className="text-[10px] text-slate-500 font-normal leading-tight">
                      {scene.sublabel}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Scene Body */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {activeScene === "SCENE_1" && <MemberScene />}
        {activeScene === "SCENE_2" && <CourtScene />}
        {activeScene === "SCENE_3" && <ShopScene />}
        {activeScene === "SCENE_4" && <BarScene />}
        {activeScene === "SCENE_5" && <OnlineScene />}
        {activeScene === "SCENE_6" && <FinanceScene />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <p>
          The Champions Club Management Platform • Built with Next.js App Router, TypeScript,
          Tailwind CSS, PostgreSQL & Prisma
        </p>
      </footer>
    </div>
  );
}
