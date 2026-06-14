with order_items as (
    select * from {{ ref('int_order_items') }}
),

daily as (
    select
        order_date as date,
        sum(line_revenue) as revenue,
        count(distinct order_id) as orders,
        count(distinct customer_id) as customers
    from order_items
    group by 1
),

new_customers as (
    select
        signup_date as date,
        count(*) as new_customers
    from {{ ref('stg_customers') }}
    group by 1
)

select
    d.date,
    round(d.revenue, 2) as revenue,
    d.orders,
    round(d.revenue / nullif(d.orders, 0), 2) as avg_order_value,
    coalesce(n.new_customers, 0) as new_customers
from daily d
left join new_customers n on d.date = n.date
order by d.date
