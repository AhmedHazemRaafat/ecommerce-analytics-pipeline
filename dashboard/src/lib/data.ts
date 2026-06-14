import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "public", "data");

export type DailyRevenueRow = {
  date: string;
  revenue: number;
  orders: number;
  avg_order_value: number;
  new_customers: number;
};

export type ProductRow = {
  product_id: number;
  name: string;
  category: string;
  total_revenue: number;
  units_sold: number;
  return_rate: number;
};

export type ProductOrderItem = {
  product_id: number;
  name: string;
  category: string;
  order_date: string;
  line_revenue: number;
  quantity: number;
  is_returned: number;
};

export type CohortRow = {
  cohort_month: string;
  months_since_signup: number;
  retention_rate: number;
  avg_revenue: number;
};

export type CustomerOrderItem = {
  customer_id: number;
  order_date: string;
};

export type CountryRow = {
  country: string;
  country_name: string;
  revenue: number;
  orders: number;
  avg_order_value: number;
};

export type GeoOrderItem = {
  country: string;
  country_name: string;
  order_id: number;
  order_date: string;
  line_revenue: number;
};

export async function readDataFile<T>(name: string): Promise<T> {
  const filePath = path.join(DATA_DIR, `${name}.json`);
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export function normalizeDate(value: string): string {
  return value.slice(0, 10);
}

export function inDateRange(
  date: string,
  startDate?: string | null,
  endDate?: string | null,
): boolean {
  const normalized = normalizeDate(date);
  if (startDate && normalized < startDate) return false;
  if (endDate && normalized > endDate) return false;
  return true;
}

export function filterByDateRange<T extends { date: string }>(
  rows: T[],
  startDate?: string | null,
  endDate?: string | null,
): T[] {
  if (!startDate && !endDate) return rows;
  return rows.filter((row) => inDateRange(row.date, startDate, endDate));
}

export function filterOrderItemsByDate<T extends { order_date: string }>(
  rows: T[],
  startDate?: string | null,
  endDate?: string | null,
): T[] {
  if (!startDate && !endDate) return rows;
  return rows.filter((row) => inDateRange(row.order_date, startDate, endDate));
}

export function groupDailyRevenueByMonth(rows: DailyRevenueRow[]) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const month = normalizeDate(row.date).slice(0, 7) + "-01";
    totals.set(month, (totals.get(month) ?? 0) + row.revenue);
  }

  return Array.from(totals.entries())
    .map(([month, revenue]) => ({ month, revenue }))
    .sort((a, b) => b.month.localeCompare(a.month));
}

export function sumDailyRevenueTotals(rows: DailyRevenueRow[]) {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const orders = rows.reduce((sum, row) => sum + row.orders, 0);
  const newCustomers = rows.reduce((sum, row) => sum + row.new_customers, 0);

  return {
    revenue,
    orders,
    avg_order_value: orders > 0 ? revenue / orders : 0,
    new_customers: newCustomers,
  };
}

export function buildRevenueSeries(rows: DailyRevenueRow[]) {
  return rows.map((row, index) => {
    const window = rows.slice(Math.max(0, index - 6), index + 1);
    const count = window.length;

    return {
      date: row.date,
      revenue: row.revenue,
      orders: row.orders,
      avg_order_value: row.avg_order_value,
      ma7_revenue: window.reduce((sum, item) => sum + item.revenue, 0) / count,
      ma7_orders: window.reduce((sum, item) => sum + item.orders, 0) / count,
      ma7_aov:
        window.reduce((sum, item) => sum + item.avg_order_value, 0) / count,
    };
  });
}

export function aggregateProductsFromOrderItems(items: ProductOrderItem[]) {
  const grouped = new Map<
    number,
    ProductRow & { _returns: number; _count: number }
  >();

  for (const item of items) {
    const existing = grouped.get(item.product_id);
    if (!existing) {
      grouped.set(item.product_id, {
        product_id: item.product_id,
        name: item.name,
        category: item.category,
        total_revenue: item.line_revenue,
        units_sold: item.quantity,
        return_rate: 0,
        _returns: item.is_returned,
        _count: 1,
      });
      continue;
    }

    existing.total_revenue += item.line_revenue;
    existing.units_sold += item.quantity;
    existing._returns += item.is_returned;
    existing._count += 1;
  }

  return Array.from(grouped.values())
    .map(({ _returns, _count, total_revenue, ...product }) => ({
      ...product,
      total_revenue: Math.round(total_revenue * 100) / 100,
      return_rate: _count > 0 ? Math.round((_returns / _count) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.total_revenue - a.total_revenue);
}

export function aggregateCategoriesFromOrderItems(items: ProductOrderItem[]) {
  const totals = new Map<string, number>();

  for (const item of items) {
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.line_revenue);
  }

  return Array.from(totals.entries())
    .map(([category, revenue]) => ({
      category,
      revenue: Math.round(revenue * 100) / 100,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function aggregateReturnsFromOrderItems(items: ProductOrderItem[]) {
  const grouped = new Map<string, { returns: number; count: number }>();

  for (const item of items) {
    const existing = grouped.get(item.category) ?? { returns: 0, count: 0 };
    existing.returns += item.is_returned;
    existing.count += 1;
    grouped.set(item.category, existing);
  }

  return Array.from(grouped.entries())
    .map(([category, stats]) => ({
      category,
      return_rate:
        stats.count > 0
          ? Math.round((stats.returns / stats.count) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => b.return_rate - a.return_rate);
}

export function aggregateCategoryTotals(products: ProductRow[]) {
  const totals = new Map<string, number>();

  for (const product of products) {
    totals.set(
      product.category,
      (totals.get(product.category) ?? 0) + product.total_revenue,
    );
  }

  return Array.from(totals.entries())
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function aggregateReturnsFromProducts(products: ProductRow[]) {
  const grouped = new Map<string, { total: number; count: number }>();

  for (const product of products) {
    const existing = grouped.get(product.category) ?? { total: 0, count: 0 };
    existing.total += product.return_rate;
    existing.count += 1;
    grouped.set(product.category, existing);
  }

  return Array.from(grouped.entries())
    .map(([category, stats]) => ({
      category,
      return_rate: stats.count > 0 ? stats.total / stats.count : 0,
    }))
    .sort((a, b) => b.return_rate - a.return_rate);
}

export function buildCustomerTrend(items: CustomerOrderItem[]) {
  const firstOrderByCustomer = new Map<number, string>();

  for (const item of items) {
    const orderDate = normalizeDate(item.order_date);
    const current = firstOrderByCustomer.get(item.customer_id);
    if (!current || orderDate < current) {
      firstOrderByCustomer.set(item.customer_id, orderDate);
    }
  }

  const daily = new Map<string, { new_customers: Set<number>; returning: Set<number> }>();

  for (const item of items) {
    const date = normalizeDate(item.order_date);
    const entry = daily.get(date) ?? {
      new_customers: new Set<number>(),
      returning: new Set<number>(),
    };
    const firstOrder = firstOrderByCustomer.get(item.customer_id);

    if (firstOrder === date) {
      entry.new_customers.add(item.customer_id);
    } else {
      entry.returning.add(item.customer_id);
    }

    daily.set(date, entry);
  }

  return Array.from(daily.entries())
    .map(([date, stats]) => ({
      date,
      new_customers: stats.new_customers.size,
      returning_customers: stats.returning.size,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function aggregateCountriesFromOrderItems(items: GeoOrderItem[]) {
  const grouped = new Map<
    string,
    {
      country_name: string;
      revenue: number;
      orders: Set<number>;
    }
  >();

  for (const item of items) {
    const existing = grouped.get(item.country) ?? {
      country_name: item.country_name,
      revenue: 0,
      orders: new Set<number>(),
    };

    existing.country_name = item.country_name || existing.country_name;
    existing.revenue += item.line_revenue;
    existing.orders.add(item.order_id);
    grouped.set(item.country, existing);
  }

  return Array.from(grouped.entries())
    .map(([country, stats]) => ({
      country,
      country_name: stats.country_name,
      revenue: Math.round(stats.revenue * 100) / 100,
      orders: stats.orders.size,
      avg_order_value:
        stats.orders.size > 0
          ? Math.round((stats.revenue / stats.orders.size) * 100) / 100
          : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}
