import { NextRequest, NextResponse } from "next/server";
import {
  buildCustomerTrend,
  filterOrderItemsByDate,
  readDataFile,
  type CohortRow,
  type CustomerOrderItem,
} from "@/lib/data";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    const { cohorts, orderItems } = await readDataFile<{
      cohorts: CohortRow[];
      orderItems: CustomerOrderItem[];
    }>("customers");

    const filteredItems = filterOrderItemsByDate(orderItems, startDate, endDate);

    return NextResponse.json({
      cohorts,
      customerTrend: buildCustomerTrend(filteredItems),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load customers data" },
      { status: 500 },
    );
  }
}
