import { NextRequest, NextResponse } from "next/server";
import { dateFilterClause, query } from "@/lib/duckdb";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const filter = dateFilterClause("order_date", startDate, endDate);

  try {
    if (startDate || endDate) {
      const products = await query<{
        product_id: number;
        name: string;
        category: string;
        total_revenue: number;
        units_sold: number;
        return_rate: number;
      }>(`
        select
          product_id,
          product_name as name,
          category,
          round(sum(line_revenue), 2) as total_revenue,
          sum(quantity) as units_sold,
          round(sum(is_returned)::double / nullif(count(*), 0) * 100, 2) as return_rate
        from main_intermediate.int_order_items
        where 1=1 ${filter}
        group by 1, 2, 3
        order by total_revenue desc
      `);

      const categories = await query<{ category: string; revenue: number }>(`
        select category, round(sum(line_revenue), 2) as revenue
        from main_intermediate.int_order_items
        where 1=1 ${filter}
        group by 1
        order by revenue desc
      `);

      const returns = await query<{ category: string; return_rate: number }>(`
        select
          category,
          round(sum(is_returned)::double / nullif(count(*), 0) * 100, 2) as return_rate
        from main_intermediate.int_order_items
        where 1=1 ${filter}
        group by 1
        order by return_rate desc
      `);

      return NextResponse.json({ products, categories, returns });
    }

    const [products, , returns] = await Promise.all([
      query(`select * from main_marts.mart_product_performance order by total_revenue desc`),
      query<{ category: string; revenue: number }>(`
        select category, total_revenue as revenue
        from main_marts.mart_product_performance
        group by category, total_revenue
      `),
      query<{ category: string; return_rate: number }>(`
        select category, avg(return_rate) as return_rate
        from main_marts.mart_product_performance
        group by 1
        order by return_rate desc
      `),
    ]);

    const categoryTotals = await query<{ category: string; revenue: number }>(`
      select category, sum(total_revenue) as revenue
      from main_marts.mart_product_performance
      group by 1
      order by revenue desc
    `);

    return NextResponse.json({
      products,
      categories: categoryTotals,
      returns,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Query failed" },
      { status: 500 },
    );
  }
}
