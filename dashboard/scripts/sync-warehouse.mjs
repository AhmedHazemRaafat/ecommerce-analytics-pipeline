import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dashboardRoot = path.resolve(__dirname, "..");
const dest = path.join(dashboardRoot, "data", "warehouse.duckdb");
const sources = [
  path.join(dashboardRoot, "data", "warehouse.duckdb"),
  path.resolve(dashboardRoot, "..", "data", "warehouse.duckdb"),
];

const source = sources.find((candidate) => fs.existsSync(candidate));

if (!source) {
  console.warn(
    "sync-warehouse: no warehouse.duckdb found. Run seed + pipeline from repo root first.",
  );
  process.exit(0);
}

if (path.resolve(source) === path.resolve(dest)) {
  console.log(`sync-warehouse: using ${dest}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(source, dest);
console.log(`sync-warehouse: copied ${source} -> ${dest}`);
