import { NextRequest, NextResponse } from "next/server";
import {
  aggregateCountriesFromOrderItems,
  filterOrderItemsByDate,
  readDataFile,
  type CountryRow,
  type GeoOrderItem,
} from "@/lib/data";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    const { countries, orderItems } = await readDataFile<{
      countries: CountryRow[];
      orderItems: GeoOrderItem[];
    }>("geography");

    if (startDate || endDate) {
      const filteredItems = filterOrderItemsByDate(orderItems, startDate, endDate);
      return NextResponse.json({
        countries: aggregateCountriesFromOrderItems(filteredItems),
      });
    }

    return NextResponse.json({ countries });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load geography data" },
      { status: 500 },
    );
  }
}
