"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  X,
  AlertTriangle,
} from "lucide-react";
import { validatePasswordStrength, PasswordCriterion } from "@/lib/password-validator";
import { useAuth } from "@/contexts/AuthContext";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { changePassword } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync native dialog with isOpen state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
      // Reset form on open
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrorMsg(null);
      setSuccessMsg(null);
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Handle escape & light dismiss (clicking on backdrop)
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  const validation = validatePasswordStrength(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword) {
      setErrorMsg("Please enter your current password.");
      return;
    }

    if (!validation.isValid) {
      setErrorMsg(validation.errorMessage || "New password does not meet security requirements.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("New password and confirmation do not match.");
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMsg("New password cannot be identical to your current password.");
      return;
    }

    setIsSubmitting(true);
    const result = await changePassword(currentPassword, newPassword, confirmPassword);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMsg(result.message || "Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setErrorMsg(result.error || "Failed to update password.");
    }
  };

  if (!isOpen) return null;

  const strengthColor =
    validation.score <= 1
      ? "bg-rose-500"
      : validation.score === 2
      ? "bg-amber-500"
      : validation.score === 3
      ? "bg-teal-500"
      : "bg-emerald-500";

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 p-0 bg-transparent backdrop:bg-slate-950/80 backdrop:backdrop-blur-sm fixed inset-0 flex items-center justify-center z-50 w-full h-full border-none max-w-none max-h-none overflow-y-auto"
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-slate-100 my-auto mx-4 animate-in fade-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/20 to-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Update Password</h2>
              <p className="text-xs text-slate-400">Change your Champions Club account credentials</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl flex items-start gap-2.5 text-xs text-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Current Password */}
          <div>
            <label
              htmlFor="current-password-input"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Current Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                id="current-password-input"
                name="currentPassword"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                aria-label={showCurrent ? "Hide current password" : "Show current password"}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="new-password-input"
                className="block text-xs font-semibold text-slate-300"
              >
                New Password
              </label>
              {newPassword && (
                <span className="text-[11px] font-mono text-slate-400">
                  Strength:{" "}
                  <span
                    className={
                      validation.score >= 3
                        ? "text-emerald-400 font-bold"
                        : validation.score === 2
                        ? "text-amber-400"
                        : "text-rose-400"
                    }
                  >
                    {validation.strengthLabel}
                  </span>
                </span>
              )}
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                id="new-password-input"
                name="newPassword"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters with upper, lower, & number"
                className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? "Hide new password" : "Show new password"}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength Meter Bar */}
            {newPassword && (
              <div className="mt-2 space-y-1.5">
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden flex gap-1">
                  {[0, 1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`h-full flex-1 transition-all duration-300 ${
                        validation.score > step ? strengthColor : "bg-slate-800"
                      }`}
                    />
                  ))}
                </div>

                {/* Criteria Checklist */}
                <div className="grid grid-cols-2 gap-1 pt-1">
                  {validation.criteria.map((c: PasswordCriterion) => (
                    <div
                      key={c.id}
                      className={`flex items-center gap-1.5 text-[10px] ${
                        c.met ? "text-emerald-400" : "text-slate-500"
                      }`}
                    >
                      {c.met ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <div className="w-3 h-3 rounded-full border border-slate-700 shrink-0" />
                      )}
                      <span>{c.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label
              htmlFor="confirm-password-input"
              className="block text-xs font-semibold text-slate-300 mb-1"
            >
              Confirm New Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                id="confirm-password-input"
                name="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                className="w-full pl-9 pr-10 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? "Hide confirmation password" : "Show confirmation password"}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && (
              <p
                className={`text-[11px] mt-1 flex items-center gap-1 ${
                  passwordsMatch ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {passwordsMatch ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> Passwords match
                  </>
                ) : (
                  <>
                    <XCircle className="w-3 h-3" /> Passwords do not match
                  </>
                )}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !validation.isValid || !passwordsMatch}
              className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs transition shadow-lg shadow-emerald-950/50 flex items-center gap-1.5"
            >
              {isSubmitting ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
