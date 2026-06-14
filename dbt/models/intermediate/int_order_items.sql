with orders as (
    select * from {{ ref('stg_orders') }}
),

products as (
    select * from {{ ref('stg_products') }}
),

customers as (
    select * from {{ ref('stg_customers') }}
)

select
    o.order_id,
    o.customer_id,
    o.product_id,
    p.name as product_name,
    p.category,
    c.signup_date,
    c.country as customer_country,
    o.country_code,
    o.quantity,
    o.unit_price,
    o.discount_pct,
    o.status,
    o.created_at,
    o.shipped_at,
    o.quantity * o.unit_price * (1 - o.discount_pct / 100.0) as line_revenue,
    case when o.status = 'returned' then 1 else 0 end as is_returned,
    case when o.status = 'cancelled' then 1 else 0 end as is_cancelled,
    date_trunc('day', o.created_at)::date as order_date
from orders o
inner join products p on o.product_id = p.product_id
inner join customers c on o.customer_id = c.customer_id
where o.status != 'cancelled'
