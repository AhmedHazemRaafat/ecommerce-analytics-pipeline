import { NextRequest, NextResponse } from "next/server";
import { dateFilterClause, query } from "@/lib/duckdb";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const filter = dateFilterClause("date", startDate, endDate);

  try {
    const rows = await query<{
      date: string;
      revenue: number;
      orders: number;
      avg_order_value: number;
      ma7_revenue: number;
      ma7_orders: number;
      ma7_aov: number;
    }>(`
      with daily as (
        select date, revenue, orders, avg_order_value
        from main_marts.mart_daily_revenue
        where 1=1 ${filter}
      )
      select
        date,
        revenue,
        orders,
        avg_order_value,
        avg(revenue) over (order by date rows between 6 preceding and current row) as ma7_revenue,
        avg(orders) over (order by date rows between 6 preceding and current row) as ma7_orders,
        avg(avg_order_value) over (order by date rows between 6 preceding and current row) as ma7_aov
      from daily
      order by date
    `);

    return NextResponse.json({ series: rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Query failed" },
      { status: 500 },
    );
  }
}
