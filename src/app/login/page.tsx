"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  ShieldCheck,
  User,
  Lock,
  ArrowRight,
  Sparkles,
  Users,
  ShoppingBag,
  Coffee,
  AlertTriangle,
  ChefHat,
  Eye,
  EyeOff,
  Clock,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { computeSafeDestination } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const { user, login, demoLogin, logout, isLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("password123");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);

  // Compute safe redirect destination
  const destination = computeSafeDestination(callbackUrl);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    setErrorMsg(null);
    try {
      await logout();
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Lockout countdown timer if rate limited
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setErrorMsg(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;

    setIsSubmitting(true);
    setErrorMsg(null);

    const result = await login(email, password, rememberMe);
    setIsSubmitting(false);

    if (result.success) {
      router.push(destination);
    } else {
      if (result.retryAfter) {
        setLockoutSeconds(result.retryAfter);
      }
      setErrorMsg(
        result.error ||
          "Invalid credentials. Try entering password123 or select a 1-click demo account below."
      );
    }
  };

  const handleDemoSwitch = async (demoEmail: string) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const result = await demoLogin(demoEmail);
    setIsSubmitting(false);

    if (result.success) {
      router.push(destination);
    } else {
      setErrorMsg(result.error || `Failed to log in as ${demoEmail}`);
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "OWNER":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "FRONT_DESK":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "PRO_SHOP":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "BAR_STAFF":
        return "bg-sky-500/20 text-sky-300 border-sky-500/40";
      case "CHEF":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40";
      case "COACH":
        return "bg-teal-500/20 text-teal-300 border-teal-500/40";
      case "MEMBER":
      default:
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
    }
  };

  const demoAccounts = [
    {
      group: "Club Staff & Management",
      users: [
        {
          name: "Farhan Merchant",
          role: "OWNER / GM",
          email: "farhan.m@champions.club",
          badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
          icon: Trophy,
          description: "Full access across all 6 scenes, finance P&L, HR & ledger",
        },
        {
          name: "Sunil Gavaskar K.",
          role: "FRONT DESK",
          email: "sunil.k@champions.club",
          badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          icon: Users,
          description: "Member check-ins, court bookings, public leads & quotes",
        },
        {
          name: "Pro Shop Attendant",
          role: "PRO SHOP",
          email: "proshop@champions.club",
          badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          icon: ShoppingBag,
          description: "Single-shelf inventory, counter POS & restock alerts",
        },
        {
          name: "Manoj Barista",
          role: "BAR & CAFÉ",
          email: "manoj.b@champions.club",
          badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
          icon: Coffee,
          description: "Table tabs, automatic member discounts & closing earnings",
        },
        {
          name: "Chef Harish Rawat",
          role: "KITCHEN CHEF",
          email: "harish.r@champions.club",
          badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          icon: ChefHat,
          description: "Live kitchen display system prep queue & pass management",
        },
        {
          name: "Coach Anand Kumar",
          role: "HEAD COACH",
          email: "coach.anand@champions.club",
          badgeColor: "bg-teal-500/20 text-teal-300 border-teal-500/40",
          icon: Trophy,
          description: "Tennis & cricket courts schedule and social play",
        },
      ],
    },
    {
      group: "Club Members (Personal Member Portal)",
      users: [
        {
          name: "Rohan Sharma",
          role: "GOLD MEMBER",
          email: "rohan.sharma@example.com",
          id: "CC-1001",
          badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          icon: Sparkles,
          description: "Gold perks: 100% Free Courts • 20% Shop • 20% Bar discount",
        },
        {
          name: "Neha Kapoor",
          role: "SILVER (EXPIRING SOON)",
          email: "neha.kapoor@example.com",
          id: "CC-2002",
          badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          icon: AlertTriangle,
          description: "Expiring in 3 Days! Interactive renewal alert test persona",
        },
        {
          name: "Ishaan Gupta (U-16)",
          role: "JUNIOR MEMBER",
          email: "ishaan.parent@example.com",
          id: "CC-3001",
          badgeColor: "bg-sky-500/20 text-sky-300 border-sky-500/40",
          icon: User,
          description: "Junior perks: 40% Court discount • 15% Junior gear discount",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Background radial gradient */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-600 via-slate-950 to-slate-950" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-xl shadow-amber-500/20">
          <Trophy className="w-7 h-7 text-slate-950" />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold text-white tracking-tight">
          THE CHAMPIONS CLUB
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Unified Sports Facility Operations & Member Access Platform
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl relative z-10 space-y-6">
        {/* Authenticated User Session Banner */}
        {user && !isLoading && (
          <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-teal-950/70 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 font-extrabold text-base shadow-inner shrink-0">
                  {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                </div>
                <div>
                  <div className="flex items-center flex-wrap gap-2">
                    <span className="text-xs font-semibold text-emerald-400">Currently Logged In</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getRoleBadge(user.role)}`}>
                      {user.role}
                    </span>
                    {user.member?.memberNumber && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                        {user.member.memberNumber}
                      </span>
                    )}
                  </div>
                  <p className="text-base font-bold text-white mt-0.5">{user.name}</p>
                  <p className="text-xs text-slate-400 font-mono">{user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => router.push(destination)}
                  disabled={isLoggingOut || isSubmitting}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-950 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <span>Continue to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isLoggingOut || isSubmitting}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 hover:text-rose-300 disabled:opacity-50 disabled:cursor-not-allowed text-slate-300 font-medium rounded-xl text-xs transition border border-slate-700 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{isLoggingOut ? "Signing Out..." : "Sign Out"}</span>
                </button>
              </div>
            </div>

            <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                Active session detected. You can return to your dashboard above, or sign in as a different staff/member below.
              </span>
            </div>
          </div>
        )}

        {/* Join CTA Banner for Public Visitors */}
        <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-amber-950/50 border border-emerald-500/30 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Looking to become a Member?</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Join online now: select your tier, choose duration, and get an instant digital membership pass.
              </p>
            </div>
          </div>
          <Link
            href="/memberships"
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-950 text-center whitespace-nowrap"
          >
            Explore Memberships →
          </Link>
        </div>

        {/* Credentials Login Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-identifier"
                className="block text-xs font-semibold text-slate-300"
              >
                Email Address or Member Number (e.g. CC-1001)
              </label>
              <div className="mt-1 relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  id="login-identifier"
                  name="username"
                  type="text"
                  autoComplete="username"
                  spellCheck={false}
                  required
                  placeholder="e.g. farhan.m@champions.club or rohan.sharma@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition placeholder-slate-600"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-slate-300"
                >
                  Password
                </label>
                <span className="text-[11px] text-emerald-400 font-mono">Demo: password123</span>
              </div>
              <div className="mt-1 relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3.5" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-11 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500 transition placeholder-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-200 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900 cursor-pointer"
                />
                <span className="text-xs text-slate-300">
                  Remember this device <span className="text-slate-500">(30 days)</span>
                </span>
              </label>

              <span className="text-[11px] text-slate-500">
                {rememberMe ? "Extended Session" : "24h Session"}
              </span>
            </div>

            {/* Error or Rate Limit Alert */}
            {errorMsg && (
              <div className="text-xs text-rose-300 bg-rose-950/50 border border-rose-800/80 rounded-xl p-3 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p>{errorMsg}</p>
                  {lockoutSeconds > 0 && (
                    <p className="mt-1 font-mono text-[11px] text-rose-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Lockout active: retry in {lockoutSeconds}s
                    </p>
                  )}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isLoggingOut || lockoutSeconds > 0}
              className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-950 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {lockoutSeconds > 0
                  ? `Locked (${lockoutSeconds}s)`
                  : isSubmitting
                  ? "Authenticating..."
                  : "Sign In with Credentials"}
              </span>
            </button>

            <div className="pt-2 text-center border-t border-slate-800/80">
              <p className="text-xs text-slate-400">
                Not enrolled yet?{" "}
                <Link
                  href="/memberships"
                  className="font-bold text-emerald-400 hover:text-emerald-300 underline underline-offset-4"
                >
                  Buy Membership Online →
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* 1-Click Quick Demo Personas Dock */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" /> 1-Click Demo Persona Switcher
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Instant role testing without manual typing. Click any account to log in.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {demoAccounts.map((section) => (
              <div key={section.group} className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {section.group}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {section.users.map((u) => {
                    const Icon = u.icon;
                    return (
                      <button
                        key={u.email}
                        type="button"
                        onClick={() => handleDemoSwitch(u.email)}
                        disabled={isSubmitting || isLoggingOut}
                        className="p-3 bg-slate-950/80 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-800 hover:border-slate-700 rounded-2xl text-left transition flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${u.badgeColor}`}
                            >
                              {u.role}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-emerald-400 transition transform group-hover:translate-x-0.5" />
                          </div>
                          <p className="text-sm font-bold text-white">{u.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</p>
                          <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                            {u.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          Loading Champions Club Sign In...
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
