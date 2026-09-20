"""Compare ML one-step predictions vs actuals under a few feature setups."""
from __future__ import annotations

import json
import os
import sys
import urllib.request

import psycopg2

ML_URL = os.environ.get("ML_SERVICE_URL", "http://localhost:8000").rstrip("/")
DB = {
    "host": "127.0.0.1",
    "port": 5432,
    "user": "postgres",
    "password": "postgres",
    "dbname": "denguewatch",
}


def predict(records):
    payload = json.dumps({"dryRun": True, "records": records}).encode()
    req = urllib.request.Request(
        f"{ML_URL}/predict",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        data = json.loads(resp.read().decode())
    return {p["district"]: p for p in data.get("predictions") or []}


def main():
    conn = psycopg2.connect(**DB)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT year, week, district, avg_temp, avg_humidity, total_rainfall,
               avg_windspeed, dengue_cases, max_temp, min_temp, rainy_days,
               population_density, district_id
        FROM dataset_record
        WHERE avg_temp IS NOT NULL AND dengue_cases IS NOT NULL
          AND (year < 2026 OR (year = 2026 AND week <= 34))
        ORDER BY district, year, week
        """
    )
    cols = [
        "year", "week", "district", "avg_temp", "avg_humidity", "total_rainfall",
        "avg_windspeed", "dengue_cases", "max_temp", "min_temp", "rainy_days",
        "population_density", "district_id",
    ]
    rows = [dict(zip(cols, r)) for r in cur.fetchall()]
    cur.close()
    conn.close()

    by_key = {(r["district"], r["year"], r["week"]): r for r in rows}
    districts = sorted({r["district"] for r in rows})

    print("district week actual pred12 pred_full", flush=True)
    for week in range(26, 35):
        rec12 = [
            r for r in rows
            if r["year"] == 2026 and week - 12 <= r["week"] <= week - 1
        ]
        rec_full = [
            r for r in rows
            if r["year"] < 2026 or (r["year"] == 2026 and r["week"] <= week - 1)
        ]
        p12 = predict(rec12)
        pfull = predict(rec_full)
        for d in ["Colombo", "Gampaha", "Kandy", "Galle", "Jaffna"]:
            actual = by_key.get((d, 2026, week), {}).get("dengue_cases")
            a = p12.get(d, {})
            b = pfull.get(d, {})
            print(
                f"{d:12} {week:2} {actual} "
                f"{a.get('predicted_cases')}(w{a.get('predicted_week')}) "
                f"{b.get('predicted_cases')}(w{b.get('predicted_week')})",
                flush=True,
            )


if __name__ == "__main__":
    sys.exit(main())
