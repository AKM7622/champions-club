"use client";

import React, { useState, useEffect } from "react";
import {
  Globe,
  Sparkles,
  Calendar,
  Send,
  UserCheck,
  CheckCircle2,
  DollarSign,
  Trophy,
  ShoppingBag,
  Clock,
  Phone,
  Mail,
  MessageSquare,
  ShieldCheck,
  ExternalLink,
  Flame,
  AlertTriangle,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

export function OnlineScene() {
  const [activeTab, setActiveTab] = useState<"PUBLIC_WEBSITE" | "STAFF_CRM">("PUBLIC_WEBSITE");
  const [plans, setPlans] = useState<any[]>([]);
  const [courts, setCourts] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Visitor Form State
  const [visitorForm, setVisitorForm] = useState({
    name: "",
    email: "",
    phone: "",
    interest: "Tennis Trial & Gold Membership",
    trialDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
    notes: "Looking to check out floodlit tennis courts this week.",
  });
  const [trialSuccessMsg, setTrialSuccessMsg] = useState<string | null>(null);
  const [trialErrorMsg, setTrialErrorMsg] = useState<string | null>(null);

  // Staff Quote & Conversion Modal
  const [quotingLead, setQuotingLead] = useState<any | null>(null);
  const [quoteAmount, setQuoteAmount] = useState<number>(6000);
  const [quoteNotes, setQuoteNotes] = useState("");

  const [convertingLead, setConvertingLead] = useState<any | null>(null);
  const [convertTier, setConvertTier] = useState<string>("GOLD");
  const [convertSuccessMsg, setConvertSuccessMsg] = useState<string | null>(null);

  // Fetch Data
  const fetchData = async () => {
    try {
      const [plansRes, courtsRes, leadsRes] = await Promise.all([
        fetch("/api/plans"),
        fetch("/api/courts"),
        fetch("/api/leads"),
      ]);

      const plansData = await plansRes.json();
      const courtsData = await courtsRes.json();
      const leadsData = await leadsRes.json();

      if (plansData.success) setPlans(plansData.plans);
      if (courtsData.success) setCourts(courtsData.courts);
      if (leadsData.success) setLeads(leadsData.leads);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Polling every 3.5 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3500);
    return () => clearInterval(interval);
  }, []);

  // Submit Public Trial Request
  const handleVisitorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrialErrorMsg(null);
    setTrialSuccessMsg(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(visitorForm),
      });

      const data = await res.json();
      if (data.success) {
        setTrialSuccessMsg("🎉 Trial session booked! Staff notified in the CRM pipeline.");
        setTrialErrorMsg(null);
        setVisitorForm({
          name: "",
          email: "",
          phone: "",
          interest: "Tennis Trial & Gold Membership",
          trialDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
          notes: "",
        });
        fetchData();
        setTimeout(() => setTrialSuccessMsg(null), 6000);
      } else {
        setTrialErrorMsg(data.error || "Failed to submit trial inquiry.");
      }
    } catch (err: any) {
      console.error(err);
      setTrialErrorMsg("Network error. Please try again.");
    }
  };

  // Staff: Send Quote
  const handleSendQuote = async () => {
    if (!quotingLead) return;
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: quotingLead.id,
          action: "SEND_QUOTE",
          quoteAmount,
          notes: quoteNotes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setQuotingLead(null);
        setQuoteNotes("");
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Staff: Convert to Member (writes to ledger)
  const handleConvertLead = async () => {
    if (!convertingLead) return;
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: convertingLead.id,
          action: "CONVERT_TO_MEMBER",
          planTier: convertTier,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConvertingLead(null);
        setConvertSuccessMsg(data.message);
        fetchData();
        setTimeout(() => setConvertSuccessMsg(null), 6000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-sky-500/10 text-sky-400 rounded-lg">
              <Globe className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-white">Scene 5: Online Discovery & Lead Pipeline</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Club Website • Real-time Court Availability • Instant Trial Booking • Staff Follow-up & Quotes.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab("PUBLIC_WEBSITE")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "PUBLIC_WEBSITE"
                ? "bg-slate-800 text-sky-400 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Globe className="w-3.5 h-3.5" /> Public Website Preview
          </button>
          <button
            onClick={() => setActiveTab("STAFF_CRM")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "STAFF_CRM"
                ? "bg-slate-800 text-emerald-400 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" /> Staff CRM Inbox ({leads.length})
          </button>
        </div>
      </div>

      {convertSuccessMsg && (
        <div className="p-4 bg-emerald-950/60 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span>{convertSuccessMsg}</span>
        </div>
      )}

      {/* VIEW 1: PUBLIC CLUB WEBSITE */}
      {activeTab === "PUBLIC_WEBSITE" && (
        <div className="space-y-6">
          {/* Hero Banner */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-emerald-950 via-slate-900 to-amber-950 border border-slate-800 p-8 sm:p-12">
            <div className="max-w-2xl space-y-4">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5" /> Premier Tennis & Cricket Destination
              </span>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                Welcome to The Champions Club
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Step onto ITF-grade Plexicushion tennis courts, European red clay, or test your batting
                against our robotic Bola cricket machine. Experience world-class post-match dining at our clubhouse.
              </p>
              <div className="pt-2 flex flex-wrap gap-4">
                <a
                  href="#book-trial"
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-950"
                >
                  Book a Trial Session
                </a>
                <a
                  href="/memberships"
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-950"
                >
                  Buy Membership Online →
                </a>
              </div>
            </div>
          </div>

          {/* Membership Plans Section */}
          <div id="membership-plans" className="space-y-4">
            <div className="text-center max-w-lg mx-auto">
              <h3 className="text-lg font-bold text-white">Transparent Membership Plans</h3>
              <p className="text-xs text-slate-400 mt-1">
                Choose the plan that fits your athletic routine. No hidden fees.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((p) => {
                const isGold = p.tier === "GOLD";
                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-6 flex flex-col justify-between relative transition ${
                      isGold
                        ? "bg-slate-900 border-amber-500 shadow-xl shadow-amber-950/20"
                        : "bg-slate-900 border-slate-800"
                    }`}
                  >
                    {isGold && (
                      <span className="absolute -top-3 right-6 text-[10px] font-extrabold px-3 py-0.5 rounded-full bg-amber-500 text-slate-950 uppercase tracking-wider">
                        Most Popular
                      </span>
                    )}

                    <div>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded uppercase ${
                          isGold
                            ? "bg-amber-500/20 text-amber-400"
                            : p.tier === "SILVER"
                            ? "bg-slate-700 text-slate-300"
                            : "bg-sky-500/20 text-sky-400"
                        }`}
                      >
                        {p.tier} TIER
                      </span>
                      <h4 className="text-lg font-bold text-white mt-2">{p.name}</h4>
                      <p className="text-2xl font-extrabold text-white mt-2">
                        {formatCurrency(p.monthlyFee)}
                        <span className="text-xs text-slate-400 font-normal"> / month</span>
                      </p>

                      <div className="mt-4 space-y-2 border-t border-slate-800 pt-4 text-xs text-slate-300">
                        {p.perks.map((perk: string, i: number) => (
                          <div key={i} className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            <span>{perk}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-2">
                      <a
                        href={`/memberships?tier=${p.tier}`}
                        className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs text-center transition shadow-md shadow-emerald-950"
                      >
                        Buy {p.name} Online
                      </a>
                      <a
                        href="#book-trial"
                        onClick={() =>
                          setVisitorForm({
                            ...visitorForm,
                            interest: `${p.name} Membership Inquiry`,
                          })
                        }
                        className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-xl text-[11px] font-semibold text-center transition"
                      >
                        Inquire About Trial
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Real-time What's Free This Week & Trial Booking Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4">
            {/* Live Court Availability Preview */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Live Court Status Today</h3>
                  <p className="text-xs text-slate-400">
                    Real-time court availability for visitors.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {courts.map((court) => (
                  <div
                    key={court.id}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">{court.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {court.sport} • {court.surface}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-emerald-400">
                      ₹{court.hourlyRate}/hr
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trial Booking Form */}
            <div id="book-trial" className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">Book a Trial Session on the Spot</h3>
                  <p className="text-xs text-slate-400">
                    Submit your interest. Our staff will follow up with slots and a quote.
                  </p>
                </div>
              </div>

              {trialSuccessMsg ? (
                <div className="py-12 text-center text-emerald-400 space-y-2">
                  <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400" />
                  <p className="text-sm font-bold">{trialSuccessMsg}</p>
                </div>
              ) : (
                <form onSubmit={handleVisitorSubmit} className="space-y-3 text-xs">
                  {trialErrorMsg && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{trialErrorMsg}</span>
                    </div>
                  )}
                  <div>
                    <label className="text-slate-400">Your Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Bajaj"
                      value={visitorForm.name}
                      onChange={(e) => setVisitorForm({ ...visitorForm, name: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400">Email Address</label>
                      <input
                        type="email"
                        required
                        placeholder="rahul@example.com"
                        value={visitorForm.email}
                        onChange={(e) => setVisitorForm({ ...visitorForm, email: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400">Phone</label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={visitorForm.phone}
                        onChange={(e) => setVisitorForm({ ...visitorForm, phone: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400">Interest</label>
                      <select
                        value={visitorForm.interest}
                        onChange={(e) =>
                          setVisitorForm({ ...visitorForm, interest: e.target.value })
                        }
                        className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      >
                        <option value="Tennis Trial & Gold Membership">Tennis Trial & Gold</option>
                        <option value="Box Cricket League Inquiry">Box Cricket League</option>
                        <option value="Junior Cricket Academy">Junior Cricket Academy</option>
                        <option value="Silver Standard Membership">Silver Standard</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-400">Requested Trial Date</label>
                      <input
                        type="date"
                        value={visitorForm.trialDate}
                        onChange={(e) =>
                          setVisitorForm({ ...visitorForm, trialDate: e.target.value })
                        }
                        className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400">Notes / Questions</label>
                    <textarea
                      rows={2}
                      placeholder="Any specific court or racket requirement..."
                      value={visitorForm.notes}
                      onChange={(e) => setVisitorForm({ ...visitorForm, notes: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition shadow-lg shadow-emerald-950 mt-2"
                  >
                    Submit Trial Inquiry
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: STAFF CRM PIPELINE */}
      {activeTab === "STAFF_CRM" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <span className="text-xs font-semibold text-emerald-400 uppercase">
                Front Desk Lead Queue
              </span>
              <h2 className="text-base font-bold text-white mt-0.5">
                Incoming Enquiries, Quotes & Conversion
              </h2>
            </div>
            <span className="text-xs text-slate-400">
              Total Enquiries: <span className="text-white font-bold">{leads.length}</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Lead / Visitor</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3">Interest</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Quote</th>
                  <th className="py-2.5 px-3 text-right">Staff Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {leads.map((lead) => {
                  const isConverted = lead.status === "CONVERTED";
                  return (
                    <tr key={lead.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3">
                        <span className="font-bold text-white">{lead.name}</span>
                        {lead.trialDate && (
                          <span className="text-[10px] text-slate-400 block">
                            Trial: {formatDate(lead.trialDate)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-300">
                        <div>{lead.phone}</div>
                        <div className="text-[10px] text-slate-500">{lead.email}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-200">{lead.interest}</span>
                        {lead.notes && (
                          <p className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                            {lead.notes}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            lead.status === "CONVERTED"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : lead.status === "QUOTE_SENT"
                              ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                              : lead.status === "CONTACTED"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-emerald-400">
                        {lead.quoteAmount ? formatCurrency(lead.quoteAmount) : "-"}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {!isConverted ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setQuotingLead(lead);
                                setQuoteAmount(6000);
                              }}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-400 rounded-lg text-xs font-semibold transition"
                            >
                              Send Quote
                            </button>
                            <button
                              onClick={() => setConvertingLead(lead)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow-md shadow-emerald-950"
                            >
                              Welcome Member
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Enrolled Member
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Staff Send Quote */}
      {quotingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Send Quote to {quotingLead.name}</h3>
              <button
                onClick={() => setQuotingLead(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400">Quote Amount (₹)</label>
                <input
                  type="number"
                  value={quoteAmount}
                  onChange={(e) => setQuoteAmount(Number(e.target.value))}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="text-slate-400">Proposal / Quote Note</label>
                <textarea
                  rows={3}
                  placeholder="Includes 3-month Gold all-access tennis pass + 2 private coaching clinics."
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setQuotingLead(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSendQuote}
                className="flex-1 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold"
              >
                Dispatch Quote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Staff Convert to Member */}
      {convertingLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">
                Welcome New Member: {convertingLead.name}
              </h3>
              <button
                onClick={() => setConvertingLead(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-400">
                Converting enquiry into an active club member. This will issue a unique membership
                number and write the initial membership fee to the unified transaction ledger.
              </p>

              <div>
                <label className="text-slate-400">Select Plan Tier</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {["GOLD", "SILVER", "JUNIOR"].map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setConvertTier(tier)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                        convertTier === tier
                          ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                          : "bg-slate-950 border-slate-800 text-slate-400"
                      }`}
                    >
                      {tier}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConvertingLead(null)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConvertLead}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
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
