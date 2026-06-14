with order_items as (
    select * from {{ ref('int_order_items') }}
)

select
    product_id,
    product_name as name,
    category,
    round(sum(line_revenue), 2) as total_revenue,
    sum(quantity) as units_sold,
    round(
        sum(is_returned)::double / nullif(count(*), 0) * 100,
        2
    ) as return_rate
from order_items
group by 1, 2, 3
order by total_revenue desc
