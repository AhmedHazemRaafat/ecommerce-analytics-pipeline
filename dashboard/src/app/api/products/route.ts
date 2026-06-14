import { NextRequest, NextResponse } from "next/server";
import {
  aggregateCategoriesFromOrderItems,
  aggregateCategoryTotals,
  aggregateProductsFromOrderItems,
  aggregateReturnsFromOrderItems,
  aggregateReturnsFromProducts,
  filterOrderItemsByDate,
  readDataFile,
  type ProductOrderItem,
  type ProductRow,
} from "@/lib/data";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    const { products, orderItems } = await readDataFile<{
      products: ProductRow[];
      orderItems: ProductOrderItem[];
    }>("products");

    if (startDate || endDate) {
      const filteredItems = filterOrderItemsByDate(orderItems, startDate, endDate);

      return NextResponse.json({
        products: aggregateProductsFromOrderItems(filteredItems),
        categories: aggregateCategoriesFromOrderItems(filteredItems),
        returns: aggregateReturnsFromOrderItems(filteredItems),
      });
    }

    return NextResponse.json({
      products,
      categories: aggregateCategoryTotals(products),
      returns: aggregateReturnsFromProducts(products),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load products data" },
      { status: 500 },
    );
  }
}
