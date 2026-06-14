with source as (
    select * from {{ source('raw', 'customers') }}
),

deduped as (
    select
        *,
        row_number() over (partition by customer_id order by created_at desc) as _row_num
    from source
)

select
    cast(customer_id as bigint) as customer_id,
    lower(trim(email)) as email,
    trim(first_name) as first_name,
    trim(last_name) as last_name,
    upper(trim(country_code)) as country_code,
    trim(country) as country,
    cast(signup_date as date) as signup_date,
    cast(created_at as timestamp) as created_at
from deduped
where _row_num = 1
  and customer_id is not null
