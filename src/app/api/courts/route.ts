import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { SportType } from "@prisma/client";

export async function GET() {
  try {
    const courts = await prisma.court.findMany({
      orderBy: { name: "asc" },
      include: {
        bookings: {
          where: {
            status: { not: "CANCELLED" },
            startTime: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
          include: {
            member: {
              select: { id: true, name: true, memberNumber: true, planTier: true },
            },
          },
          orderBy: { startTime: "asc" },
        },
      },
    });

    return NextResponse.json({ success: true, courts });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, sport, surface, hourlyRate, description, isAvailable = true } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Court name is required." }, { status: 400 });
    }

    if (!sport || !Object.values(SportType).includes(sport as SportType)) {
      return NextResponse.json(
        { success: false, error: "Valid sport type (TENNIS or CRICKET) is required." },
        { status: 400 }
      );
    }

    if (!surface || typeof surface !== "string" || !surface.trim()) {
      return NextResponse.json({ success: false, error: "Court surface is required." }, { status: 400 });
    }

    const rate = Number(hourlyRate);
    if (isNaN(rate) || rate <= 0) {
      return NextResponse.json({ success: false, error: "Hourly rate must be a positive number." }, { status: 400 });
    }

    const court = await prisma.court.create({
      data: {
        name: name.trim(),
        sport: sport as SportType,
        surface: surface.trim(),
        hourlyRate: rate,
        description: description?.trim() || null,
        isAvailable: Boolean(isAvailable),
      },
    });

    return NextResponse.json({ success: true, court }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, sport, surface, hourlyRate, description, isAvailable } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Court ID is required." }, { status: 400 });
    }

    const existing = await prisma.court.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Court not found." }, { status: 404 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (sport !== undefined) {
      if (!Object.values(SportType).includes(sport as SportType)) {
        return NextResponse.json({ success: false, error: "Invalid sport type." }, { status: 400 });
      }
      updateData.sport = sport;
    }
    if (surface !== undefined) updateData.surface = surface.trim();
    if (hourlyRate !== undefined) {
      const rate = Number(hourlyRate);
      if (isNaN(rate) || rate <= 0) {
        return NextResponse.json({ success: false, error: "Hourly rate must be a positive number." }, { status: 400 });
      }
      updateData.hourlyRate = rate;
    }
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (isAvailable !== undefined) updateData.isAvailable = Boolean(isAvailable);

    const court = await prisma.court.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, court });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    let id = req.nextUrl?.searchParams?.get("id");
    if (!id) {
      try {
        const body = await req.json();
        id = body?.id;
      } catch (e) {
        // body not present
      }
    }

    if (!id) {
      return NextResponse.json({ success: false, error: "Court ID is required." }, { status: 400 });
    }

    const existing = await prisma.court.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Court not found." }, { status: 404 });
    }

    // Check for active future bookings
    const activeFutureBookings = await prisma.courtBooking.count({
      where: {
        courtId: id,
        status: { not: "CANCELLED" },
        startTime: { gte: new Date() },
      },
    });

    if (activeFutureBookings > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot delete court "${existing.name}": There are ${activeFutureBookings} active future booking(s). Please cancel them first.`,
        },
        { status: 400 }
      );
    }

    // Clean up past/cancelled bookings before removing court
    await prisma.courtBooking.deleteMany({ where: { courtId: id } });
    await prisma.court.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: `Court "${existing.name}" removed successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
