import fs from "fs";
import path from "path";
import * as duckdb from "@duckdb/duckdb-wasm";
import type { Table } from "apache-arrow";

const WAREHOUSE_PATH = process.env.DUCKDB_PATH
  ? path.resolve(process.cwd(), process.env.DUCKDB_PATH)
  : path.resolve(process.cwd(), "data", "warehouse.duckdb");

const DUCKDB_DIST = path.join(
  process.cwd(),
  "node_modules",
  "@duckdb",
  "duckdb-wasm",
  "dist",
);

type InitializedDuckDB = {
  db: duckdb.AsyncDuckDB;
  warehouseFile: string;
};

const globalForDuckDB = globalThis as typeof globalThis & {
  __duckdbInitPromise?: Promise<InitializedDuckDB>;
};

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

function arrowTableToRows<T extends Record<string, unknown>>(table: Table): T[] {
  const rows: T[] = [];
  const columns = table.schema.fields.map((field) => ({
    name: field.name,
    vector: table.getChild(field.name),
  }));

  for (let i = 0; i < table.numRows; i++) {
    const row: Record<string, unknown> = {};
    for (const { name, vector } of columns) {
      row[name] = vector?.get(i);
    }
    rows.push(sanitizeValue(row) as T);
  }

  return rows;
}

async function initializeDuckDB(): Promise<InitializedDuckDB> {
  if (!fs.existsSync(WAREHOUSE_PATH)) {
    throw new Error(
      `Warehouse not found at ${WAREHOUSE_PATH}. Run "npm run sync:warehouse" from dashboard/.`,
    );
  }

  const bundle = await duckdb.selectBundle({
    mvp: {
      mainModule: path.join(DUCKDB_DIST, "duckdb-mvp.wasm"),
      mainWorker: path.join(DUCKDB_DIST, "duckdb-node-mvp.worker.cjs"),
    },
    eh: {
      mainModule: path.join(DUCKDB_DIST, "duckdb-eh.wasm"),
      mainWorker: path.join(DUCKDB_DIST, "duckdb-node-eh.worker.cjs"),
    },
  });

  const worker = await duckdb.createWorker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  const warehouseFile = "warehouse.duckdb";
  await db.registerFileURL(
    warehouseFile,
    path.resolve(WAREHOUSE_PATH),
    duckdb.DuckDBDataProtocol.NODE_FS,
    true,
  );
  await db.open({
    path: warehouseFile,
    accessMode: duckdb.DuckDBAccessMode.READ_ONLY,
    query: {
      castBigIntToDouble: true,
    },
  });

  return { db, warehouseFile };
}

async function getDuckDB(): Promise<InitializedDuckDB> {
  if (!globalForDuckDB.__duckdbInitPromise) {
    globalForDuckDB.__duckdbInitPromise = initializeDuckDB();
  }
  return globalForDuckDB.__duckdbInitPromise;
}

export function getWarehousePath(): string {
  return WAREHOUSE_PATH;
}

export async function query<T extends Record<string, unknown>>(
  sql: string,
): Promise<T[]> {
  const { db } = await getDuckDB();
  const connection = await db.connect();

  try {
    const table = await connection.query(sql);
    return arrowTableToRows<T>(table);
  } finally {
    await connection.close();
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
