"""Walk 2026 weeks 26-39 through the ML service and fill prediction_record."""
from __future__ import annotations

import json
import os
import sys
import time
from datetime import date, timedelta
from pathlib import Path

import psycopg2
import urllib.error
import urllib.request
from psycopg2.extras import execute_values

DB = {
    "host": os.environ.get("DB_HOST", "127.0.0.1"),
    "port": int(os.environ.get("DB_PORT", "5432")),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", "postgres"),
    "dbname": os.environ.get("DB_NAME", "denguewatch"),
}
ML_URL = os.environ.get("ML_SERVICE_URL", "http://localhost:8000").rstrip("/")
PRED_CSV = Path(r"e:\WebDashboard\backend\data\predictions.csv")
HISTORY = 12
START_WEEK = 26
END_YEAR, END_WEEK = 2026, 39  # last weather week is 38, so predict through 39


def prev_weeks(year: int, week: int, n: int):
    d = date.fromisocalendar(year, week, 1)
    out = []
    for i in range(n, 0, -1):
        iso = (d - timedelta(weeks=i)).isocalendar()
        out.append((iso[0], iso[1]))
    return out


def wait_for_ml(timeout=180):
    start = time.time()
    last = None
    while time.time() - start < timeout:
        try:
            with urllib.request.urlopen(f"{ML_URL}/", timeout=5) as resp:
                body = json.loads(resp.read().decode())
                print("ML service:", body, flush=True)
                return True
        except Exception as err:
            last = err
            time.sleep(2)
    raise RuntimeError(f"ML service not reachable at {ML_URL}: {last}")


def predict(records):
    payload = json.dumps({"dryRun": False, "records": records}).encode()
    req = urllib.request.Request(
        f"{ML_URL}/predict",
        data=payload,
        headers={"Content-Type": "application/json", "User-Agent": "DengueWatch/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as err:
        detail = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"ML predict HTTP {err.code}: {detail}") from err
    rows = data.get("predictions") or []
    if not rows:
        raise RuntimeError(f"ML returned no predictions: {data}")
    return rows, data.get("engine")


def load_dataset(cur):
    cur.execute(
        """
        SELECT year, week, district, avg_temp, avg_humidity, total_rainfall,
               avg_windspeed, dengue_cases, max_temp, min_temp, rainy_days,
               population_density, district_id
        FROM dataset_record
        ORDER BY year, week, district
        """
    )
    rows = {}
    districts = set()
    for r in cur.fetchall():
        key = (r[0], r[1], r[2])
        rows[key] = {
            "year": r[0],
            "week": r[1],
            "district": r[2],
            "avg_temp": r[3],
            "avg_humidity": r[4],
            "total_rainfall": r[5],
            "avg_windspeed": r[6],
            "dengue_cases": r[7],
            "max_temp": r[8],
            "min_temp": r[9],
            "rainy_days": r[10],
            "population_density": r[11],
            "district_id": r[12],
        }
        districts.add(r[2])
    return rows, sorted(districts)


def main() -> int:
    print(f"Waiting for ML service at {ML_URL} ...", flush=True)
    wait_for_ml()

    conn = psycopg2.connect(**DB)
    cur = conn.cursor()
    dataset, districts = load_dataset(cur)
    print(f"Loaded {len(dataset)} dataset rows, {len(districts)} districts", flush=True)

    predicted_cases = {}  # (district, year, week) -> cases
    all_preds = []
    engine = None

    for target_week in range(START_WEEK, END_WEEK + 1):
        history = prev_weeks(2026, target_week, HISTORY)
        records = []
        missing_weather = 0
        for district in districts:
            for year, week in history:
                row = dataset.get((year, week, district))
                if not row or row["avg_temp"] is None:
                    missing_weather += 1
                    continue
                dengue = row["dengue_cases"]
                if dengue is None:
                    dengue = predicted_cases.get((district, year, week))
                rec = dict(row)
                rec["dengue_cases"] = dengue
                records.append(rec)
        if missing_weather:
            print(f"  W{target_week}: skipped {missing_weather} district-weeks without weather", flush=True)
        print(f"Predicting 2026-W{target_week} with {len(records)} history rows ...", flush=True)
        rows, engine = predict(records)
        kept = 0
        for p in rows:
            year = int(p["predicted_year"])
            week = int(p["predicted_week"])
            if year != 2026 or week != target_week:
                # Keep only the week we asked for; model always emits next(last history week)
                continue
            district = p["district"]
            cases = int(p["predicted_cases"] or 0)
            predicted_cases[(district, year, week)] = cases
            all_preds.append(
                (
                    district,
                    year,
                    week,
                    cases,
                    None if p.get("confidence_low") is None else int(p["confidence_low"]),
                    None if p.get("confidence_high") is None else int(p["confidence_high"]),
                    False,
                )
            )
            kept += 1
        sample = [p for p in rows if p.get("district") == "Colombo"]
        print(f"  engine={engine} kept={kept} Colombo={sample[0] if sample else None}", flush=True)
        if kept == 0:
            print("  WARNING: model did not return the target week", flush=True)

    print(f"\nTruncating prediction_record and inserting {len(all_preds)} rows ...", flush=True)
    cur.execute("TRUNCATE TABLE prediction_record RESTART IDENTITY")
    execute_values(
        cur,
        """
        INSERT INTO prediction_record
          (district, predicted_year, predicted_week, predicted_cases,
           confidence_low, confidence_high, fallback, "generatedAt")
        VALUES %s
        """,
        [(*row, date.today()) for row in all_preds],
        page_size=200,
    )
    conn.commit()

    cur.execute(
        """
        SELECT predicted_year, predicted_week, COUNT(*),
               MIN(predicted_cases), MAX(predicted_cases), SUM(predicted_cases)
        FROM prediction_record
        GROUP BY predicted_year, predicted_week
        ORDER BY predicted_year, predicted_week
        """
    )
    print("prediction_record by week:")
    for r in cur.fetchall():
        print(" ", r)
    print("Colombo predictions vs actual:")
    cur.execute(
        """
        SELECT p.predicted_week, p.predicted_cases, d.dengue_cases
        FROM prediction_record p
        LEFT JOIN dataset_record d
          ON d.district = p.district AND d.year = p.predicted_year AND d.week = p.predicted_week
        WHERE p.district = 'Colombo'
        ORDER BY p.predicted_week
        """
    )
    for r in cur.fetchall():
        print(" ", r)
    cur.execute(
        """
        SELECT p.predicted_week,
               SUM(p.predicted_cases) pred,
               SUM(d.dengue_cases) actual
        FROM prediction_record p
        LEFT JOIN dataset_record d
          ON d.district = p.district AND d.year = p.predicted_year AND d.week = p.predicted_week
        GROUP BY p.predicted_week
        ORDER BY p.predicted_week
        """
    )
    print("National predicted vs actual:")
    for r in cur.fetchall():
        print(" ", r)

    cur.close()
    conn.close()

    PRED_CSV.parent.mkdir(parents=True, exist_ok=True)
    lines = ["district,predicted_year,predicted_week,predicted_cases,confidence_low,confidence_high"]
    for district, year, week, cases, lo, hi, _fb in all_preds:
        lines.append(f"{district},{year},{week},{cases},{'' if lo is None else lo},{'' if hi is None else hi}")
    PRED_CSV.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {PRED_CSV}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
