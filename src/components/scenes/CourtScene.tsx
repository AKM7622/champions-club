"use client";

import React, { useState, useEffect } from "react";
import {
  Trophy,
  Clock,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Users,
  ShieldAlert,
  Flame,
  XCircle,
  Plus,
  RefreshCw,
  Phone,
  User,
  Zap,
  Pencil,
  Trash2,
} from "lucide-react";
import { formatCurrency, formatTime, formatDate } from "@/lib/utils";
import { PaymentModal } from "../PaymentModal";
import { setHours, setMinutes, format, addMonths } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";

interface CourtSceneProps {
  pollIntervalMs?: number;
  onDataLoaded?: (data: { members: any[]; selectedMemberId: string }) => void;
  memberSelectRef?: React.MutableRefObject<((memberId: string) => void) | null>;
}

export function CourtScene({
  pollIntervalMs = 3500,
  onDataLoaded,
  memberSelectRef,
}: CourtSceneProps = {}) {
  const { user } = useAuth();
  const canManageCourts = user?.role === "OWNER" || user?.role === "COACH";

  const [courts, setCourts] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);

  const todayStr = format(new Date(), "yyyy-MM-dd");
  const maxBookingDateStr = format(addMonths(new Date(), 1), "yyyy-MM-dd");

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [loading, setLoading] = useState(true);

  // Booking Modal
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<any | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("18:00");
  const [bookingMode, setBookingMode] = useState<"MEMBER" | "WALK_IN">("MEMBER");
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [isSocialPlay, setIsSocialPlay] = useState(false);
  const [socialPlayersCount, setSocialPlayersCount] = useState(4);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Court Management Modal (Add/Edit)
  const [isCourtModalOpen, setIsCourtModalOpen] = useState(false);
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null);
  const [courtForm, setCourtForm] = useState({
    name: "",
    sport: "TENNIS",
    surface: "Plexicushion Synthetic (Floodlit)",
    hourlyRate: 800,
    description: "",
    isAvailable: true,
  });
  const [courtModalError, setCourtModalError] = useState<string | null>(null);
  const [isCourtSubmitting, setIsCourtSubmitting] = useState(false);

  // Payment Modal
  const [pendingPaymentBooking, setPendingPaymentBooking] = useState<any | null>(null);

  // Fetch Courts, Bookings & Members
  const fetchData = async () => {
    try {
      const [courtsRes, bookingsRes, membersRes] = await Promise.all([
        fetch("/api/courts"),
        fetch(`/api/bookings?date=${selectedDate}`),
        fetch("/api/members"),
      ]);
      const courtsData = await courtsRes.json();
      const bookingsData = await bookingsRes.json();
      const membersData = await membersRes.json();

      if (courtsData.success) setCourts(courtsData.courts);
      if (bookingsData.success) setBookings(bookingsData.bookings);
      if (membersData.success) {
        const memList = membersData.members || [];
        setMembers(memList);
        setSelectedMemberId((prev) => {
          if (prev && memList.some((m: any) => m.id === prev)) {
            return prev;
          }
          return memList.length > 0 ? memList[0].id : "";
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Expose member select handler for test harnesses
  useEffect(() => {
    if (memberSelectRef) memberSelectRef.current = (mId: string) => setSelectedMemberId(mId);
  }, [memberSelectRef]);

  // Hook for observability
  useEffect(() => {
    onDataLoaded?.({ members, selectedMemberId });
  }, [members, selectedMemberId]);

  // Real-time polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollIntervalMs);
    return () => clearInterval(interval);
  }, [selectedDate, pollIntervalMs]);

  // Generate 30-min sliding time slots from 06:00 to 22:00
  const timeSlots: string[] = [];
  for (let hour = 6; hour <= 21; hour++) {
    timeSlots.push(`${String(hour).padStart(2, "0")}:00`);
    timeSlots.push(`${String(hour).padStart(2, "0")}:30`);
  }

  // Open Booking Modal for a court
  const handleOpenBook = (court: any, slot?: string) => {
    setSelectedCourt(court);
    if (slot) {
      setSelectedTimeSlot(slot);
    } else {
      // Find the first future slot for today, or default to 18:00
      const now = new Date();
      if (selectedDate === todayStr) {
        const firstValid = timeSlots.find((s) => {
          const [h, m] = s.split(":").map(Number);
          const sTime = setMinutes(setHours(new Date(), h), m);
          return sTime > now;
        });
        setSelectedTimeSlot(firstValid || "18:00");
      } else {
        setSelectedTimeSlot("18:00");
      }
    }
    setBookingError(null);
    setIsBookingModalOpen(true);
  };

  // Submit Booking
  const handleConfirmBooking = async () => {
    if (!selectedCourt) return;
    setIsSubmitting(true);
    setBookingError(null);

    // Date validations
    if (selectedDate < todayStr) {
      setBookingError("Cannot book court for past dates.");
      setIsSubmitting(false);
      return;
    }

    if (selectedDate > maxBookingDateStr) {
      setBookingError("Court bookings can only be made up to 1 month in advance.");
      setIsSubmitting(false);
      return;
    }

    const [hours, minutes] = selectedTimeSlot.split(":").map(Number);
    const dateObj = new Date(selectedDate);
    const startTime = setMinutes(setHours(dateObj, hours), minutes);

    if (selectedDate === todayStr && startTime.getTime() < Date.now() - 60000) {
      setBookingError("Cannot book a court slot in the past.");
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        courtId: selectedCourt.id,
        startTimeStr: startTime.toISOString(),
        memberId: bookingMode === "MEMBER" ? selectedMemberId : null,
        guestName: bookingMode === "WALK_IN" ? walkInName : null,
        guestPhone: bookingMode === "WALK_IN" ? walkInPhone : null,
        isSocialPlay,
        socialPlayersCount: isSocialPlay ? socialPlayersCount : 1,
      };

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create booking");
      }

      setIsBookingModalOpen(false);
      fetchData();

      // If requires payment, launch Pay Modal
      if (data.requiresPayment) {
        setPendingPaymentBooking(data.booking);
      }
    } catch (err: any) {
      setBookingError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Booking
  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    try {
      const res = await fetch("/api/bookings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, action: "CANCEL" }),
      });
      const data = await res.json();
      if (data.success) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open Add Court Modal
  const handleOpenAddCourt = () => {
    setEditingCourtId(null);
    setCourtForm({
      name: "",
      sport: "TENNIS",
      surface: "Plexicushion Synthetic (Floodlit)",
      hourlyRate: 800,
      description: "",
      isAvailable: true,
    });
    setCourtModalError(null);
    setIsCourtModalOpen(true);
  };

  // Open Edit Court Modal
  const handleOpenEditCourt = (court: any) => {
    setEditingCourtId(court.id);
    setCourtForm({
      name: court.name,
      sport: court.sport,
      surface: court.surface,
      hourlyRate: court.hourlyRate,
      description: court.description || "",
      isAvailable: court.isAvailable ?? true,
    });
    setCourtModalError(null);
    setIsCourtModalOpen(true);
  };

  // Save Court (Create or Update)
  const handleSaveCourt = async () => {
    setIsCourtSubmitting(true);
    setCourtModalError(null);

    try {
      const method = editingCourtId ? "PUT" : "POST";
      const payload = editingCourtId ? { id: editingCourtId, ...courtForm } : courtForm;

      const res = await fetch("/api/courts", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save court");
      }

      setIsCourtModalOpen(false);
      fetchData();
    } catch (err: any) {
      setCourtModalError(err.message);
    } finally {
      setIsCourtSubmitting(false);
    }
  };

  // Delete Court
  const handleDeleteCourt = async (courtId: string, courtName: string) => {
    if (!confirm(`Are you sure you want to delete court "${courtName}"? This cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/courts?id=${encodeURIComponent(courtId)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Failed to delete court");
        return;
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || "Network error while deleting court");
    }
  };

  const selectedMemberObj = members.find((m) => m.id === selectedMemberId);
  const isToday = selectedDate === todayStr;
  const now = new Date();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 p-5 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Trophy className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-bold text-white">Scene 2: Court Booking Engine</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            60-min sessions • 30-min sliding slots • 2/day member cap • Friday Social Play • Advance window up to 1 month.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            min={todayStr}
            max={maxBookingDateStr}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
          />
          {canManageCourts && (
            <button
              onClick={handleOpenAddCourt}
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-semibold rounded-xl transition text-sm shadow"
              title="Add a new sports court"
            >
              <Plus className="w-4 h-4" /> Add Court
            </button>
          )}
          <button
            onClick={() => {
              if (courts.length > 0) handleOpenBook(courts[0]);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition text-sm shadow-lg shadow-emerald-950"
          >
            <Plus className="w-4 h-4" /> Book a Court
          </button>
        </div>
      </div>

      {/* Courts Availability Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {courts.map((court) => {
          const courtBookingsToday = bookings.filter(
            (b) => b.courtId === court.id && b.status !== "CANCELLED"
          );

          return (
            <div
              key={court.id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-700 transition"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wider uppercase ${
                      court.sport === "TENNIS"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-amber-500/20 text-amber-400"
                    }`}
                  >
                    {court.sport}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-300">
                      {formatCurrency(court.hourlyRate)}/hr
                    </span>
                    {canManageCourts && (
                      <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
                        <button
                          onClick={() => handleOpenEditCourt(court)}
                          className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition"
                          title="Edit Court"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteCourt(court.id, court.name)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                          title="Delete Court"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <h3 className="font-bold text-white text-sm line-clamp-1">{court.name}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{court.surface}</p>

                <div className="mt-3 py-1 px-2.5 bg-slate-950/60 rounded-lg border border-slate-800/80 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Booked Today:</span>
                  <span className="font-semibold text-white">
                    {courtBookingsToday.length} Session(s)
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleOpenBook(court)}
                className="mt-4 w-full py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 rounded-xl text-xs font-semibold transition"
              >
                Quick Book This Court
              </button>
            </div>
          );
        })}
      </div>

      {/* Sliding Half-Hour Schedule Timeline Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Court Schedule & Conflict Shield ({formatDate(selectedDate)})
            </h2>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Free Slot
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Booked (Locked)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Friday Social Play
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-600" /> Past (Unavailable)
            </span>
          </div>
        </div>

        {/* Schedule Grid */}
        <div className="space-y-4">
          {courts.map((court) => {
            const courtBookings = bookings.filter(
              (b) => b.courtId === court.id && b.status !== "CANCELLED"
            );

            return (
              <div
                key={court.id}
                className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{court.name}</span>
                    <span className="text-[10px] text-slate-400">({court.surface})</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono">
                    ₹{court.hourlyRate}/hr
                  </span>
                </div>

                {/* 30-min Sliding Time Slot Badges */}
                <div className="flex gap-1.5 overflow-x-auto pb-2 pt-1 scrollbar-thin">
                  {timeSlots.map((slot) => {
                    const [slotH, slotM] = slot.split(":").map(Number);
                    const slotStart = setMinutes(
                      setHours(new Date(selectedDate), slotH),
                      slotM
                    );
                    const slotEnd = setMinutes(
                      setHours(new Date(selectedDate), slotH + 1),
                      slotM
                    );

                    // Past slot check: if today and slot has already ended or started
                    const isPast = isToday && slotStart < now;

                    // Check if this slot overlaps with any active booking
                    const activeBooking = courtBookings.find((b) => {
                      const bStart = new Date(b.startTime);
                      const bEnd = new Date(b.endTime);
                      return slotStart < bEnd && slotEnd > bStart;
                    });

                    if (activeBooking) {
                      const isSocial = activeBooking.isSocialPlay;
                      return (
                        <div
                          key={slot}
                          title={`Booked: ${
                            activeBooking.member?.name || activeBooking.guestName
                          } (${formatTime(activeBooking.startTime)} - ${formatTime(
                            activeBooking.endTime
                          )})`}
                          className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono flex flex-col items-center min-w-[70px] ${
                            isSocial
                              ? "bg-amber-950/40 border-amber-600/60 text-amber-300"
                              : "bg-rose-950/40 border-rose-800/60 text-rose-300"
                          }`}
                        >
                          <span className="font-bold">{slot}</span>
                          <span className="text-[9px] truncate max-w-[60px] opacity-80">
                            {isSocial
                              ? "Social"
                              : activeBooking.member?.name?.split(" ")[0] || "Walk-in"}
                          </span>
                        </div>
                      );
                    }

                    if (isPast) {
                      return (
                        <div
                          key={slot}
                          title={`Past Slot: ${slot} (Not available for reservation)`}
                          className="flex-shrink-0 px-2.5 py-1.5 rounded-lg border border-slate-900 bg-slate-950/60 text-[11px] font-mono text-slate-600 flex flex-col items-center min-w-[70px] cursor-not-allowed opacity-50"
                        >
                          <span className="font-semibold line-through">{slot}</span>
                          <span className="text-[9px] text-slate-600">PAST</span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={slot}
                        onClick={() => handleOpenBook(court, slot)}
                        className="flex-shrink-0 px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-emerald-500 bg-slate-900 hover:bg-emerald-950/30 text-[11px] font-mono text-slate-300 hover:text-emerald-400 flex flex-col items-center min-w-[70px] transition"
                      >
                        <span className="font-semibold">{slot}</span>
                        <span className="text-[9px] text-emerald-500">FREE</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirmed Bookings Table for Today */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3">
          Today's Scheduled Sessions ({bookings.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3">Time Window</th>
                <th className="py-2.5 px-3">Court</th>
                <th className="py-2.5 px-3">Player / Walk-In</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Rate / Discount</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No bookings found for this date.
                  </td>
                </tr>
              ) : (
                bookings.map((b) => {
                  const isPaid = b.paymentStatus === "PAID" || b.finalPrice === 0;
                  const isCancelled = b.status === "CANCELLED";

                  return (
                    <tr
                      key={b.id}
                      className={`hover:bg-slate-800/40 transition ${
                        isCancelled ? "opacity-50 line-through" : ""
                      }`}
                    >
                      <td className="py-3 px-3 font-mono font-medium text-white">
                        {formatTime(b.startTime)} - {formatTime(b.endTime)}
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-semibold">{b.court.name}</td>
                      <td className="py-3 px-3">
                        {b.member ? (
                          <div>
                            <span className="font-semibold text-white">{b.member.name}</span>
                            <span className="text-[10px] text-amber-400 ml-1.5 font-bold">
                              [{b.member.planTier}]
                            </span>
                          </div>
                        ) : (
                          <div>
                            <span className="text-slate-300">{b.guestName || "Walk-in"}</span>
                            {b.guestPhone && (
                              <span className="text-[10px] text-slate-500 block">
                                {b.guestPhone}
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {b.isSocialPlay ? (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px] font-bold">
                            Social ({b.socialPlayersCount}p)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Single Session (1h)</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-emerald-400">
                          {b.finalPrice === 0 ? "FREE" : formatCurrency(b.finalPrice)}
                        </span>
                        {b.discountAmount > 0 && (
                          <span className="text-[10px] text-slate-500 line-through ml-1.5">
                            {formatCurrency(b.basePrice)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        {isCancelled ? (
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]">
                            Cancelled
                          </span>
                        ) : isPaid ? (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold">
                            Confirmed & Paid
                          </span>
                        ) : (
                          <button
                            onClick={() => setPendingPaymentBooking(b)}
                            className="px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[10px] font-bold"
                          >
                            Pay Due
                          </button>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {!isCancelled && (
                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            className="text-slate-500 hover:text-rose-400 text-xs transition"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Modal */}
      {isBookingModalOpen && selectedCourt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase">
                  Reserve Court Slot
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">{selectedCourt.name}</h2>
              </div>
              <button
                onClick={() => setIsBookingModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Error Banner */}
            {bookingError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{bookingError}</span>
              </div>
            )}

            <div className="space-y-3">
              {/* Slot Time Picker */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Date (up to 1 month)</label>
                  <input
                    type="date"
                    value={selectedDate}
                    min={todayStr}
                    max={maxBookingDateStr}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">30-min Sliding Slot (60m duration)</label>
                  <select
                    value={selectedTimeSlot}
                    onChange={(e) => setSelectedTimeSlot(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  >
                    {timeSlots.map((ts) => {
                      const [h, m] = ts.split(":").map(Number);
                      const tsStart = setMinutes(setHours(new Date(selectedDate), h), m);
                      const isSlotPast = isToday && tsStart < now;
                      return (
                        <option key={ts} value={ts} disabled={isSlotPast}>
                          {ts} to {String(Number(ts.split(":")[0]) + 1).padStart(2, "0")}:{ts.split(":")[1]}
                          {isSlotPast ? " (Past Slot)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Player Type Selector */}
              <div>
                <label className="text-xs text-slate-400">Booking For</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setBookingMode("MEMBER")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                      bookingMode === "MEMBER"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Club Member (Plan Discount)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingMode("WALK_IN")}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition ${
                      bookingMode === "WALK_IN"
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-400"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                    }`}
                  >
                    Walk-in / Phone Guest
                  </button>
                </div>
              </div>

              {/* Member Picker or Walk-in Input */}
              {bookingMode === "MEMBER" ? (
                <div>
                  <label className="text-xs text-slate-400">Select Member</label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.memberNumber}) - {m.planTier} Tier
                      </option>
                    ))}
                  </select>
                  {selectedMemberObj && (
                    <p className="text-[11px] text-emerald-400 mt-1">
                      Plan Benefit: {selectedMemberObj.plan?.courtDiscountPercent ?? 0}% Court Discount
                      (Max 2/day limit applies).
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400">Guest Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh Saxena"
                      value={walkInName}
                      onChange={(e) => setWalkInName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Phone</label>
                    <input
                      type="text"
                      placeholder="+91 99999 88888"
                      value={walkInPhone}
                      onChange={(e) => setWalkInPhone(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                    />
                  </div>
                </div>
              )}

              {/* Friday Social Play Mode Option */}
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" /> Friday Social Play Mode
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Open court for multiple players to join and rotate games
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isSocialPlay}
                  onChange={(e) => setIsSocialPlay(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              {isSocialPlay && (
                <div>
                  <label className="text-xs text-slate-400">Player Capacity (Split Rate)</label>
                  <input
                    type="number"
                    min={2}
                    max={8}
                    value={socialPlayersCount}
                    onChange={(e) => setSocialPlayersCount(Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
              )}

              {/* Price Preview */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 flex justify-between items-center">
                <div>
                  <span className="text-xs text-slate-400">Total Slot Price:</span>
                  <p className="text-[11px] text-slate-500">
                    {bookingMode === "MEMBER" && selectedMemberObj?.planTier === "GOLD"
                      ? "Gold All-Access 100% Free Benefit"
                      : "Standard rate with plan discounts"}
                  </p>
                </div>
                <span className="text-lg font-bold text-emerald-400">
                  {bookingMode === "MEMBER" && selectedMemberObj?.planTier === "GOLD" && !isSocialPlay
                    ? "FREE (₹0)"
                    : isSocialPlay
                    ? formatCurrency(250 * socialPlayersCount)
                    : bookingMode === "MEMBER" && selectedMemberObj?.planTier === "SILVER"
                    ? formatCurrency(selectedCourt.hourlyRate * 0.5)
                    : bookingMode === "MEMBER" && selectedMemberObj?.planTier === "JUNIOR"
                    ? formatCurrency(selectedCourt.hourlyRate * 0.6)
                    : formatCurrency(selectedCourt.hourlyRate)}
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsBookingModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmBooking}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-950"
              >
                {isSubmitting ? "Locking Slot..." : "Confirm Reservation"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Court Modal */}
      {isCourtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs font-semibold text-emerald-400 uppercase">
                  Court Management
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  {editingCourtId ? "Edit Court Details" : "Add New Sports Court"}
                </h2>
              </div>
              <button
                onClick={() => setIsCourtModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {courtModalError && (
              <div className="p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{courtModalError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Court Name</label>
                <input
                  type="text"
                  placeholder="e.g. Centre Tennis Court 3"
                  value={courtForm.name}
                  onChange={(e) => setCourtForm({ ...courtForm, name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Sport Type</label>
                  <select
                    value={courtForm.sport}
                    onChange={(e) => setCourtForm({ ...courtForm, sport: e.target.value as any })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  >
                    <option value="TENNIS">TENNIS</option>
                    <option value="CRICKET">CRICKET</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">Base Hourly Rate (₹)</label>
                  <input
                    type="number"
                    min={100}
                    step={50}
                    value={courtForm.hourlyRate}
                    onChange={(e) => setCourtForm({ ...courtForm, hourlyRate: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">Surface Specification</label>
                <input
                  type="text"
                  placeholder="e.g. Plexicushion Synthetic (Floodlit) or AstroTurf"
                  value={courtForm.surface}
                  onChange={(e) => setCourtForm({ ...courtForm, surface: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Notes / Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Professional LED floodlights, tournament standard"
                  value={courtForm.description}
                  onChange={(e) => setCourtForm({ ...courtForm, description: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white"
                />
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">Court Available for Booking</p>
                  <p className="text-[11px] text-slate-400">When enabled, members can reserve slots on this court.</p>
                </div>
                <input
                  type="checkbox"
                  checked={courtForm.isAvailable}
                  onChange={(e) => setCourtForm({ ...courtForm, isAvailable: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCourtModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCourtSubmitting}
                onClick={handleSaveCourt}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-950"
              >
                {isCourtSubmitting ? "Saving Court..." : editingCourtId ? "Save Changes" : "Create Court"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay via Cash/Card/UPI Modal */}
      {pendingPaymentBooking && (
        <PaymentModal
          isOpen={!!pendingPaymentBooking}
          onClose={() => setPendingPaymentBooking(null)}
          amount={pendingPaymentBooking.finalPrice}
          title={`Court Booking: ${pendingPaymentBooking.court.name}`}
          notes={`Court session: ${formatTime(pendingPaymentBooking.startTime)} - ${formatTime(
            pendingPaymentBooking.endTime
          )}`}
          type="COURT_BOOKING"
          category="COURT"
          memberId={pendingPaymentBooking.memberId}
          memberName={
            pendingPaymentBooking.member?.name || pendingPaymentBooking.guestName || "Guest"
          }
          courtBookingId={pendingPaymentBooking.id}
          onSuccess={() => {
            fetchData();
            setPendingPaymentBooking(null);
          }}
        />
      )}
    </div>
  );
}
