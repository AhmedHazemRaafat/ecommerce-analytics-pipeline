import { NextRequest, NextResponse } from "next/server";
import {
  filterByDateRange,
  groupDailyRevenueByMonth,
  readDataFile,
  sumDailyRevenueTotals,
  type DailyRevenueRow,
} from "@/lib/data";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    const { dailyRevenue } = await readDataFile<{ dailyRevenue: DailyRevenueRow[] }>(
      "overview",
    );
    const filtered = filterByDateRange(dailyRevenue, startDate, endDate);
    const monthly = groupDailyRevenueByMonth(filtered);
    const latest = dailyRevenue.reduce<DailyRevenueRow | null>((current, row) => {
      if (!current || row.date > current.date) return row;
      return current;
    }, null);

    const thisMonth = monthly[0]?.revenue ?? 0;
    const lastMonth = monthly[1]?.revenue ?? 0;
    const monthChange =
      lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    return NextResponse.json({
      revenueThisMonth: thisMonth,
      revenueLastMonth: lastMonth,
      monthChange,
      ordersToday: latest?.orders ?? 0,
      avgOrderValueToday: latest?.avg_order_value ?? 0,
      totals: sumDailyRevenueTotals(filtered),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load overview data" },
      { status: 500 },
    );
  }
}
