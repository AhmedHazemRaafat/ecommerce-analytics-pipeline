import duckdb from "duckdb";
import path from "path";

const WAREHOUSE_PATH =
  process.env.DUCKDB_PATH ??
  path.resolve(process.cwd(), "..", "data", "warehouse.duckdb");

export function getWarehousePath(): string {
  return WAREHOUSE_PATH;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, sanitizeValue(nested)]),
    );
  }
  return value;
}

function sanitizeRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map((row) => sanitizeValue(row) as T);
}

export async function query<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = new duckdb.Database(WAREHOUSE_PATH, { access_mode: "READ_ONLY" });
  const connection = db.connect();

  try {
    return await new Promise<T[]>((resolve, reject) => {
      connection.all(sql, ...params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(sanitizeRows(rows as T[]));
      });
    });
  } finally {
    connection.close();
    db.close();
  }
}

export function dateFilterClause(
  column: string,
  startDate?: string | null,
  endDate?: string | null,
): string {
  const clauses: string[] = [];
  if (startDate) clauses.push(`${column} >= '${startDate}'`);
  if (endDate) clauses.push(`${column} <= '${endDate}'`);
  return clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
}
