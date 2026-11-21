"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  DollarSign,
  PieChart,
  Calendar,
  Users,
  FileText,
  CreditCard,
  Banknote,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Share2,
  Printer,
  Plus,
  ArrowUpRight,
  Briefcase,
  Building2,
  Clock,
  Sparkles,
} from "lucide-react";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { PaymentModal } from "../PaymentModal";

export function FinanceScene() {
  const [data, setData] = useState<any | null>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState<"OVERVIEW" | "INVOICES" | "HR_PAYROLL" | "LEDGER">("OVERVIEW");

  // Invoicing Modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState({
    clientName: "",
    clientEmail: "",
    clientType: "CORPORATE",
    amount: 50000,
    description: "Corporate box cricket weekend league & catering package",
  });

  // Settling Invoice Modal
  const [settlingInvoice, setSettlingInvoice] = useState<any | null>(null);
  const [shareSummaryOpen, setShareSummaryOpen] = useState(false);

  // Fetch Data
  const fetchData = async () => {
    try {
      const [financeRes, leavesRes] = await Promise.all([
        fetch("/api/finance/analytics"),
        fetch("/api/hr/leaves"),
      ]);

      const fData = await financeRes.json();
      const lData = await leavesRes.json();

      if (fData.success) setData(fData);
      if (lData.success) setLeaves(lData.leaves);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Polling every 4 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  // Leave Approval Action
  const handleLeaveDecision = async (leaveId: string, status: "APPROVED" | "REJECTED") => {
    try {
      const res = await fetch("/api/hr/leaves", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveId, status }),
      });
      const resData = await res.json();
      if (resData.success) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create Invoice
  const handleCreateInvoice = async () => {
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invoiceForm),
      });
      const resData = await res.json();
      if (resData.success) {
        setShowInvoiceModal(false);
        setInvoiceForm({
          clientName: "",
          clientEmail: "",
          clientType: "CORPORATE",
          amount: 50000,
          description: "",
        });
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !data) {
    return (
      <div className="py-20 text-center text-slate-400">
        Aggregating financial ledger, HR shifts, and revenue streams...
      </div>
    );
  }

  const {
    summary,
    categoryBreakdown,
    paymentMethodBreakdown,
    dailyTrend,
    staff,
    invoices,
    recentTransactions,
  } = data;

  const totalCatRevenue = Object.values(categoryBreakdown).reduce(
    (a: any, b: any) => a + b,
    0
  ) as number;
  const totalPayRevenue = Object.values(paymentMethodBreakdown).reduce(
    (a: any, b: any) => a + b,
    0
  ) as number;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-white">Scene 6: Owner's Financial & HR Aggregator</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            "How much did we earn, from where, and what do we owe?" All revenue unified from courts, shop, and bar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShareSummaryOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
          >
            <Share2 className="w-3.5 h-3.5" /> Share Report
          </button>

          <button
            onClick={() => setShowInvoiceModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950"
          >
            <Plus className="w-4 h-4" /> Invoice Business Client
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex p-1 bg-slate-950 rounded-xl border border-slate-800 w-fit">
        {[
          { key: "OVERVIEW", label: "Financial P&L" },
          { key: "INVOICES", label: `Corporate Invoices (${invoices.length})` },
          { key: "HR_PAYROLL", label: `HR, Payroll & Leaves (${staff.length})` },
          { key: "LEDGER", label: "30-Day Unified Ledger" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key as any)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              subTab === t.key
                ? "bg-slate-800 text-emerald-400 shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & P&L */}
      {subTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* 6 Executive KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {/* Today */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Earned Today
              </span>
              <p className="text-xl font-extrabold text-white mt-1">
                {formatCurrency(summary.revenueToday)}
              </p>
              <p className="text-[10px] text-emerald-400 mt-0.5">Live real-time total</p>
            </div>

            {/* This Week */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                This Week (7d)
              </span>
              <p className="text-xl font-extrabold text-white mt-1">
                {formatCurrency(summary.revenueThisWeek)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Rolling 7-day volume</p>
            </div>

            {/* This Month (30d) */}
            <div className="p-4 bg-slate-900 border border-emerald-500/40 bg-emerald-950/10 rounded-2xl">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                Total Month (30d)
              </span>
              <p className="text-xl font-extrabold text-emerald-400 mt-1">
                {formatCurrency(summary.revenueThisMonth)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">All club operations</p>
            </div>

            {/* Payroll */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Monthly Payroll
              </span>
              <p className="text-xl font-extrabold text-rose-400 mt-1">
                {formatCurrency(summary.totalEstimatedMonthlyPayroll)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">{staff.length} staff salaries</p>
            </div>

            {/* Tax */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                GST / Tax Provision
              </span>
              <p className="text-xl font-extrabold text-amber-400 mt-1">
                {formatCurrency(summary.estimatedTax)}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Estimated club tax</p>
            </div>

            {/* Net Profit */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Net Profit
              </span>
              <p className="text-xl font-extrabold text-white mt-1">
                {formatCurrency(summary.netProfit)}
              </p>
              <p className="text-[10px] text-emerald-400 mt-0.5">After payroll & taxes</p>
            </div>
          </div>

          {/* Revenue Breakdown by Source & Payment Channel */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Where did money come from? */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Where did money come from? (By Category)
                </h3>
                <span className="text-xs font-mono text-emerald-400">30-Day Totals</span>
              </div>

              <div className="space-y-3">
                {[
                  { name: "Court Bookings", key: "COURT", color: "bg-emerald-500", text: "text-emerald-400" },
                  { name: "Pro Gear Shop", key: "SHOP", color: "bg-amber-500", text: "text-amber-400" },
                  { name: "Bar & Cafeteria", key: "BAR", color: "bg-sky-500", text: "text-sky-400" },
                  { name: "Membership Fees", key: "MEMBERSHIP", color: "bg-purple-500", text: "text-purple-400" },
                  { name: "Corporate Client Invoices", key: "CORPORATE", color: "bg-teal-500", text: "text-teal-400" },
                ].map((item) => {
                  const amt = categoryBreakdown[item.key] || 0;
                  const pct = totalCatRevenue > 0 ? ((amt / totalCatRevenue) * 100).toFixed(1) : "0";

                  return (
                    <div key={item.key} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-300">{item.name}</span>
                        <div className="space-x-2">
                          <span className={`font-mono font-bold ${item.text}`}>
                            {formatCurrency(amt)}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">({pct}%)</span>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${item.color} rounded-full transition-all duration-500`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* How did money arrive? */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  How did money arrive? (By Payment Method)
                </h3>
                <span className="text-xs font-mono text-emerald-400">Cash vs Card vs UPI</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    method: "UPI",
                    icon: QrCode,
                    color: "text-emerald-400",
                    border: "border-emerald-500/40",
                    bg: "bg-emerald-950/20",
                  },
                  {
                    method: "CARD",
                    icon: CreditCard,
                    color: "text-amber-400",
                    border: "border-amber-500/40",
                    bg: "bg-amber-950/20",
                  },
                  {
                    method: "CASH",
                    icon: Banknote,
                    color: "text-sky-400",
                    border: "border-sky-500/40",
                    bg: "bg-sky-950/20",
                  },
                ].map(({ method, icon: Icon, color, border, bg }) => {
                  const amt = paymentMethodBreakdown[method] || 0;
                  const pct = totalPayRevenue > 0 ? ((amt / totalPayRevenue) * 100).toFixed(1) : "0";

                  return (
                    <div
                      key={method}
                      className={`p-4 rounded-xl border ${border} ${bg} text-center space-y-1.5`}
                    >
                      <Icon className={`w-6 h-6 mx-auto ${color}`} />
                      <p className="text-xs font-bold text-slate-300">{method}</p>
                      <p className={`text-base font-extrabold ${color} font-mono`}>
                        {formatCurrency(amt)}
                      </p>
                      <span className="text-[10px] text-slate-400">{pct}% of total</span>
                    </div>
                  );
                })}
              </div>

              {/* Outstanding Invoices Banner */}
              <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400">Pending Corporate Receivables (What we owe/are owed):</span>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Uncollected business invoices awaiting wire settlement
                  </p>
                </div>
                <span className="text-base font-bold text-rose-400 font-mono">
                  {formatCurrency(summary.pendingInvoicesTotal)}
                </span>
              </div>
            </div>
          </div>

          {/* 30-Day Historical Trend Bar Visualizer */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                30-Day Historical Revenue Trajectory
              </h3>
              <span className="text-xs text-slate-400">Daily Ledger Volume</span>
            </div>

            <div className="h-32 flex items-end gap-1.5 pt-4 overflow-x-auto pb-2">
              {dailyTrend.map((d: any, idx: number) => {
                const maxAmount = Math.max(...dailyTrend.map((t: any) => t.amount), 1);
                const heightPct = Math.max(10, (d.amount / maxAmount) * 100);

                return (
                  <div
                    key={d.date}
                    className="flex-1 min-w-[20px] flex flex-col items-center gap-1 group relative"
                  >
                    {/* Tooltip on hover */}
                    <div className="opacity-0 group-hover:opacity-100 transition absolute -top-10 z-10 bg-slate-950 text-white border border-slate-700 px-2 py-1 rounded text-[10px] whitespace-nowrap pointer-events-none">
                      {formatDate(d.date)}: {formatCurrency(d.amount)} ({d.count} txns)
                    </div>

                    <div
                      className="w-full bg-emerald-500/80 group-hover:bg-emerald-400 rounded-t transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[9px] text-slate-500 font-mono">
                      {d.date.split("-")[2]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CORPORATE CLIENT INVOICES */}
      {subTab === "INVOICES" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800">
            <div>
              <span className="text-xs font-semibold text-emerald-400 uppercase">B2B Accounts</span>
              <h2 className="text-base font-bold text-white mt-0.5">
                Corporate Client & Tournament Invoicing
              </h2>
            </div>
            <button
              onClick={() => setShowInvoiceModal(true)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Invoice
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Client</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Due Date</th>
                  <th className="py-2.5 px-3">Total Amount</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {invoices.map((inv: any) => {
                  const isPaid = inv.status === "PAID";
                  return (
                    <tr key={inv.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono font-medium text-white">
                        {inv.invoiceNumber}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-white">{inv.clientName}</span>
                        <span className="text-[10px] text-slate-400 block">{inv.clientEmail}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs">{inv.description}</td>
                      <td className="py-3 px-3 font-mono text-slate-400">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-white">
                        {formatCurrency(inv.totalAmount)}
                        <span className="text-[10px] text-slate-500 block font-normal">
                          (GST: {formatCurrency(inv.taxAmount)})
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isPaid
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {!isPaid && (
                          <button
                            onClick={() => setSettlingInvoice(inv)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
                          >
                            Mark Paid
                          </button>
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

      {/* TAB 3: HR, PAYROLL & LEAVE APPROVAL */}
      {subTab === "HR_PAYROLL" && (
        <div className="space-y-6">
          {/* Leave Requests Queue */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-400" /> Pending Leave Approvals
            </h3>

            {leaves.length === 0 ? (
              <p className="text-xs text-slate-500 py-4">No pending leave requests.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2 px-3">Staff Member</th>
                      <th className="py-2 px-3">Role</th>
                      <th className="py-2 px-3">Leave Dates</th>
                      <th className="py-2 px-3">Reason</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {leaves.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-semibold text-white">{l.staff.name}</td>
                        <td className="py-2.5 px-3 text-slate-400">{l.staff.role}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">
                          {formatDate(l.startDate)} - {formatDate(l.endDate)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{l.reason}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              l.status === "APPROVED"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : l.status === "REJECTED"
                                ? "bg-rose-500/20 text-rose-400"
                                : "bg-amber-500/20 text-amber-300"
                            }`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {l.status === "PENDING" && (
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => handleLeaveDecision(l.id, "APPROVED")}
                                className="p-1 text-emerald-400 hover:bg-emerald-950/40 rounded"
                                title="Approve Leave"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleLeaveDecision(l.id, "REJECTED")}
                                className="p-1 text-rose-400 hover:bg-rose-950/40 rounded"
                                title="Reject Leave"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Staff Roster & Monthly Payroll */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Staff Roster & Payroll Schedule ({staff.length} Employees)
              </h3>
              <span className="font-mono text-xs font-bold text-rose-400">
                Monthly Payroll: {formatCurrency(summary.totalEstimatedMonthlyPayroll)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {staff.map((s: any) => (
                <div
                  key={s.id}
                  className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-white">{s.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {s.role}
                    </span>
                  </div>
                  <p className="text-slate-400 text-[11px]">{s.email} • {s.phone}</p>
                  <div className="pt-2 border-t border-slate-800/80 flex justify-between items-center font-mono">
                    <span className="text-slate-500">Fixed Monthly:</span>
                    <span className="font-bold text-white">
                      {formatCurrency(s.monthlySalary)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: UNIFIED HISTORICAL LEDGER */}
      {subTab === "LEDGER" && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800">
            <div>
              <span className="text-xs font-semibold text-emerald-400 uppercase">
                Consolidated General Ledger
              </span>
              <h2 className="text-base font-bold text-white mt-0.5">
                Every Rupee In One Place (Courts, Shop, Bar, Memberships)
              </h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Live Transactions: {recentTransactions.length}+
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3">Reference #</th>
                  <th className="py-2.5 px-3">Date & Time</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Party / Notes</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentTransactions.map((t: any) => (
                  <tr key={t.id} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono font-medium text-emerald-400">
                      {t.referenceNo}
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono">
                      {formatDate(t.createdAt)} {formatTime(t.createdAt)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-200">
                        {t.category}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-300">{t.type}</td>
                    <td className="py-3 px-3 text-slate-300 max-w-xs truncate">{t.notes}</td>
                    <td className="py-3 px-3 font-mono text-[10px] text-slate-400">
                      {t.paymentMethod}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      {formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create Corporate Invoice */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-white">Generate Client Invoice</h3>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400">Client / Organization Name</label>
                <input
                  type="text"
                  placeholder="e.g. Wipro Sports League"
                  value={invoiceForm.clientName}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, clientName: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="text-slate-400">Billing Email</label>
                <input
                  type="email"
                  placeholder="accounts@wipro.com"
                  value={invoiceForm.clientEmail}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, clientEmail: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="text-slate-400">Base Amount (₹, ex-GST)</label>
                <input
                  type="number"
                  value={invoiceForm.amount}
                  onChange={(e) =>
                    setInvoiceForm({ ...invoiceForm, amount: Number(e.target.value) })
                  }
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-slate-400">Description</label>
                <textarea
                  rows={2}
                  value={invoiceForm.description}
                  onChange={(e) =>
                    setInvoiceForm({ ...invoiceForm, description: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex justify-between text-xs">
                <span className="text-slate-400">Total with 18% GST:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {formatCurrency(invoiceForm.amount * 1.18)}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="flex-1 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateInvoice}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
              >
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settle Invoice via PaymentModal */}
      {settlingInvoice && (
        <PaymentModal
          isOpen={!!settlingInvoice}
          onClose={() => setSettlingInvoice(null)}
          amount={settlingInvoice.totalAmount}
          title={`Corporate Settlement - ${settlingInvoice.invoiceNumber}`}
          notes={`Invoice payment for ${settlingInvoice.clientName}`}
          type="CORPORATE_INVOICE"
          category="CORPORATE"
          onSuccess={async (txn) => {
            await fetch("/api/invoices", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                invoiceId: settlingInvoice.id,
                paymentMethod: txn.paymentMethod,
              }),
            });
            fetchData();
            setSettlingInvoice(null);
          }}
        />
      )}

      {/* Share / Print Financial Briefing Modal */}
      {shareSummaryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white">The Champions Club - Executive Brief</h3>
                <p className="text-xs text-slate-400">30-Day Financial & Operational Summary</p>
              </div>
              <button
                onClick={() => setShareSummaryOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs font-mono">
              <p className="text-emerald-400 font-bold">TOTAL REVENUE (30D): {formatCurrency(summary.revenueThisMonth)}</p>
              <p className="text-slate-300">├── Courts: {formatCurrency(categoryBreakdown.COURT || 0)}</p>
              <p className="text-slate-300">├── Pro Shop: {formatCurrency(categoryBreakdown.SHOP || 0)}</p>
              <p className="text-slate-300">├── Bar & Café: {formatCurrency(categoryBreakdown.BAR || 0)}</p>
              <p className="text-slate-300">├── Memberships: {formatCurrency(categoryBreakdown.MEMBERSHIP || 0)}</p>
              <p className="text-slate-300">└── Corporate: {formatCurrency(categoryBreakdown.CORPORATE || 0)}</p>
              <div className="pt-2 border-t border-slate-800">
                <p className="text-rose-400">PAYROLL OBLIGATION: {formatCurrency(summary.totalEstimatedMonthlyPayroll)}</p>
                <p className="text-amber-400">TAX PROVISION: {formatCurrency(summary.estimatedTax)}</p>
                <p className="text-white font-bold pt-1">ESTIMATED NET PROFIT: {formatCurrency(summary.netProfit)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" /> Print / Save PDF
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `The Champions Club 30-Day Executive Summary:\nRevenue: ${formatCurrency(summary.revenueThisMonth)}\nNet Profit: ${formatCurrency(summary.netProfit)}`
                  );
                  alert("Executive brief copied to clipboard!");
                  setShareSummaryOpen(false);
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
              >
                Copy Brief to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
