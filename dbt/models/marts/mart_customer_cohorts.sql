with customers as (
    select
        customer_id,
        date_trunc('month', signup_date) as cohort_month
    from {{ ref('stg_customers') }}
),

orders as (
    select
        customer_id,
        order_date,
        line_revenue
    from {{ ref('int_order_items') }}
),

cohort_sizes as (
    select
        cohort_month,
        count(distinct customer_id) as cohort_size
    from customers
    group by 1
),

activity as (
    select
        c.cohort_month,
        date_diff('month', c.cohort_month, date_trunc('month', o.order_date)) as months_since_signup,
        o.customer_id,
        sum(o.line_revenue) as customer_revenue
    from customers c
    inner join orders o on c.customer_id = o.customer_id
    group by 1, 2, 3
),

aggregated as (
    select
        a.cohort_month,
        a.months_since_signup,
        cs.cohort_size,
        count(distinct a.customer_id) as active_customers,
        round(avg(a.customer_revenue), 2) as avg_revenue
    from activity a
    inner join cohort_sizes cs on a.cohort_month = cs.cohort_month
    group by 1, 2, 3
)

select
    cohort_month,
    months_since_signup,
    round(active_customers::double / nullif(cohort_size, 0) * 100, 2) as retention_rate,
    avg_revenue
from aggregated
where months_since_signup >= 0
order by cohort_month, months_since_signup
