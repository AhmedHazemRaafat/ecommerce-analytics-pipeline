with source as (
    select * from {{ source('raw', 'orders') }}
),

deduped as (
    select
        *,
        row_number() over (partition by order_id order by created_at desc) as _row_num
    from source
),

cleaned as (
    select
        cast(order_id as bigint) as order_id,
        cast(customer_id as bigint) as customer_id,
        cast(product_id as bigint) as product_id,
        cast(quantity as integer) as quantity,
        cast(unit_price as double) as unit_price,
        coalesce(cast(discount as double), 0) as discount_pct,
        lower(trim(status)) as status,
        cast(created_at as timestamp) as created_at,
        cast(nullif(shipped_at, '') as timestamp) as shipped_at,
        upper(trim(country)) as country_code
    from deduped
    where _row_num = 1
)

select * from cleaned
