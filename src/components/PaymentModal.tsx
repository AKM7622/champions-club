"use client";

import React, { useState } from "react";
import {
  Banknote,
  CreditCard,
  QrCode,
  CheckCircle2,
  Loader2,
  X,
  Receipt,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  amount: number;
  title: string;
  notes?: string;
  type: "COURT_BOOKING" | "SHOP_PURCHASE" | "BAR_BILL" | "MEMBERSHIP_FEE" | "CORPORATE_INVOICE";
  category: "COURT" | "SHOP" | "BAR" | "MEMBERSHIP" | "CORPORATE";
  memberId?: string;
  memberName?: string;
  courtBookingId?: string;
  shopOrderId?: string;
  barTabId?: string;
  onSuccess?: (transaction: any) => void;
  onProcessPayment?: (method: "UPI" | "CARD" | "CASH") => Promise<any>;
  successButtonText?: string;
  onFinish?: () => void;
}

export function PaymentModal({
  isOpen,
  onClose,
  amount,
  title,
  notes,
  type,
  category,
  memberId,
  memberName,
  courtBookingId,
  shopOrderId,
  barTabId,
  onSuccess,
  onProcessPayment,
  successButtonText,
  onFinish,
}: PaymentModalProps) {
  const [method, setMethod] = useState<"UPI" | "CARD" | "CASH">("UPI");
  const [cashTendered, setCashTendered] = useState<string>(String(amount));
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedTxn, setCompletedTxn] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handlePay = async () => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      // 1-second simulated confirmation gate as required by prompt
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (onProcessPayment) {
        const result = await onProcessPayment(method);
        const txn = result?.transaction || result;
        setCompletedTxn(txn);
        if (onSuccess) {
          onSuccess(txn);
        }
        return;
      }

      const payload = {
        type,
        category,
        amount,
        paymentMethod: method,
        memberId: memberId || null,
        notes: notes || `${title} paid by ${method}`,
        courtBookingId: courtBookingId || null,
        shopOrderId: shopOrderId || null,
        barTabId: barTabId || null,
      };

      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Payment recording failed");
      }

      setCompletedTxn(data.transaction);
      if (onSuccess) {
        onSuccess(data.transaction);
      }
    } catch (err: any) {
      console.error("Payment error:", err);
      setErrorMsg(err.message || "Failed to process payment");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFinish = () => {
    setCompletedTxn(null);
    if (onFinish) {
      onFinish();
    } else {
      onClose();
    }
  };

  const cashChange = Math.max(0, Number(cashTendered) - amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-500" />

        {/* Close Button */}
        {!isProcessing && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* State: Completed Receipt */}
        {completedTxn ? (
          <div className="py-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40">
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                <Sparkles className="w-3.5 h-3.5" /> Ledger Entry Confirmed
              </span>
              <h3 className="text-2xl font-bold text-white mt-2">
                {formatCurrency(completedTxn.amount)}
              </h3>
              <p className="text-sm text-slate-400 mt-1">Paid via {completedTxn.paymentMethod}</p>
            </div>

            <div className="bg-slate-800/80 rounded-xl p-4 text-left text-xs space-y-2 border border-slate-700 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Reference No:</span>
                <span className="text-emerald-400 font-semibold">{completedTxn.referenceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Category:</span>
                <span className="text-slate-200">{completedTxn.category}</span>
              </div>
              {memberName && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Member:</span>
                  <span className="text-slate-200">{memberName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Timestamp:</span>
                <span className="text-slate-200">
                  {new Date(completedTxn.createdAt).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <button
              onClick={handleFinish}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl transition shadow-lg shadow-emerald-900/30"
            >
              {successButtonText || "Done & Close"}
            </button>
          </div>
        ) : (
          /* State: Payment Form */
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 tracking-wide uppercase">
                <Receipt className="w-4 h-4" /> Point of Sale Settlement
              </div>
              <h2 className="text-xl font-bold text-white mt-1">{title}</h2>
              {memberName && (
                <p className="text-xs text-slate-400 mt-0.5">
                  Member: <span className="text-amber-400 font-medium">{memberName}</span>
                </p>
              )}
            </div>

            {/* Total Amount Badge */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400">Amount Due</p>
                <p className="text-3xl font-extrabold text-white tracking-tight">
                  {formatCurrency(amount)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs px-2.5 py-1 bg-slate-700 text-slate-300 rounded-md font-mono">
                  {category}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setMethod("UPI")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition ${
                  method === "UPI"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950"
                    : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
                }`}
              >
                <QrCode className="w-6 h-6 mb-1.5" />
                <span>UPI / QR</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod("CARD")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition ${
                  method === "CARD"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950"
                    : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
                }`}
              >
                <CreditCard className="w-6 h-6 mb-1.5" />
                <span>Card / POS</span>
              </button>

              <button
                type="button"
                onClick={() => setMethod("CASH")}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition ${
                  method === "CASH"
                    ? "bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-md shadow-emerald-950"
                    : "bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white"
                }`}
              >
                <Banknote className="w-6 h-6 mb-1.5" />
                <span>Cash</span>
              </button>
            </div>

            {/* Dynamic Method Panel */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 min-h-[140px] flex flex-col justify-center">
              {method === "UPI" && (
                <div className="text-center space-y-2">
                  <div className="inline-block p-2 bg-white rounded-lg shadow-md">
                    {/* Simulated SVG QR */}
                    <svg
                      className="w-24 h-24 text-slate-900"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3" y="3" width="7" height="7" rx="1" fill="currentColor" />
                      <rect x="14" y="3" width="7" height="7" rx="1" fill="currentColor" />
                      <rect x="3" y="14" width="7" height="7" rx="1" fill="currentColor" />
                      <path d="M14 14h2v2h-2z" fill="currentColor" />
                      <path d="M18 14h3v3h-3z" fill="currentColor" />
                      <path d="M14 18h3v3h-3z" fill="currentColor" />
                      <path d="M19 19h2v2h-2z" fill="currentColor" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-400">
                    Scan via GPay / PhonePe / Paytm / BHIM
                  </p>
                  <p className="text-[11px] font-mono text-emerald-400">
                    VPA: championsclub@hdfcbank
                  </p>
                </div>
              )}

              {method === "CARD" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Card Terminal: #POS-01</span>
                    <span className="text-emerald-400 font-medium">Ready for Tap / Dip</span>
                  </div>
                  <div className="p-3 bg-slate-900 border border-slate-700 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-5 bg-amber-500/20 border border-amber-500/40 rounded flex items-center justify-center text-[9px] font-bold text-amber-400">
                        CHIP
                      </div>
                      <span className="font-mono text-sm text-slate-300">•••• •••• •••• 8824</span>
                    </div>
                    <span className="text-xs text-slate-400">Visa / MC</span>
                  </div>
                </div>
              )}

              {method === "CASH" && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Cash Received (₹):</span>
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-28 px-2 py-1 bg-slate-900 border border-slate-700 rounded text-right text-sm font-semibold text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-800">
                    <span className="text-slate-400">Change Due:</span>
                    <span
                      className={`font-semibold ${
                        cashChange >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatCurrency(cashChange)}
                    </span>
                  </div>
                  <div className="flex gap-1.5 pt-1">
                    {[amount, Math.ceil(amount / 500) * 500, Math.ceil(amount / 500) * 500 + 500]
                      .filter((v, idx, arr) => arr.indexOf(v) === idx)
                      .map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCashTendered(String(preset))}
                          className="flex-1 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                        >
                          ₹{preset}
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {errorMsg && (
              <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900 rounded-lg p-2 text-center">
                {errorMsg}
              </p>
            )}

            {/* Pay Button */}
            <button
              type="button"
              disabled={isProcessing || (method === "CASH" && Number(cashTendered) < amount)}
              onClick={handlePay}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Simulating Bank Confirmation (1s)...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span>
                    Pay {formatCurrency(amount)} via {method}
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
