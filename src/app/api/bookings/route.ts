import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { BookingStatus, PaymentStatus } from "@prisma/client";
import { PricingCalculator } from "@/lib/pricing-calculator";
import { startOfDay, endOfDay, addMinutes, addMonths } from "date-fns";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get("date");
    const courtId = searchParams.get("courtId");
    const memberId = searchParams.get("memberId");

    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const dayStart = startOfDay(targetDate);
    const dayEnd = endOfDay(targetDate);

    const where: any = {
      startTime: { gte: dayStart, lte: dayEnd },
    };
    if (courtId) where.courtId = courtId;
    if (memberId) where.memberId = memberId;

    const bookings = await prisma.courtBooking.findMany({
      where,
      orderBy: { startTime: "asc" },
      include: {
        court: true,
        member: {
          select: {
            id: true,
            name: true,
            memberNumber: true,
            planTier: true,
            phone: true,
          },
        },
        transaction: true,
      },
    });

    return NextResponse.json({ success: true, bookings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      courtId,
      memberId,
      guestName,
      guestPhone,
      startTimeStr, // ISO string or datetime
      isSocialPlay = false,
      socialPlayersCount = 1,
      notes,
    } = body;

    const startTimeRaw = startTimeStr || (body as any).startTime;

    if (!courtId || !startTimeRaw) {
      return NextResponse.json(
        { success: false, error: "Court ID and start time are required." },
        { status: 400 }
      );
    }

    const startTime = new Date(startTimeRaw);
    if (isNaN(startTime.getTime())) {
      return NextResponse.json(
        { success: false, error: "Invalid start time format provided." },
        { status: 400 }
      );
    }

    const endTime = addMinutes(startTime, 60); // 1-hour session as per prompt

    // Fetch Court details
    const court = await prisma.court.findUnique({
      where: { id: courtId },
    });

    if (!court) {
      return NextResponse.json({ success: false, error: "Court not found" }, { status: 404 });
    }

    // Court Booking Constraints:
    // 1. Cannot book past dates (bookingDate < today)
    // 2. Reject any date > 1 month from today
    // 3. On today's date, cannot book times before current time
    const now = new Date();
    const todayStart = startOfDay(now);
    const bookingDayStart = startOfDay(startTime);
    const oneMonthFromToday = addMonths(endOfDay(now), 1);

    if (bookingDayStart < todayStart) {
      return NextResponse.json(
        { success: false, error: "Cannot book court for past dates." },
        { status: 400 }
      );
    }

    if (startTime > oneMonthFromToday) {
      return NextResponse.json(
        { success: false, error: "Court bookings can only be made up to 1 month in advance." },
        { status: 400 }
      );
    }

    if (bookingDayStart.getTime() === todayStart.getTime()) {
      if (startTime.getTime() < now.getTime() - 60000) {
        return NextResponse.json(
          { success: false, error: "Cannot book a court slot in the past." },
          { status: 400 }
        );
      }
    }

    // Member Limit: Each member can play at most twice a day
    let member = null;
    let memberPlan = null;

    if (memberId) {
      member = await prisma.member.findUnique({
        where: { id: memberId },
        include: { plan: true },
      });

      if (!member) {
        return NextResponse.json({ success: false, error: "Member not found" }, { status: 404 });
      }

      memberPlan = member.plan;

      const dayStart = startOfDay(startTime);
      const dayEnd = endOfDay(startTime);

      const dailyBookingsCount = await prisma.courtBooking.count({
        where: {
          memberId,
          status: { not: BookingStatus.CANCELLED },
          startTime: { gte: dayStart, lte: dayEnd },
        },
      });

      const maxAllowed = memberPlan?.maxDailyBookings || 2;
      if (dailyBookingsCount >= maxAllowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Daily Limit Exceeded: Member ${member.name} has already booked ${dailyBookingsCount} session(s) on this day. Each member can play at most ${maxAllowed} times a day.`,
          },
          { status: 400 }
        );
      }
    }

    // Conflict Prevention: Two people must never end up on the same court at the same time!
    // Exception: If social play is explicitly active on that court
    const conflictingBookings = await prisma.courtBooking.findMany({
      where: {
        courtId,
        status: { not: BookingStatus.CANCELLED },
        AND: [
          { startTime: { lt: endTime } },
          { endTime: { gt: startTime } },
        ],
      },
    });

    if (conflictingBookings.length > 0) {
      if (!isSocialPlay || !conflictingBookings.every((b) => b.isSocialPlay)) {
        return NextResponse.json(
          {
            success: false,
            error: `Court Conflict: ${court.name} is already booked from ${new Date(
              conflictingBookings[0].startTime
            ).toLocaleTimeString()} to ${new Date(
              conflictingBookings[0].endTime
            ).toLocaleTimeString()}. Two people must never end up on the same court simultaneously.`,
          },
          { status: 409 }
        );
      }
    }

    // 3. Calculate price through shared utility (PricingCalculator)
    const calculation = PricingCalculator.calculateCourtBooking({
      hourlyRate: court.hourlyRate,
      durationMinutes: 60,
      plan: memberPlan,
      isSocialPlay,
      socialPlayersCount,
    });

    // 4. Create Booking
    const booking = await prisma.courtBooking.create({
      data: {
        courtId,
        memberId: member ? member.id : null,
        guestName: member ? null : guestName || "Walk-in Guest",
        guestPhone: member ? null : guestPhone || "",
        startTime,
        endTime,
        isSocialPlay,
        socialPlayersCount,
        basePrice: calculation.basePrice,
        discountAmount: calculation.discountAmount,
        finalPrice: calculation.finalPrice,
        status: BookingStatus.CONFIRMED,
        paymentStatus: calculation.finalPrice === 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
        notes: notes || (isSocialPlay ? "Friday Social Play Session" : undefined),
      },
      include: {
        court: true,
        member: {
          select: { id: true, name: true, memberNumber: true, planTier: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      booking,
      calculation,
      requiresPayment: calculation.finalPrice > 0,
    });
  } catch (error: any) {
    console.error("Booking error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { bookingId, action } = body;

    if (!bookingId) {
      return NextResponse.json({ success: false, error: "Booking ID is required." }, { status: 400 });
    }

    if (action === "CANCEL") {
      const updated = await prisma.courtBooking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
        include: { court: true, member: true },
      });

      return NextResponse.json({
        success: true,
        booking: updated,
        message: `Booking for ${updated.court.name} was successfully cancelled.`,
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
