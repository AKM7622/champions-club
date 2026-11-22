"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Zap,
  ArrowRight,
  Clock,
  ShoppingBag,
  Coffee,
  Calendar,
  Lock,
  User,
  Mail,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  RefreshCw,
  CreditCard,
  QrCode,
  Check,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { PricingCalculator } from "@/lib/pricing";
import { validatePasswordStrength } from "@/lib/password-validator";
import { PaymentModal } from "@/components/PaymentModal";
import { useAuth } from "@/contexts/AuthContext";
import { MemberPortal } from "@/components/scenes/MemberPortal";

interface Plan {
  id: string;
  tier: "GOLD" | "SILVER" | "JUNIOR";
  name: string;
  monthlyFee: number;
  courtDiscountPercent: number;
  shopDiscountPercent: number;
  barDiscountPercent: number;
  maxDailyBookings: number;
  perks: string[];
  color: string;
}

function MembershipPurchaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTier = searchParams.get("tier");
  const initialTier = rawTier ? rawTier.toUpperCase() : "GOLD";

  const { user, refreshUser } = useAuth();

  // Plans & Selection
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [selectedTier, setSelectedTier] = useState<string>(initialTier);
  const [durationMonths, setDurationMonths] = useState<number>(6);
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(false);
  const [customMonthsInput, setCustomMonthsInput] = useState<string>("6");

  // Visitor Account Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    notes: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState<any | null>(null);

  // Fetch Live Membership Plans from PostgreSQL Database
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch("/api/plans");
        const data = await res.json();
        if (data.success && data.plans) {
          setPlans(data.plans);
          // If query tier was provided, select it
          if (initialTier && data.plans.some((p: Plan) => p.tier === initialTier)) {
            setSelectedTier(initialTier);
          }
        }
      } catch (err) {
        console.error("Failed to load membership plans:", err);
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, [initialTier]);

  // Selected Plan Object
  const currentPlan = plans.find((p) => p.tier === selectedTier) || plans[0];

  // Effective Duration Calculation
  const parsedCustomMonths = parseInt(customMonthsInput, 10);
  const effectiveDuration = isCustomDuration
    ? Math.max(1, isNaN(parsedCustomMonths) ? 1 : parsedCustomMonths)
    : durationMonths;

  // Real-Time Fee Calculation via PricingCalculator
  const feeCalculation = currentPlan
    ? PricingCalculator.calculateMembershipFee({
        monthlyFee: currentPlan.monthlyFee,
        durationMonths: effectiveDuration,
        tier: currentPlan.tier,
      })
    : {
        tier: "GOLD",
        monthlyFee: 6000,
        durationMonths: 6,
        basePrice: 36000,
        discountPercent: 0,
        discountAmount: 0,
        finalPrice: 36000,
      };

  // Password validation
  const pwdValidation = validatePasswordStrength(formData.password);

  // Validate form before opening checkout
  const handleProceedToCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.name.trim()) {
      setFormError("Please enter your full name.");
      return;
    }

    if (!formData.email.trim() || !formData.email.includes("@")) {
      setFormError("Please enter a valid email address.");
      return;
    }

    if (!formData.phone.trim()) {
      setFormError("Please enter your phone number.");
      return;
    }

    if (!formData.password) {
      setFormError("Please create a password for your member account.");
      return;
    }

    if (!pwdValidation.isValid) {
      setFormError(
        pwdValidation.errorMessage ||
          "Password must be at least 8 characters and contain lowercase, uppercase, and numeric characters."
      );
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError("Passwords do not match. Please re-enter matching passwords.");
      return;
    }

    if (!currentPlan) {
      setFormError("Please select a membership plan.");
      return;
    }

    // Open Payment Modal
    setIsPaymentModalOpen(true);
  };

  // Process checkout via POST /api/members/join
  const handleProcessEnrollment = async (paymentMethod: "UPI" | "CARD" | "CASH") => {
    setIsEnrolling(true);
    setFormError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        planTier: currentPlan.tier,
        durationMonths: effectiveDuration,
        paymentMethod,
        notes: formData.notes.trim() || undefined,
      };

      const res = await fetch("/api/members/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to complete membership enrollment.");
      }

      setEnrollmentSuccess(data);
      await refreshUser();

      return data;
    } catch (err: any) {
      throw err;
    } finally {
      setIsEnrolling(false);
    }
  };

  // Transition to Member Portal
  const handleGoToMemberPortal = () => {
    setIsPaymentModalOpen(false);
    // If successfully enrolled, redirect to home which renders MemberPortal
    router.push("/");
  };

  // If user is already a member and just enrolled, or wants to see portal
  if (enrollmentSuccess && !isPaymentModalOpen) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-emerald-950/60 border border-emerald-500/40 p-6 rounded-3xl text-center space-y-3 animate-in fade-in">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-white">
              Welcome to The Champions Club, {enrollmentSuccess.member?.name}!
            </h1>
            <p className="text-sm text-emerald-300 max-w-md mx-auto">
              Your membership has been activated! Your official digital Member ID is{" "}
              <span className="font-mono font-bold text-white bg-slate-900 px-2 py-0.5 rounded border border-emerald-500/40">
                {enrollmentSuccess.member?.memberNumber}
              </span>
              . You are now logged in.
            </p>
            <div className="pt-2">
              <button
                onClick={() => router.push("/")}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm transition shadow-lg shadow-emerald-950"
              >
                Go to My Member Portal Now
              </button>
            </div>
          </div>

          {/* Inline Member Portal preview */}
          <MemberPortal
            initialMember={enrollmentSuccess?.member}
            onNavigateToCourts={() => router.push("/")}
            onNavigateToShop={() => router.push("/")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 group-hover:scale-105 transition transform">
              <Trophy className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <span className="font-extrabold text-white text-base tracking-tight group-hover:text-amber-400 transition">
                THE CHAMPIONS CLUB
              </span>
              <p className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">
                Premier Sports & Social Club
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Signed in as <strong className="text-white">{user.name}</strong> ({user.role})
                </span>
                <Link
                  href="/"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-950"
                >
                  Go to {user.role === "MEMBER" ? "Member Portal" : "Club Operations"}
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs transition"
                >
                  Member Sign In
                </Link>
                <a
                  href="#enrollment-section"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition shadow-md shadow-emerald-950"
                >
                  Join Online
                </a>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Hero Banner */}
        <section className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-950/80 via-slate-900 to-amber-950/60 border border-slate-800 p-8 sm:p-12 shadow-2xl">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5" /> Instant Digital Membership Pass
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
              Elevate Your Game at The Champions Club
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Experience world-class athletic facilities: 4 tournament-grade floodlit courts (ITF Plexicushion,
              European red clay, and box cricket), robotic Bola bowling machines, private coaching clinics,
              curated pro shop gear, and Clubhouse Bar & Bistro dining.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <a
                href="#enrollment-section"
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold rounded-xl text-xs transition shadow-lg shadow-emerald-950 flex items-center gap-2"
              >
                <span>Choose a Membership Tier</span>
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="#club-perks"
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-xl text-xs transition"
              >
                Explore Member Benefits
              </a>
            </div>
          </div>
        </section>

        {/* Feature Badges Grid */}
        <section id="club-perks" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">4 Floodlit Courts</p>
              <p className="text-[11px] text-slate-400">ITF Tennis & Box Cricket</p>
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Pro Gear Discounts</p>
              <p className="text-[11px] text-slate-400">Up to 20% off apparel & gear</p>
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl">
              <Coffee className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Clubhouse Dining</p>
              <p className="text-[11px] text-slate-400">Matchday bar & kitchen perks</p>
            </div>
          </div>

          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Instant Activation</p>
              <p className="text-[11px] text-slate-400">Digital pass upon checkout</p>
            </div>
          </div>
        </section>

        {/* STEP 1: Interactive Membership Plans Showcase */}
        <section id="enrollment-section" className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Step 1: Choose Your Tier & Duration
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Official Membership Tiers
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Live pricing and entitlement perks synced directly from the Champions Club master ledger.
            </p>
          </div>

          {loadingPlans ? (
            <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
              Loading live membership tiers from club database...
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((p) => {
                const isSelected = p.tier === selectedTier;
                const isGold = p.tier === "GOLD";
                const isSilver = p.tier === "SILVER";

                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedTier(p.tier)}
                    className={`rounded-3xl border p-6 sm:p-7 flex flex-col justify-between relative cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? "bg-slate-900 border-emerald-500 ring-2 ring-emerald-500/50 shadow-2xl shadow-emerald-950/40 transform -translate-y-1"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                    }`}
                  >
                    {isGold && (
                      <span className="absolute -top-3 right-6 text-[10px] font-extrabold px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 uppercase tracking-wider shadow-lg">
                        Most Popular • All-Access
                      </span>
                    )}

                    <div>
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg uppercase ${
                            isGold
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : isSilver
                              ? "bg-slate-700 text-slate-200 border border-slate-600"
                              : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                          }`}
                        >
                          {p.tier} TIER
                        </span>
                        {isSelected && (
                          <span className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs shadow-md">
                            ✓
                          </span>
                        )}
                      </div>

                      <h3 className="text-xl font-black text-white mt-3">{p.name}</h3>

                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold text-white">
                          {formatCurrency(p.monthlyFee)}
                        </span>
                        <span className="text-xs text-slate-400 font-normal">/ month</span>
                      </div>

                      {/* Entitlements Highlights */}
                      <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-400">Court Bookings:</span>
                          <span className="font-bold text-emerald-400 font-mono">
                            {p.courtDiscountPercent === 100
                              ? "100% Free Access"
                              : `${p.courtDiscountPercent}% Discount`}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-400">Pro Gear Shop:</span>
                          <span className="font-bold text-amber-400 font-mono">
                            {p.shopDiscountPercent}% Off
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-400">Clubhouse Bar & Cafe:</span>
                          <span className="font-bold text-sky-400 font-mono">
                            {p.barDiscountPercent}% Off
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80">
                          <span className="text-slate-400">Daily Bookings Limit:</span>
                          <span className="font-bold text-slate-200 font-mono">
                            {p.maxDailyBookings} slots/day
                          </span>
                        </div>
                      </div>

                      {/* Perks List */}
                      <div className="mt-4 space-y-2 border-t border-slate-800/80 pt-4 text-xs text-slate-300">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                          Included Benefits:
                        </p>
                        {p.perks.map((perk: string, i: number) => (
                          <div key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span className="leading-tight">{perk}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedTier(p.tier)}
                      className={`mt-6 w-full py-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950"
                          : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {isSelected ? "Selected Tier ✓" : `Select ${p.tier} Plan`}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Duration Selector & Dynamic Fee Breakdown */}
          {currentPlan && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400" /> Select Membership Duration
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Choose standard or custom months. Total fee is dynamically calculated via Pricing Engine.
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-xs text-slate-400">Active Selection:</span>
                  <p className="text-sm font-bold text-emerald-400">
                    {currentPlan.name} • {effectiveDuration} Month{effectiveDuration > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {/* Duration Presets + Custom Option */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { months: 1, label: "1 Month", tag: "Monthly" },
                  { months: 3, label: "3 Months", tag: "Quarterly" },
                  { months: 6, label: "6 Months", tag: "Half-Yearly" },
                  { months: 12, label: "12 Months", tag: "Annual Pass" },
                ].map((dur) => {
                  const isChecked = !isCustomDuration && durationMonths === dur.months;
                  const fee = PricingCalculator.calculateMembershipFee({
                    monthlyFee: currentPlan.monthlyFee,
                    durationMonths: dur.months,
                    tier: currentPlan.tier,
                  });

                  return (
                    <button
                      key={dur.months}
                      type="button"
                      onClick={() => {
                        setIsCustomDuration(false);
                        setDurationMonths(dur.months);
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition flex flex-col justify-between ${
                        isChecked
                          ? "bg-emerald-500/10 border-emerald-500 text-white shadow-md shadow-emerald-950"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                      }`}
                    >
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 block">
                          {dur.tag}
                        </span>
                        <span className="text-sm font-extrabold text-white mt-0.5 block">
                          {dur.label}
                        </span>
                      </div>
                      <span className="text-xs font-mono font-bold text-emerald-400 mt-2 block">
                        {formatCurrency(fee.finalPrice)}
                      </span>
                    </button>
                  );
                })}

                {/* Custom Duration Input */}
                <div
                  onClick={() => setIsCustomDuration(true)}
                  className={`p-3.5 rounded-2xl border transition flex flex-col justify-between cursor-pointer ${
                    isCustomDuration
                      ? "bg-emerald-500/10 border-emerald-500 text-white shadow-md shadow-emerald-950"
                      : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                  }`}
                >
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Custom Plan
                    </span>
                    <span className="text-sm font-extrabold text-white mt-0.5 block">
                      Custom Months
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={customMonthsInput}
                      onChange={(e) => {
                        setIsCustomDuration(true);
                        setCustomMonthsInput(e.target.value);
                      }}
                      className="w-16 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-center text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                    />
                    <span className="text-xs text-slate-400">mo</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Price Summary Box */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-950 to-slate-900 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs text-slate-400">Calculated Membership Total:</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                      {formatCurrency(feeCalculation.finalPrice)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      ({formatCurrency(currentPlan.monthlyFee)} × {effectiveDuration} months)
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right space-y-0.5 text-xs text-slate-400 font-mono">
                  <p>
                    Plan Tier: <span className="text-white font-bold">{currentPlan.tier}</span>
                  </p>
                  <p>
                    Duration: <span className="text-white font-bold">{effectiveDuration} Month(s)</span>
                  </p>
                  <p>
                    Valid Until:{" "}
                    <span className="text-emerald-400 font-bold">
                      {formatDate(new Date(Date.now() + effectiveDuration * 30 * 86400000))}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* STEP 2: Visitor Account Information & Registration Form */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              Step 2: Enter Member Details & Credentials
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white mt-1">
              Create Your Member Account
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Your account allows you to book courts, view discounts, track clubhouse tabs, and access your digital card.
            </p>
          </div>

          {formError && (
            <div className="p-4 bg-rose-950/50 border border-rose-800/80 rounded-2xl text-xs text-rose-300 flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleProceedToCheckout} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                  <User className="w-3.5 h-3.5 text-emerald-400" /> Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Malhotra"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                  <Mail className="w-3.5 h-3.5 text-emerald-400" /> Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="vikram@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" /> Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Password */}
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between mb-1">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-emerald-400" /> Create Account Password *
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-slate-400 hover:text-white"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="Min 8 chars with uppercase, lowercase, numbers"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Password Strength Checklist */}
                {formData.password && (
                  <div className="mt-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Password Strength:</span>
                      <span
                        className={`font-bold ${
                          pwdValidation.isValid
                            ? "text-emerald-400"
                            : pwdValidation.score >= 2
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {pwdValidation.strengthLabel}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 pt-1">
                      {pwdValidation.criteria.slice(0, 4).map((c) => (
                        <div
                          key={c.id}
                          className={`flex items-center gap-1.5 ${
                            c.met ? "text-emerald-400" : "text-slate-500"
                          }`}
                        >
                          <span>{c.met ? "✓" : "○"}</span>
                          <span>{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" /> Confirm Password *
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Re-enter password to confirm"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                />
                {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                  <p className="text-[11px] text-rose-400 mt-1">Passwords do not match.</p>
                )}
                {formData.confirmPassword && formData.password === formData.confirmPassword && (
                  <p className="text-[11px] text-emerald-400 mt-1">✓ Passwords match.</p>
                )}
              </div>
            </div>

            {/* Optional Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1 block">
                Additional Notes or Athletic Interests (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Interested in tennis tournament leagues and private coaching sessions..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Checkout Action Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800">
              <div className="text-xs text-slate-400">
                <span>By continuing, you agree to The Champions Club rules and terms of play.</span>
              </div>

              <button
                type="submit"
                disabled={!currentPlan || isEnrolling}
                className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-extrabold rounded-2xl text-sm transition shadow-xl shadow-emerald-950 flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>
                  Proceed to Checkout ({formatCurrency(feeCalculation.finalPrice)})
                </span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>
        </section>
      </main>

      {/* Simulated Payment Modal with Bank Confirmation Gate & Auto-Login */}
      {currentPlan && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          amount={feeCalculation.finalPrice}
          title={`Champions Club ${currentPlan.name} (${effectiveDuration} mo)`}
          notes={`Public Membership Enrollment: ${currentPlan.name} for ${formData.name}`}
          type="MEMBERSHIP_FEE"
          category="MEMBERSHIP"
          memberName={formData.name}
          onProcessPayment={handleProcessEnrollment}
          successButtonText="Enter My Member Portal"
          onFinish={() => {
            // Callback when user clicks 'Enter My Member Portal' on receipt view
            handleGoToMemberPortal();
          }}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950 py-8 text-center text-xs text-slate-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-semibold text-slate-400">
            The Champions Club • World-Class Tennis, Cricket, Bar & Fitness Destination
          </p>
          <p>
            Secure 256-bit simulated payment settlement • Instant Member Portal activation • Zero hidden fees
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function MembershipPurchasePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2 text-emerald-400" />
          Loading Champions Club Memberships...
        </div>
      }
    >
      <MembershipPurchaseContent />
    </Suspense>
  );
}
