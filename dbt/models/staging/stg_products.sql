with source as (
    select * from {{ source('raw', 'products') }}
),

deduped as (
    select
        *,
        row_number() over (partition by product_id order by created_at desc) as _row_num
    from source
)

select
    cast(product_id as bigint) as product_id,
    trim(name) as name,
    trim(category) as category,
    cast(base_price as double) as base_price,
    cast(cost as double) as cost,
    cast(created_at as timestamp) as created_at
from deduped
where _row_num = 1
  and product_id is not null
