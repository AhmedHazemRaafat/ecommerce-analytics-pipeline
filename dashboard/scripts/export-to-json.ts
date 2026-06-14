import fs from "fs";
import path from "path";
import duckdb from "duckdb";

type Row = Record<string, unknown>;

const WAREHOUSE_PATH = process.env.DUCKDB_PATH
  ? path.resolve(process.cwd(), process.env.DUCKDB_PATH)
  : path.resolve(process.cwd(), "data", "warehouse.duckdb");

const OUTPUT_DIR = path.join(process.cwd(), "public", "data");

function queryAll(sql: string): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const db = new duckdb.Database(WAREHOUSE_PATH, { access_mode: "READ_ONLY" });
    const connection = db.connect();

    connection.all(sql, (error, rows) => {
      connection.close();
      db.close();

      if (error) {
        reject(error);
        return;
      }

      resolve(
        (rows as Row[]).map((row) =>
          Object.fromEntries(
            Object.entries(row).map(([key, value]) => [
              key,
              typeof value === "bigint" ? Number(value) : value,
            ]),
          ),
        ),
      );
    });
  });
}

function writeJson(name: string, data: unknown) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUTPUT_DIR, `${name}.json`),
    JSON.stringify(data, null, 2),
  );
  console.log(`Wrote public/data/${name}.json`);
}

async function main() {
  if (!fs.existsSync(WAREHOUSE_PATH)) {
    throw new Error(
      `Warehouse not found at ${WAREHOUSE_PATH}. Run pipeline locally first.`,
    );
  }

  const dailyRevenue = await queryAll(`
    select
      cast(date as varchar) as date,
      revenue,
      orders,
      avg_order_value,
      new_customers
    from main_marts.mart_daily_revenue
    order by date
  `);

  const products = await queryAll(`
    select
      product_id,
      name,
      category,
      total_revenue,
      units_sold,
      return_rate
    from main_marts.mart_product_performance
    order by total_revenue desc
  `);

  const productOrderItems = await queryAll(`
    select
      product_id,
      product_name as name,
      category,
      cast(order_date as varchar) as order_date,
      line_revenue,
      quantity,
      is_returned
    from main_intermediate.int_order_items
  `);

  const cohorts = await queryAll(`
    select
      cast(cohort_month as varchar) as cohort_month,
      months_since_signup,
      retention_rate,
      avg_revenue
    from main_marts.mart_customer_cohorts
    order by cohort_month, months_since_signup
  `);

  const customerOrderItems = await queryAll(`
    select
      customer_id,
      cast(order_date as varchar) as order_date
    from main_intermediate.int_order_items
  `);

  const countries = await queryAll(`
    select country, country_name, revenue, orders, avg_order_value
    from main_marts.mart_geo_revenue
    order by revenue desc
  `);

  const geoOrderItems = await queryAll(`
    select
      country_code as country,
      customer_country as country_name,
      order_id,
      cast(order_date as varchar) as order_date,
      line_revenue
    from main_intermediate.int_order_items
  `);

  writeJson("overview", { dailyRevenue });
  writeJson("revenue", { dailyRevenue });
  writeJson("products", { products, orderItems: productOrderItems });
  writeJson("customers", { cohorts, orderItems: customerOrderItems });
  writeJson("geography", { countries, orderItems: geoOrderItems });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
