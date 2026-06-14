"""Run dbt-equivalent transforms directly in DuckDB when dbt CLI is unavailable."""

from __future__ import annotations

import logging
from pathlib import Path

import duckdb

logger = logging.getLogger("pipeline")

TRANSFORM_STATEMENTS = [
    "CREATE SCHEMA IF NOT EXISTS main_staging",
    "CREATE SCHEMA IF NOT EXISTS main_intermediate",
    "CREATE SCHEMA IF NOT EXISTS main_marts",
    "DROP VIEW IF EXISTS main_intermediate.int_order_items",
    "DROP VIEW IF EXISTS main_staging.stg_orders",
    "DROP VIEW IF EXISTS main_staging.stg_products",
    "DROP VIEW IF EXISTS main_staging.stg_customers",
    """
    CREATE OR REPLACE VIEW main_staging.stg_orders AS
    WITH source AS (SELECT * FROM raw.orders),
    deduped AS (
        SELECT *, row_number() OVER (PARTITION BY order_id ORDER BY created_at DESC) AS _row_num
        FROM source
    )
    SELECT
        cast(order_id AS bigint) AS order_id,
        cast(customer_id AS bigint) AS customer_id,
        cast(product_id AS bigint) AS product_id,
        cast(quantity AS integer) AS quantity,
        cast(unit_price AS double) AS unit_price,
        coalesce(cast(discount AS double), 0) AS discount_pct,
        lower(trim(status)) AS status,
        cast(created_at AS timestamp) AS created_at,
        cast(nullif(shipped_at, '') AS timestamp) AS shipped_at,
        upper(trim(country)) AS country_code
    FROM deduped
    WHERE _row_num = 1
    """,
    """
    CREATE OR REPLACE VIEW main_staging.stg_products AS
    WITH source AS (SELECT * FROM raw.products),
    deduped AS (
        SELECT *, row_number() OVER (PARTITION BY product_id ORDER BY created_at DESC) AS _row_num
        FROM source
    )
    SELECT
        cast(product_id AS bigint) AS product_id,
        trim(name) AS name,
        trim(category) AS category,
        cast(base_price AS double) AS base_price,
        cast(cost AS double) AS cost,
        cast(created_at AS timestamp) AS created_at
    FROM deduped
    WHERE _row_num = 1 AND product_id IS NOT NULL
    """,
    """
    CREATE OR REPLACE VIEW main_staging.stg_customers AS
    WITH source AS (SELECT * FROM raw.customers),
    deduped AS (
        SELECT *, row_number() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS _row_num
        FROM source
    )
    SELECT
        cast(customer_id AS bigint) AS customer_id,
        lower(trim(email)) AS email,
        trim(first_name) AS first_name,
        trim(last_name) AS last_name,
        upper(trim(country_code)) AS country_code,
        trim(country) AS country,
        cast(signup_date AS date) AS signup_date,
        cast(created_at AS timestamp) AS created_at
    FROM deduped
    WHERE _row_num = 1 AND customer_id IS NOT NULL
    """,
    """
    CREATE OR REPLACE VIEW main_intermediate.int_order_items AS
    SELECT
        o.order_id,
        o.customer_id,
        o.product_id,
        p.name AS product_name,
        p.category,
        c.signup_date,
        c.country AS customer_country,
        o.country_code,
        o.quantity,
        o.unit_price,
        o.discount_pct,
        o.status,
        o.created_at,
        o.shipped_at,
        o.quantity * o.unit_price * (1 - o.discount_pct / 100.0) AS line_revenue,
        CASE WHEN o.status = 'returned' THEN 1 ELSE 0 END AS is_returned,
        CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END AS is_cancelled,
        cast(date_trunc('day', o.created_at) AS date) AS order_date
    FROM main_staging.stg_orders o
    INNER JOIN main_staging.stg_products p ON o.product_id = p.product_id
    INNER JOIN main_staging.stg_customers c ON o.customer_id = c.customer_id
    WHERE o.status != 'cancelled'
    """,
    """
    CREATE OR REPLACE TABLE main_marts.mart_daily_revenue AS
    WITH order_items AS (SELECT * FROM main_intermediate.int_order_items),
    daily AS (
        SELECT
            order_date AS date,
            sum(line_revenue) AS revenue,
            count(DISTINCT order_id) AS orders,
            count(DISTINCT customer_id) AS customers
        FROM order_items
        GROUP BY 1
    ),
    new_customers AS (
        SELECT signup_date AS date, count(*) AS new_customers
        FROM main_staging.stg_customers
        GROUP BY 1
    )
    SELECT
        d.date,
        round(d.revenue, 2) AS revenue,
        d.orders,
        round(d.revenue / nullif(d.orders, 0), 2) AS avg_order_value,
        coalesce(n.new_customers, 0) AS new_customers
    FROM daily d
    LEFT JOIN new_customers n ON d.date = n.date
    ORDER BY d.date
    """,
    """
    CREATE OR REPLACE TABLE main_marts.mart_product_performance AS
    SELECT
        product_id,
        product_name AS name,
        category,
        round(sum(line_revenue), 2) AS total_revenue,
        sum(quantity) AS units_sold,
        round(sum(is_returned)::double / nullif(count(*), 0) * 100, 2) AS return_rate
    FROM main_intermediate.int_order_items
    GROUP BY 1, 2, 3
    ORDER BY total_revenue DESC
    """,
    """
    CREATE OR REPLACE TABLE main_marts.mart_customer_cohorts AS
    WITH customers AS (
        SELECT customer_id, date_trunc('month', signup_date) AS cohort_month
        FROM main_staging.stg_customers
    ),
    orders AS (
        SELECT customer_id, order_date, line_revenue
        FROM main_intermediate.int_order_items
    ),
    cohort_sizes AS (
        SELECT cohort_month, count(DISTINCT customer_id) AS cohort_size
        FROM customers
        GROUP BY 1
    ),
    activity AS (
        SELECT
            c.cohort_month,
            date_diff('month', c.cohort_month, date_trunc('month', o.order_date)) AS months_since_signup,
            o.customer_id,
            sum(o.line_revenue) AS customer_revenue
        FROM customers c
        INNER JOIN orders o ON c.customer_id = o.customer_id
        GROUP BY 1, 2, 3
    ),
    aggregated AS (
        SELECT
            a.cohort_month,
            a.months_since_signup,
            cs.cohort_size,
            count(DISTINCT a.customer_id) AS active_customers,
            round(avg(a.customer_revenue), 2) AS avg_revenue
        FROM activity a
        INNER JOIN cohort_sizes cs ON a.cohort_month = cs.cohort_month
        GROUP BY 1, 2, 3
    )
    SELECT
        cohort_month,
        months_since_signup,
        round(active_customers::double / nullif(cohort_size, 0) * 100, 2) AS retention_rate,
        avg_revenue
    FROM aggregated
    WHERE months_since_signup >= 0
    ORDER BY cohort_month, months_since_signup
    """,
    """
    CREATE OR REPLACE TABLE main_marts.mart_geo_revenue AS
    WITH order_items AS (SELECT * FROM main_intermediate.int_order_items),
    countries AS (
        SELECT DISTINCT country_code, country
        FROM main_staging.stg_customers
    )
    SELECT
        o.country_code AS country,
        c.country AS country_name,
        round(sum(o.line_revenue), 2) AS revenue,
        count(DISTINCT o.order_id) AS orders,
        round(sum(o.line_revenue) / nullif(count(DISTINCT o.order_id), 0), 2) AS avg_order_value
    FROM order_items o
    LEFT JOIN countries c ON o.country_code = c.country_code
    GROUP BY 1, 2
    ORDER BY revenue DESC
    """,
]


def run_transforms(warehouse_path: Path) -> None:
    con = duckdb.connect(str(warehouse_path))
    try:
        for statement in TRANSFORM_STATEMENTS:
            con.execute(statement)
        logger.info("Applied DuckDB transforms (dbt-equivalent SQL fallback)")
    finally:
        con.close()


def run_basic_tests(warehouse_path: Path) -> None:
    checks = [
        ("mart_daily_revenue date not null", "select count(*) from main_marts.mart_daily_revenue where date is null"),
        ("mart_product_performance unique product_id", """
            select count(*) from (
              select product_id from main_marts.mart_product_performance
              group by 1 having count(*) > 1
            )
        """),
    ]
    con = duckdb.connect(str(warehouse_path), read_only=True)
    try:
        for name, sql in checks:
            failures = con.execute(sql).fetchone()[0]
            if failures:
                raise RuntimeError(f"Data test failed: {name} ({failures} rows)")
        logger.info("Basic data quality checks passed")
    finally:
        con.close()
