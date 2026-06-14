import { NextRequest, NextResponse } from "next/server";
import { dateFilterClause, query } from "@/lib/duckdb";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const filter = dateFilterClause("date", startDate, endDate);

  try {
    const [monthly, today, rangeTotals] = await Promise.all([
      query<{ month: string; revenue: number }>(`
        select
          date_trunc('month', date) as month,
          sum(revenue) as revenue
        from main_marts.mart_daily_revenue
        where 1=1 ${filter}
        group by 1
        order by 1 desc
        limit 2
      `),
      query<{ revenue: number; orders: number; avg_order_value: number }>(`
        select revenue, orders, avg_order_value
        from main_marts.mart_daily_revenue
        where date = (select max(date) from main_marts.mart_daily_revenue)
      `),
      query<{
        revenue: number;
        orders: number;
        avg_order_value: number;
        new_customers: number;
      }>(`
        select
          sum(revenue) as revenue,
          sum(orders) as orders,
          sum(revenue) / nullif(sum(orders), 0) as avg_order_value,
          sum(new_customers) as new_customers
        from main_marts.mart_daily_revenue
        where 1=1 ${filter}
      `),
    ]);

    const thisMonth = monthly[0]?.revenue ?? 0;
    const lastMonth = monthly[1]?.revenue ?? 0;
    const monthChange =
      lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;

    return NextResponse.json({
      revenueThisMonth: thisMonth,
      revenueLastMonth: lastMonth,
      monthChange,
      ordersToday: today[0]?.orders ?? 0,
      avgOrderValueToday: today[0]?.avg_order_value ?? 0,
      totals: rangeTotals[0] ?? {
        revenue: 0,
        orders: 0,
        avg_order_value: 0,
        new_customers: 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Query failed" },
      { status: 500 },
    );
  }
}
