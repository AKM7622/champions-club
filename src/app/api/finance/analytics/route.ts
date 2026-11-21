import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { subDays, startOfDay, endOfDay } from "date-fns";

export async function GET() {
  try {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfDay(subDays(now, 7));
    const monthStart = startOfDay(subDays(now, 30));

    // 1. Fetch all transactions in past 30 days
    const transactions = await prisma.transaction.findMany({
      where: { createdAt: { gte: monthStart } },
      orderBy: { createdAt: "desc" },
      include: {
        member: { select: { name: true, planTier: true } },
      },
    });

    // 2. Metrics: Today, This Week, This Month
    let revenueToday = 0;
    let revenueThisWeek = 0;
    let revenueThisMonth = 0;

    const categoryBreakdown: { [category: string]: number } = {
      COURT: 0,
      SHOP: 0,
      BAR: 0,
      MEMBERSHIP: 0,
      CORPORATE: 0,
    };

    const paymentMethodBreakdown: { [method: string]: number } = {
      UPI: 0,
      CARD: 0,
      CASH: 0,
    };

    // 30-day timeline grouping
    const dailyMap: { [day: string]: { date: string; amount: number; count: number } } = {};
    for (let i = 29; i >= 0; i--) {
      const d = subDays(now, i);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = { date: key, amount: 0, count: 0 };
    }

    for (const t of transactions) {
      const amt = t.amount;
      const tDate = new Date(t.createdAt);

      if (tDate >= todayStart && tDate <= todayEnd) {
        revenueToday += amt;
      }
      if (tDate >= weekStart) {
        revenueThisWeek += amt;
      }
      revenueThisMonth += amt;

      if (categoryBreakdown[t.category] !== undefined) {
        categoryBreakdown[t.category] += amt;
      }
      if (paymentMethodBreakdown[t.paymentMethod] !== undefined) {
        paymentMethodBreakdown[t.paymentMethod] += amt;
      }

      const dayKey = tDate.toISOString().split("T")[0];
      if (dailyMap[dayKey]) {
        dailyMap[dayKey].amount += amt;
        dailyMap[dayKey].count += 1;
      }
    }

    // 3. HR Payroll & Staff Stats
    const staff = await prisma.staffMember.findMany({
      include: {
        shifts: {
          where: { date: { gte: todayStart, lte: todayEnd } },
        },
        leaves: {
          where: { status: "PENDING" },
        },
      },
    });

    const totalEstimatedMonthlyPayroll = staff.reduce((sum, s) => sum + s.monthlySalary, 0);

    // 4. Invoices
    const invoices = await prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
    });

    const pendingInvoicesTotal = invoices
      .filter((inv) => inv.status === "PENDING")
      .reduce((sum, inv) => sum + inv.totalAmount, 0);

    // 5. Estimated Taxes (GST ~ 5-18% average ~ 12% blended)
    const estimatedTax = Math.round(revenueThisMonth * 0.12);
    const netProfit = Math.round(revenueThisMonth - totalEstimatedMonthlyPayroll - estimatedTax);

    return NextResponse.json({
      success: true,
      summary: {
        revenueToday,
        revenueThisWeek,
        revenueThisMonth,
        pendingInvoicesTotal,
        totalEstimatedMonthlyPayroll,
        estimatedTax,
        netProfit,
      },
      categoryBreakdown,
      paymentMethodBreakdown,
      dailyTrend: Object.values(dailyMap),
      staff,
      invoices,
      recentTransactions: transactions.slice(0, 15),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
