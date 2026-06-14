#!/usr/bin/env python3
"""Daily ETL pipeline: extract raw data, load DuckDB, run dbt, check alerts."""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data" / "raw"
WAREHOUSE_PATH = ROOT / "data" / "warehouse.duckdb"
DBT_DIR = ROOT / "dbt"
STATE_FILE = ROOT / "data" / "pipeline_state.json"
LOG_DIR = ROOT / "data" / "logs"

MAX_RETRIES = 3
RETRY_DELAY_SECONDS = 5
REVENUE_DROP_THRESHOLD = 0.30

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("pipeline")


def retry(fn, description: str):
    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info("%s (attempt %d/%d)", description, attempt, MAX_RETRIES)
            return fn()
        except Exception as exc:
            last_error = exc
            logger.warning("%s failed on attempt %d: %s", description, attempt, exc)
            if attempt < MAX_RETRIES:
                time.sleep(RETRY_DELAY_SECONDS)
    raise RuntimeError(f"{description} failed after {MAX_RETRIES} attempts") from last_error


def load_state() -> dict:
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"last_extract_at": None, "processed_files": {}}


def save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=2))


def extract(state: dict) -> None:
    """Simulate incremental extract from platform API exports."""
    tables = ["orders", "products", "customers"]
    for name in tables:
        path = RAW_DIR / f"{name}.csv"
        if not path.exists():
            raise FileNotFoundError(f"Missing source file: {path}")
        file_mtime = datetime.fromtimestamp(path.stat().st_mtime).isoformat()
        state.setdefault("processed_files", {})[name] = file_mtime
        logger.info("Extracted source file %s (%s bytes)", path.name, path.stat().st_size)

    state["last_extract_at"] = datetime.now().isoformat()


def load_raw_to_duckdb() -> None:
    WAREHOUSE_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect(str(WAREHOUSE_PATH))

    try:
        con.execute("CREATE SCHEMA IF NOT EXISTS raw")

        for table in ("orders", "products", "customers"):
            csv_path = (RAW_DIR / f"{table}.csv").as_posix()
            con.execute(
                f"""
                CREATE OR REPLACE TABLE raw.{table} AS
                SELECT * FROM read_csv_auto('{csv_path}', header=true)
                """
            )
            count = con.execute(f"select count(*) from raw.{table}").fetchone()[0]
            logger.info("Loaded raw.%s (%d rows)", table, count)
    finally:
        con.close()


def resolve_dbt_command() -> list[str]:
    python_dir = Path(sys.executable).resolve().parent
    candidates = [
        python_dir / "Scripts" / "dbt.exe",
        python_dir / "Scripts" / "dbt",
        python_dir / "dbt.exe",
        python_dir / "dbt",
    ]
    for candidate in candidates:
        if candidate.exists():
            return [str(candidate)]
    dbt_on_path = shutil.which("dbt")
    if dbt_on_path:
        return [dbt_on_path]
    raise FileNotFoundError(
        "dbt executable not found. Install requirements.txt and ensure Scripts is on PATH."
    )


def run_transforms_step() -> None:
    """Prefer dbt Core; fall back to native DuckDB SQL on unsupported Python versions."""
    try:
        dbt_cmd = resolve_dbt_command()
        commands = [
            [*dbt_cmd, "run", "--profiles-dir", str(DBT_DIR), "--project-dir", str(DBT_DIR)],
            [*dbt_cmd, "test", "--profiles-dir", str(DBT_DIR), "--project-dir", str(DBT_DIR)],
        ]
        for cmd in commands:
            result = subprocess.run(cmd, cwd=str(DBT_DIR), capture_output=True, text=True)
            if result.returncode != 0:
                raise RuntimeError(result.stderr or result.stdout or "dbt failed")
            logger.info(result.stdout.strip() or f"Completed: {' '.join(cmd)}")
    except Exception as exc:
        logger.warning("dbt unavailable (%s); using DuckDB SQL fallback", exc)
        sys.path.insert(0, str(Path(__file__).parent))
        from run_transforms import run_basic_tests, run_transforms

        run_transforms(WAREHOUSE_PATH)
        run_basic_tests(WAREHOUSE_PATH)


def check_revenue_alert() -> None:
    con = duckdb.connect(str(WAREHOUSE_PATH), read_only=True)
    try:
        rows = con.execute(
            """
            select date, revenue
            from main_marts.mart_daily_revenue
            where date <= current_date
            order by date desc
            limit 2
            """
        ).fetchall()

        if len(rows) < 2:
            logger.info("Not enough history for revenue alert check")
            return

        today_date, today_revenue = rows[0]
        _, yesterday_revenue = rows[1]

        if yesterday_revenue and yesterday_revenue > 0:
            drop_pct = (yesterday_revenue - today_revenue) / yesterday_revenue
            if drop_pct >= REVENUE_DROP_THRESHOLD:
                msg = (
                    f"ALERT: Daily revenue dropped {drop_pct * 100:.1f}% "
                    f"({yesterday_revenue:.2f} -> {today_revenue:.2f}) on {today_date}"
                )
                logger.warning(msg)
                LOG_DIR.mkdir(parents=True, exist_ok=True)
                with (LOG_DIR / "alerts.log").open("a", encoding="utf-8") as f:
                    f.write(f"{datetime.now().isoformat()} {msg}\n")
            else:
                logger.info("Revenue alert check passed (drop: %.1f%%)", drop_pct * 100)
    finally:
        con.close()


def run_pipeline() -> None:
    logger.info("Starting e-commerce analytics pipeline")
    state = load_state()

    retry(lambda: extract(state), "Extract")
    save_state(state)
    retry(load_raw_to_duckdb, "Load raw to DuckDB")
    retry(run_transforms_step, "Transform")
    retry(check_revenue_alert, "Revenue alert check")

    logger.info("Pipeline completed successfully")


if __name__ == "__main__":
    run_pipeline()
