import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { StaffRole, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

function mapStaffRoleToUserRole(staffRole: StaffRole): UserRole {
  switch (staffRole) {
    case StaffRole.MANAGER:
      return UserRole.OWNER;
    case StaffRole.COURT_COACH:
      return UserRole.COACH;
    case StaffRole.CHEF:
      return UserRole.CHEF;
    case StaffRole.BARISTA:
      return UserRole.BAR_STAFF;
    case StaffRole.FRONT_DESK:
    default:
      return UserRole.FRONT_DESK;
  }
}

export async function GET(req: NextRequest) {
  try {
    const staff = await prisma.staffMember.findMany({
      orderBy: { name: "asc" },
      include: {
        user: {
          select: { id: true, email: true, role: true, createdAt: true },
        },
        shifts: {
          orderBy: { date: "desc" },
          take: 5,
        },
        leaves: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
    });

    return NextResponse.json({ success: true, staff });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      role,
      phone,
      hourlyWage = 150,
      monthlySalary = 35000,
      password,
      userRole,
      createLoginAccount = true,
    } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ success: false, error: "Staff member name is required." }, { status: 400 });
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ success: false, error: "Valid email address is required." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!role || !Object.values(StaffRole).includes(role as StaffRole)) {
      return NextResponse.json(
        { success: false, error: "Valid staff role is required (FRONT_DESK, BARISTA, CHEF, COURT_COACH, MANAGER)." },
        { status: 400 }
      );
    }

    if (!phone || typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json({ success: false, error: "Phone number is required." }, { status: 400 });
    }

    const wage = Number(hourlyWage);
    const salary = Number(monthlySalary);
    if (isNaN(salary) || salary <= 0) {
      return NextResponse.json({ success: false, error: "Monthly salary must be a positive number." }, { status: 400 });
    }

    // Check duplicate email
    const existingStaff = await prisma.staffMember.findUnique({ where: { email: normalizedEmail } });
    if (existingStaff) {
      return NextResponse.json(
        { success: false, error: `A staff member with email "${normalizedEmail}" already exists.` },
        { status: 400 }
      );
    }

    if (createLoginAccount) {
      const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
      if (existingUser) {
        return NextResponse.json(
          { success: false, error: `A user account with email "${normalizedEmail}" already exists.` },
          { status: 400 }
        );
      }
    }

    // Create StaffMember and linked User in transaction
    const result = await prisma.$transaction(async (tx) => {
      const staffMember = await tx.staffMember.create({
        data: {
          name: name.trim(),
          email: normalizedEmail,
          role: role as StaffRole,
          phone: phone.trim(),
          hourlyWage: isNaN(wage) || wage < 0 ? 150 : wage,
          monthlySalary: salary,
        },
      });

      let user = null;
      if (createLoginAccount) {
        const passwordHash = await bcrypt.hash(password || "password123", 10);
        const resolvedRole = userRole && Object.values(UserRole).includes(userRole as UserRole)
          ? (userRole as UserRole)
          : mapStaffRoleToUserRole(role as StaffRole);

        user = await tx.user.create({
          data: {
            email: normalizedEmail,
            password: passwordHash,
            name: staffMember.name,
            role: resolvedRole,
            staffId: staffMember.id,
          },
          select: { id: true, email: true, role: true },
        });
      }

      return { ...staffMember, user };
    });

    return NextResponse.json({ success: true, staff: result }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, email, role, phone, hourlyWage, monthlySalary, userRole } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "Staff member ID is required." }, { status: 400 });
    }

    const existing = await prisma.staffMember.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Staff member not found." }, { status: 404 });
    }

    const updateStaffData: any = {};
    let normalizedEmail = existing.email;

    if (email !== undefined) {
      if (!email.includes("@")) {
        return NextResponse.json({ success: false, error: "Valid email address is required." }, { status: 400 });
      }
      normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== existing.email) {
        const dupStaff = await prisma.staffMember.findUnique({ where: { email: normalizedEmail } });
        if (dupStaff) {
          return NextResponse.json(
            { success: false, error: `A staff member with email "${normalizedEmail}" already exists.` },
            { status: 400 }
          );
        }
      }
      updateStaffData.email = normalizedEmail;
    }

    if (name !== undefined) updateStaffData.name = name.trim();
    if (phone !== undefined) updateStaffData.phone = phone.trim();
    if (role !== undefined) {
      if (!Object.values(StaffRole).includes(role as StaffRole)) {
        return NextResponse.json({ success: false, error: "Invalid staff role." }, { status: 400 });
      }
      updateStaffData.role = role as StaffRole;
    }
    if (hourlyWage !== undefined) {
      const wage = Number(hourlyWage);
      if (isNaN(wage) || wage < 0) {
        return NextResponse.json({ success: false, error: "Hourly wage must be non-negative." }, { status: 400 });
      }
      updateStaffData.hourlyWage = wage;
    }
    if (monthlySalary !== undefined) {
      const sal = Number(monthlySalary);
      if (isNaN(sal) || sal <= 0) {
        return NextResponse.json({ success: false, error: "Monthly salary must be a positive number." }, { status: 400 });
      }
      updateStaffData.monthlySalary = sal;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedStaff = await tx.staffMember.update({
        where: { id },
        data: updateStaffData,
      });

      let updatedUser = null;
      if (existing.user) {
        const updateUserPayload: any = {};
        if (updateStaffData.name) updateUserPayload.name = updateStaffData.name;
        if (updateStaffData.email) updateUserPayload.email = updateStaffData.email;
        if (userRole && Object.values(UserRole).includes(userRole as UserRole)) {
          updateUserPayload.role = userRole as UserRole;
        } else if (updateStaffData.role) {
          updateUserPayload.role = mapStaffRoleToUserRole(updateStaffData.role);
        }

        if (Object.keys(updateUserPayload).length > 0) {
          updatedUser = await tx.user.update({
            where: { id: existing.user.id },
            data: updateUserPayload,
            select: { id: true, email: true, role: true },
          });
        } else {
          updatedUser = { id: existing.user.id, email: existing.user.email, role: existing.user.role };
        }
      }

      return { ...updatedStaff, user: updatedUser };
    });

    return NextResponse.json({ success: true, staff: result });
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
      return NextResponse.json({ success: false, error: "Staff member ID is required." }, { status: 400 });
    }

    const existing = await prisma.staffMember.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Staff member not found." }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Delete associated shifts and leaves
      await tx.shift.deleteMany({ where: { staffId: id } });
      await tx.leave.deleteMany({ where: { staffId: id } });

      // 2. Delete linked user credentials and sessions if any
      if (existing.user) {
        await tx.session.deleteMany({ where: { userId: existing.user.id } });
        await tx.authAuditLog.deleteMany({ where: { userId: existing.user.id } });
        await tx.user.delete({ where: { id: existing.user.id } });
      }

      // 3. Delete staff member
      await tx.staffMember.delete({ where: { id } });
    });

    return NextResponse.json({
      success: true,
      message: `Staff member "${existing.name}" and linked credentials removed successfully.`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
