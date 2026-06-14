with order_items as (
    select * from {{ ref('int_order_items') }}
),

countries as (
    select distinct country_code, country
    from {{ ref('stg_customers') }}
)

select
    o.country_code as country,
    c.country as country_name,
    round(sum(o.line_revenue), 2) as revenue,
    count(distinct o.order_id) as orders,
    round(sum(o.line_revenue) / nullif(count(distinct o.order_id), 0), 2) as avg_order_value
from order_items o
left join countries c on o.country_code = c.country_code
group by 1, 2
order by revenue desc
