import { NextRequest, NextResponse } from "next/server";
import {
  buildRevenueSeries,
  filterByDateRange,
  readDataFile,
  type DailyRevenueRow,
} from "@/lib/data";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    const { dailyRevenue } = await readDataFile<{ dailyRevenue: DailyRevenueRow[] }>(
      "revenue",
    );
    const filtered = filterByDateRange(dailyRevenue, startDate, endDate);

    return NextResponse.json({ series: buildRevenueSeries(filtered) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load revenue data" },
      { status: 500 },
    );
  }
}
