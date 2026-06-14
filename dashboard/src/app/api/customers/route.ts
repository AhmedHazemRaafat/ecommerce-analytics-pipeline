import { NextRequest, NextResponse } from "next/server";
import { dateFilterClause, query } from "@/lib/duckdb";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const filter = dateFilterClause("order_date", startDate, endDate);

  try {
    const [cohorts, customerTrend] = await Promise.all([
      query<{
        cohort_month: string;
        months_since_signup: number;
        retention_rate: number;
        avg_revenue: number;
      }>(`
        select cohort_month, months_since_signup, retention_rate, avg_revenue
        from main_marts.mart_customer_cohorts
        order by cohort_month, months_since_signup
      `),
      query<{ date: string; new_customers: number; returning_customers: number }>(`
        with first_orders as (
          select customer_id, min(order_date) as first_order_date
          from main_intermediate.int_order_items
          group by 1
        ),
        daily as (
          select
            o.order_date as date,
            o.customer_id,
            case when o.order_date = f.first_order_date then 1 else 0 end as is_new
          from main_intermediate.int_order_items o
          inner join first_orders f on o.customer_id = f.customer_id
          where 1=1 ${filter}
        )
        select
          date,
          count(distinct case when is_new = 1 then customer_id end) as new_customers,
          count(distinct case when is_new = 0 then customer_id end) as returning_customers
        from daily
        group by 1
        order by 1
      `),
    ]);

    return NextResponse.json({ cohorts, customerTrend });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Query failed" },
      { status: 500 },
    );
  }
}
