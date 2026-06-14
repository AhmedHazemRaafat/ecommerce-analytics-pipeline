import { NextRequest, NextResponse } from "next/server";
import { dateFilterClause, query } from "@/lib/duckdb";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const filter = dateFilterClause("order_date", startDate, endDate);

  try {
    const countries = startDate || endDate
      ? await query<{
          country: string;
          country_name: string;
          revenue: number;
          orders: number;
          avg_order_value: number;
        }>(`
          select
            o.country_code as country,
            max(o.customer_country) as country_name,
            round(sum(o.line_revenue), 2) as revenue,
            count(distinct o.order_id) as orders,
            round(sum(o.line_revenue) / nullif(count(distinct o.order_id), 0), 2) as avg_order_value
          from main_intermediate.int_order_items o
          where 1=1 ${filter}
          group by 1
          order by revenue desc
        `)
      : await query<{
          country: string;
          country_name: string;
          revenue: number;
          orders: number;
          avg_order_value: number;
        }>(`
          select country, country_name, revenue, orders, avg_order_value
          from main_marts.mart_geo_revenue
          order by revenue desc
        `);

    return NextResponse.json({ countries });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Query failed" },
      { status: 500 },
    );
  }
}
