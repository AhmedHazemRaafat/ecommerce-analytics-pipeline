#!/usr/bin/env python3
"""Generate realistic fake e-commerce data for the analytics pipeline."""

from __future__ import annotations

import csv
import json
import random
from datetime import datetime, timedelta
from pathlib import Path

from faker import Faker

DATA_DIR = Path(__file__).parent / "data" / "raw"
RANDOM_SEED = 42

CATEGORIES = [
    "Electronics",
    "Fashion",
    "Home & Garden",
    "Sports",
    "Beauty",
    "Books",
    "Toys",
    "Food & Beverage",
]

EUROPEAN_COUNTRIES = [
    ("DE", "Germany"),
    ("FR", "France"),
    ("GB", "United Kingdom"),
    ("IT", "Italy"),
    ("ES", "Spain"),
    ("NL", "Netherlands"),
    ("BE", "Belgium"),
    ("AT", "Austria"),
    ("PL", "Poland"),
    ("SE", "Sweden"),
    ("DK", "Denmark"),
    ("FI", "Finland"),
    ("NO", "Norway"),
    ("IE", "Ireland"),
    ("PT", "Portugal"),
    ("CZ", "Czech Republic"),
    ("RO", "Romania"),
    ("HU", "Hungary"),
    ("GR", "Greece"),
    ("CH", "Switzerland"),
]

ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "returned", "cancelled"]
STATUS_WEIGHTS = [0.05, 0.08, 0.12, 0.65, 0.07, 0.03]


def write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def generate_products(fake: Faker, count: int = 500) -> list[dict]:
    products = []
    product_id = 1
    for index in range(count):
        category = CATEGORIES[index % len(CATEGORIES)]
        base_price = random.uniform(9.99, 499.99)
        products.append(
            {
                "product_id": product_id,
                "name": fake.catch_phrase()[:80],
                "category": category,
                "base_price": round(base_price, 2),
                "cost": round(base_price * random.uniform(0.35, 0.65), 2),
                "created_at": fake.date_time_between(start_date="-3y", end_date="-2y").isoformat(),
            }
        )
        product_id += 1
    return products


def generate_customers(fake: Faker, count: int = 2000) -> list[dict]:
    customers = []
    for customer_id in range(1, count + 1):
        country_code, country_name = random.choice(EUROPEAN_COUNTRIES)
        signup = fake.date_time_between(start_date="-2y", end_date="-1d")
        customers.append(
            {
                "customer_id": customer_id,
                "email": fake.unique.email(),
                "first_name": fake.first_name(),
                "last_name": fake.last_name(),
                "country_code": country_code,
                "country": country_name,
                "signup_date": signup.date().isoformat(),
                "created_at": signup.isoformat(),
            }
        )
    return customers


def generate_orders(products: list[dict], customers: list[dict], count: int = 10000) -> list[dict]:
    fake = Faker()
    product_prices = {p["product_id"]: p["base_price"] for p in products}
    start_date = datetime.now() - timedelta(days=730)

    orders = []
    for order_id in range(1, count + 1):
        customer = random.choice(customers)
        product = random.choice(products)
        created_at = fake.date_time_between(start_date=start_date, end_date="now")
        status = random.choices(ORDER_STATUSES, weights=STATUS_WEIGHTS, k=1)[0]

        shipped_at = ""
        if status in {"shipped", "delivered", "returned"}:
            shipped_at = (created_at + timedelta(days=random.randint(1, 7))).isoformat()

        unit_price = round(product_prices[product["product_id"]] * random.uniform(0.85, 1.15), 2)
        discount = round(random.choice([0, 0, 0, 5, 10, 15, 20, 25]), 2)
        quantity = random.choices([1, 1, 1, 2, 3, 4], weights=[50, 20, 10, 10, 7, 3], k=1)[0]

        orders.append(
            {
                "order_id": order_id,
                "customer_id": customer["customer_id"],
                "product_id": product["product_id"],
                "quantity": quantity,
                "unit_price": unit_price,
                "discount": discount,
                "status": status,
                "created_at": created_at.isoformat(),
                "shipped_at": shipped_at,
                "country": customer["country_code"],
            }
        )

    return orders


def main() -> None:
    random.seed(RANDOM_SEED)
    Faker.seed(RANDOM_SEED)
    fake = Faker(["en_GB", "de_DE", "fr_FR"])

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("Generating products...")
    products = generate_products(fake)
    write_csv(
        DATA_DIR / "products.csv",
        products,
        ["product_id", "name", "category", "base_price", "cost", "created_at"],
    )
    (DATA_DIR / "products.json").write_text(json.dumps(products, indent=2))

    print("Generating customers...")
    customers = generate_customers(fake)
    write_csv(
        DATA_DIR / "customers.csv",
        customers,
        [
            "customer_id",
            "email",
            "first_name",
            "last_name",
            "country_code",
            "country",
            "signup_date",
            "created_at",
        ],
    )
    (DATA_DIR / "customers.json").write_text(json.dumps(customers, indent=2))

    print("Generating orders...")
    orders = generate_orders(products, customers)
    write_csv(
        DATA_DIR / "orders.csv",
        orders,
        [
            "order_id",
            "customer_id",
            "product_id",
            "quantity",
            "unit_price",
            "discount",
            "status",
            "created_at",
            "shipped_at",
            "country",
        ],
    )
    (DATA_DIR / "orders.json").write_text(json.dumps(orders, indent=2))

    manifest = {
        "generated_at": datetime.now().isoformat(),
        "products": len(products),
        "customers": len(customers),
        "orders": len(orders),
        "categories": len(CATEGORIES),
        "countries": len(EUROPEAN_COUNTRIES),
    }
    (DATA_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))

    print(
        f"Done. Wrote {len(products)} products, {len(customers)} customers, "
        f"{len(orders)} orders to {DATA_DIR}"
    )


if __name__ == "__main__":
    main()
