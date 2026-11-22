"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Trophy,
  Users,
  ShoppingBag,
  Coffee,
  Globe,
  TrendingUp,
  LogOut,
  User,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  RefreshCw,
  Lock,
  ArrowRight,
  CheckCircle2,
  Calendar,
  Clock,
  Activity,
  Layers,
  Zap,
} from "lucide-react";
import { MemberScene } from "@/components/scenes/MemberScene";
import { CourtScene } from "@/components/scenes/CourtScene";
import { ShopScene } from "@/components/scenes/ShopScene";
import { BarScene } from "@/components/scenes/BarScene";
import { OnlineScene } from "@/components/scenes/OnlineScene";
import { FinanceScene } from "@/components/scenes/FinanceScene";
import { MemberPortal } from "@/components/scenes/MemberPortal";
import { formatCurrency } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ChangePasswordModal } from "@/components/ChangePasswordModal";

type SceneKey = "MEMBER_PORTAL" | "SCENE_1" | "SCENE_2" | "SCENE_3" | "SCENE_4" | "SCENE_5" | "SCENE_6";

export default function HomePage() {
  const router = useRouter();
  const { user, isLoading: authLoading, logout, demoLogin } = useAuth();
  const [activeScene, setActiveScene] = useState<SceneKey>("SCENE_1");
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const [quickStats, setQuickStats] = useState<any>({
    memberCount: 15,
    courtCount: 4,
    revenueToday: 0,
    openTabsCount: 0,
  });

  // Background Polling for Global Stats (every 4 seconds) for Staff based on RBAC permissions
  useEffect(() => {
    if (!user || user.role === "MEMBER") return;

    const fetchGlobalStats = async () => {
      try {
        const canFetchFinance = user.role === "OWNER";
        const canFetchMembers = user.role === "OWNER" || user.role === "FRONT_DESK";
        const canFetchBar = user.role === "OWNER" || user.role === "BAR_STAFF";

        const promises: Promise<Response>[] = [fetch("/api/courts")];
        if (canFetchMembers) promises.push(fetch("/api/members"));
        if (canFetchFinance) promises.push(fetch("/api/finance/analytics"));
        if (canFetchBar) promises.push(fetch("/api/bar/tabs"));

        const responses = await Promise.all(promises);
        let mData: any = { success: false, members: [] };
        let cData: any = { success: false, courts: [] };
        let fData: any = { success: false, summary: { revenueToday: 0 } };
        let bData: any = { success: false, openTabs: [] };

        let idx = 0;
        cData = await responses[idx++].json();
        if (canFetchMembers) mData = await responses[idx++].json();
        if (canFetchFinance) fData = await responses[idx++].json();
        if (canFetchBar) bData = await responses[idx++].json();

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
  }, [user]);

  // Map user role to default scene
  const getDefaultSceneForRole = (role?: string): SceneKey => {
    switch (role) {
      case "MEMBER":
        return "MEMBER_PORTAL";
      case "PRO_SHOP":
        return "SCENE_3";
      case "BAR_STAFF":
      case "CHEF":
      case "CAFE_MANAGER":
        return "SCENE_4";
      case "COACH":
        return "SCENE_2";
      case "HR":
        return "SCENE_6";
      case "FRONT_DESK":
      case "OWNER":
      default:
        return "SCENE_1";
    }
  };

  // Synchronize active scene when user role loads or changes
  useEffect(() => {
    if (!user) return;
    setActiveScene(getDefaultSceneForRole(user.role));
  }, [user?.role]);

  // All possible scenes definition
  const allScenes = [
    {
      key: "MEMBER_PORTAL" as SceneKey,
      label: "My Member Portal",
      sublabel: "Personal pass & perks",
      icon: Sparkles,
      allowedRoles: ["MEMBER"],
    },
    {
      key: "SCENE_1" as SceneKey,
      label: "1. Front Desk & CRM",
      sublabel: "A new member walks in",
      icon: Users,
      allowedRoles: ["OWNER", "FRONT_DESK"],
    },
    {
      key: "SCENE_2" as SceneKey,
      label: "2. Court Engine",
      sublabel: "Busy evening & social play",
      icon: Trophy,
      allowedRoles: ["OWNER", "FRONT_DESK", "COACH", "MEMBER"],
    },
    {
      key: "SCENE_3" as SceneKey,
      label: "3. Pro Gear Shop",
      sublabel: "Single-shelf stock & POS",
      icon: ShoppingBag,
      allowedRoles: ["OWNER", "PRO_SHOP", "MEMBER"],
    },
    {
      key: "SCENE_4" as SceneKey,
      label: "4. Bar & Kitchen KDS",
      sublabel: "Post-match tabs & discounts",
      icon: Coffee,
      allowedRoles: ["OWNER", "BAR_STAFF", "CHEF", "CAFE_MANAGER"],
    },
    {
      key: "SCENE_5" as SceneKey,
      label: "5. Online Discovery",
      sublabel: "Stranger finds club online",
      icon: Globe,
      allowedRoles: ["OWNER", "FRONT_DESK"],
    },
    {
      key: "SCENE_6" as SceneKey,
      label: "6. Owner's Finance & HR",
      sublabel: "End of month P&L aggregation",
      icon: TrendingUp,
      allowedRoles: ["OWNER", "HR"],
    },
  ];

  // Filter visible scenes for active user
  const visibleScenes = allScenes.filter((s) => {
    if (!user) return false;
    if (user.role === "OWNER") return s.key !== "MEMBER_PORTAL"; // Owner has all operational scenes
    return s.allowedRoles.includes(user.role);
  });

  // Ensure currentSceneKey is always permitted for user's role
  const currentSceneKey = (visibleScenes.some((s) => s.key === activeScene)
    ? activeScene
    : (visibleScenes[0]?.key || getDefaultSceneForRole(user?.role))) as SceneKey;

  // Demo Switch Options
  const demoPersonas = [
    { name: "Farhan Merchant (Owner)", email: "farhan.m@champions.club", role: "OWNER" },
    { name: "Sunil Gavaskar K. (Front Desk)", email: "sunil.k@champions.club", role: "FRONT_DESK" },
    { name: "Pro Shop Attendant (Shop Owner)", email: "proshop@champions.club", role: "PRO_SHOP" },
    { name: "Manoj Barista (Bar Manager)", email: "manoj.b@champions.club", role: "BAR_STAFF" },
    { name: "Kavita Nair (Cafe Manager)", email: "cafe.manager@champions.club", role: "CAFE_MANAGER" },
    { name: "Chef Harish Rawat (Kitchen KDS)", email: "harish.r@champions.club", role: "CHEF" },
    { name: "Ananya Deshmukh (HR Manager)", email: "hr@champions.club", role: "HR" },
    { name: "Coach Anand Kumar (Court Manager)", email: "coach.anand@champions.club", role: "COACH" },
    { name: "Rohan Sharma (Gold Member)", email: "rohan.sharma@example.com", role: "MEMBER" },
    { name: "Neha Kapoor (Silver Expiring)", email: "neha.kapoor@example.com", role: "MEMBER" },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 text-sm">
        <RefreshCw className="w-6 h-6 animate-spin mb-3 text-emerald-400" />
        <p className="font-semibold text-white">The Champions Club</p>
        <p className="text-xs text-slate-500 mt-1">Verifying secure credentials...</p>
      </div>
    );
  }

  // If unauthenticated, show public landing experience
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Navigation Bar */}
        <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20">
                <Trophy className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <span className="font-extrabold text-white text-base tracking-tight">
                  THE CHAMPIONS CLUB
                </span>
                <p className="text-[10px] text-emerald-400 font-medium">
                  Unified Sports & Athletic Club Platform
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/memberships"
                className="hidden sm:inline-flex px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                Memberships
              </Link>
              <Link
                href="/login"
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Sign In
              </Link>
              <Link
                href="/memberships"
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-950 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Join Now</span>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="relative overflow-hidden py-16 sm:py-24 px-4 sm:px-6 lg:px-8 text-center border-b border-slate-800/80">
          <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600 via-slate-950 to-slate-950" />
          <div className="max-w-4xl mx-auto relative z-10 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Premier Sports Club & Unified Operations Management</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
              Where Sports Excellence Meets Modern Convenience
            </h1>

            <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Experience international-grade tennis courts, professional cricket training nets, premium pro shop gear, and culinary post-match sports dining.
            </p>

            <div className="pt-2 flex flex-wrap justify-center gap-4">
              <Link
                href="/memberships"
                className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-2xl text-sm transition shadow-xl shadow-emerald-950 flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Explore Memberships</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/login"
                className="px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold rounded-2xl text-sm transition shadow-lg flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Sign In to Terminal</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Club Facilities & Features Grid */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-12">
          <div className="text-center space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">World-Class Club Facilities</h2>
            <p className="text-sm text-slate-400">Everything you need for elite training, competition, and post-match recovery.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-slate-700 transition">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
                <Trophy className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Championship Courts</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Plexicushion tennis courts and tournament-grade cricket nets with advanced floodlights for evening play.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-slate-700 transition">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">The Pro Gear Shop</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Authorized premium gear, balls, stringing service, and instant discounts for enrolled members.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-slate-700 transition">
              <div className="w-12 h-12 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
                <Coffee className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Clubhouse Bar & KDS</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Artisan coffee, healthy post-match hydration, match screening lounge, and table tabs with live kitchen dispatch.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3 hover:border-slate-700 transition">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">Coaching Academy</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Certified coaching sessions, junior development ladders, and structured social match tournaments.
              </p>
            </div>
          </div>

          {/* Membership Tier Cards */}
          <div className="mt-12 bg-slate-900/40 border border-slate-800 rounded-3xl p-8 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-6">
              <div>
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  Membership Passes
                </h3>
                <p className="text-xs text-slate-400 mt-1">Instant digital membership passes with full facility privileges.</p>
              </div>
              <Link
                href="/memberships"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition"
              >
                View Plans & Pricing →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-slate-950/80 border border-amber-500/40 space-y-4 relative">
                <span className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  MOST POPULAR
                </span>
                <div>
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Gold Pass</p>
                  <p className="text-2xl font-black text-white mt-1">₹6,000 <span className="text-xs font-normal text-slate-400">/mo</span></p>
                </div>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 100% Free Peak Courts</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 20% Off Pro Shop Gear</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 20% Off Bar & Food Tabs</li>
                </ul>
                <Link
                  href="/join?tier=GOLD&duration=6"
                  className="block text-center py-2.5 bg-gradient-to-r from-amber-500 to-emerald-500 hover:opacity-90 text-slate-950 font-bold rounded-xl text-xs transition"
                >
                  Join Gold
                </Link>
              </div>

              <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Silver Pass</p>
                  <p className="text-2xl font-black text-white mt-1">₹3,500 <span className="text-xs font-normal text-slate-400">/mo</span></p>
                </div>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Free Off-Peak Courts</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 10% Off Pro Shop Gear</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 10% Off Bar & Food Tabs</li>
                </ul>
                <Link
                  href="/join?tier=SILVER&duration=3"
                  className="block text-center py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
                >
                  Join Silver
                </Link>
              </div>

              <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div>
                  <p className="text-xs font-bold text-sky-400 uppercase tracking-wider">Junior Pass (U-18)</p>
                  <p className="text-2xl font-black text-white mt-1">₹2,200 <span className="text-xs font-normal text-slate-400">/mo</span></p>
                </div>
                <ul className="text-xs text-slate-300 space-y-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 40% Off Court Bookings</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 15% Off Youth Gear</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Academy Squad Priority</li>
                </ul>
                <Link
                  href="/join?tier=JUNIOR&duration=3"
                  className="block text-center py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
                >
                  Join Junior
                </Link>
              </div>
            </div>
          </div>

          {/* Quick 1-Click Persona Launchpad */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  1-Click Operational Persona Switcher
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Instant terminal access for testing each staff and member role without entering credentials.
                </p>
              </div>
              <Link
                href="/login"
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
              >
                <span>Go to Full Sign In Page</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {demoPersonas.map((p) => (
                <button
                  key={p.email}
                  onClick={() => demoLogin(p.email)}
                  className="p-3 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-emerald-500/50 rounded-2xl text-left transition group"
                >
                  <p className="text-[10px] font-mono text-emerald-400 uppercase">{p.role}</p>
                  <p className="text-xs font-bold text-white mt-1 truncate group-hover:text-emerald-300 transition">
                    {p.name.split(" ")[0]}
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono truncate">{p.email}</p>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Public Footer */}
        <footer className="mt-auto border-t border-slate-800 bg-slate-950 py-6 text-center text-xs text-slate-500">
          <p className="font-semibold text-slate-400">The Champions Club Management Platform</p>
          <p className="text-[11px] text-slate-600 mt-1">
            Built with Next.js App Router, TypeScript, Tailwind CSS, PostgreSQL & Prisma
          </p>
        </footer>
      </div>
    );
  }

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

          {/* Right Section: User Profile & 1-Click Persona Switcher */}
          <div className="flex items-center gap-3">
            {/* Quick Metrics (Hidden on Mobile) */}
            <div className="hidden xl:flex items-center gap-3 text-xs mr-2">
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
            </div>

            {/* Persona Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
                className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition text-left"
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    user.role === "OWNER"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                      : user.role === "MEMBER"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  }`}
                >
                  {user.name?.charAt(0) || "U"}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-white line-clamp-1">{user.name || "User"}</p>
                  <p className="text-[10px] text-emerald-400 font-mono leading-none">
                    {user.member ? `${user.member.planTier} MEMBER` : user.role}
                  </p>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {/* Persona Dropdown Menu */}
              {isPersonaMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 space-y-1 animate-in fade-in zoom-in-95">
                  <div className="px-3 py-2 border-b border-slate-800 text-xs">
                    <p className="text-slate-400 font-semibold">Active Persona</p>
                    <p className="font-bold text-white mt-0.5">{user.name}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{user.email}</p>
                  </div>

                  <div className="py-1">
                    <p className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Switch Persona (1-Click)
                    </p>
                    {demoPersonas.map((p) => (
                      <button
                        key={p.email}
                        onClick={async () => {
                          await demoLogin(p.email);
                          setIsPersonaMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg text-xs flex justify-between items-center transition ${
                          user.email === p.email
                            ? "bg-emerald-950/60 text-emerald-300 font-bold border border-emerald-800"
                            : "text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[9px] font-mono text-slate-500">{p.role}</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-1 border-t border-slate-800 space-y-0.5">
                    <button
                      onClick={() => {
                        setIsPasswordModalOpen(true);
                        setIsPersonaMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
                    >
                      <Lock className="w-3.5 h-3.5 text-emerald-400" /> Change Password
                    </button>
                    <button
                      onClick={() => logout()}
                      className="w-full text-left px-3 py-1.5 text-rose-400 hover:bg-rose-950/40 rounded-lg text-xs font-semibold flex items-center gap-2 transition"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scene Navigation Ribbon (Filtered for active role) */}
        <div className="bg-slate-950/90 border-t border-slate-800/80 overflow-x-auto scrollbar-none">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 py-1.5">
            {visibleScenes.map((scene) => {
              const Icon = scene.icon;
              const isActive = currentSceneKey === scene.key;

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
        {currentSceneKey === "MEMBER_PORTAL" && (
          <MemberPortal
            onNavigateToCourts={() => setActiveScene("SCENE_2")}
            onNavigateToShop={() => setActiveScene("SCENE_3")}
          />
        )}
        {currentSceneKey === "SCENE_1" && <MemberScene />}
        {currentSceneKey === "SCENE_2" && <CourtScene />}
        {currentSceneKey === "SCENE_3" && <ShopScene />}
        {currentSceneKey === "SCENE_4" && <BarScene />}
        {currentSceneKey === "SCENE_5" && <OnlineScene />}
        {currentSceneKey === "SCENE_6" && <FinanceScene />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <p>
          The Champions Club Management Platform • Authenticated as{" "}
          <span className="text-slate-300 font-semibold">{user.name || "User"}</span> ({user.role})
        </p>
      </footer>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </div>
  );
}
