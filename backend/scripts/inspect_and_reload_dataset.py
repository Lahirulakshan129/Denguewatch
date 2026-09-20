"""Inspect denguewatch tables, truncate dataset_record, load filled Excel."""
from __future__ import annotations

import math
import os
import sys
from pathlib import Path

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

XLSX_CANDIDATES = [
    Path(r"e:\Downloads\weather_dengue_population_merged_Final.xlsx"),
    Path(r"e:\WebDashboard\Data\final sheet\weather_dengue_population_merged_Final.xlsx"),
]
OUT_CSV = Path(r"e:\WebDashboard\backend\data\training_dataset.csv")
WEATHER_CSV = Path(r"e:\WebDashboard\backend\data\weekly_weather.csv")
DENGUE_CSV = Path(r"e:\WebDashboard\backend\data\dengue_counts.csv")

DB = {
    "host": os.environ.get("DB_HOST", "127.0.0.1"),
    "port": int(os.environ.get("DB_PORT", "5432")),
    "user": os.environ.get("DB_USER", "postgres"),
    "password": os.environ.get("DB_PASSWORD", "postgres"),
    "dbname": os.environ.get("DB_NAME", "denguewatch"),
}


def nan_none(v):
    if v is None:
        return None
    try:
        if isinstance(v, float) and math.isnan(v):
            return None
    except TypeError:
        pass
    if pd.isna(v):
        return None
    return v


def dengue_value(row):
    for name in ("actual_dengue_cases", "dengue_cases"):
        if hasattr(row, name):
            v = nan_none(getattr(row, name))
            if v is not None:
                return int(v)
    return None


def inspect(cur) -> None:
    cur.execute(
        """
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
        """
    )
    tables = [r[0] for r in cur.fetchall()]
    print("tables:", tables)
    for t in tables:
        cur.execute(f'SELECT COUNT(*) FROM "{t}"')
        print(f"  {t}: {cur.fetchone()[0]} rows")

    cur.execute(
        """
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'dataset_record'
        ORDER BY ordinal_position
        """
    )
    print("dataset_record columns:")
    for r in cur.fetchall():
        print(" ", r)

    cur.execute(
        """
        SELECT conname, pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conrelid = 'dataset_record'::regclass
        """
    )
    print("dataset_record constraints:")
    for r in cur.fetchall():
        print(" ", r)

    cur.execute(
        """
        SELECT COUNT(*), COUNT(DISTINCT district), MIN(year), MAX(year),
               COUNT(avg_temp), COUNT(dengue_cases)
        FROM dataset_record
        """
    )
    print("dataset_record stats:", cur.fetchone())
    cur.execute(
        """
        SELECT year, week, COUNT(*) n, COUNT(avg_temp) has_weather
        FROM dataset_record
        WHERE year = 2026 AND week BETWEEN 25 AND 40
        GROUP BY year, week
        ORDER BY year, week
        """
    )
    print("DB 2026 weeks 25-40:")
    for r in cur.fetchall():
        print(" ", r)


def main() -> int:
    xlsx = next((p for p in XLSX_CANDIDATES if p.exists()), None)
    if not xlsx:
        print("Filled Excel not found")
        return 1
    print("Excel:", xlsx)

    df = pd.read_excel(xlsx)
    parts = df["year_week"].astype(str).str.split("_", n=1, expand=True)
    df["year"] = parts[0].astype(int)
    df["week"] = parts[1].astype(int)
    dengue_col = "actual_dengue_cases" if "actual_dengue_cases" in df.columns else "dengue_cases"
    print(
        "excel rows",
        len(df),
        "weather",
        int(df["avg_temp"].notna().sum()),
        "dengue",
        int(df[dengue_col].notna().sum()),
        "cols",
        list(df.columns),
    )

    conn = psycopg2.connect(**DB)
    cur = conn.cursor()
    print("\n--- before ---")
    inspect(cur)

    for stmt in [
        "ALTER TABLE dataset_record ADD COLUMN IF NOT EXISTS max_temp double precision",
        "ALTER TABLE dataset_record ADD COLUMN IF NOT EXISTS min_temp double precision",
        "ALTER TABLE dataset_record ADD COLUMN IF NOT EXISTS rainy_days double precision",
        "ALTER TABLE dataset_record ADD COLUMN IF NOT EXISTS population_density double precision",
        "ALTER TABLE dataset_record ADD COLUMN IF NOT EXISTS district_id integer",
    ]:
        cur.execute(stmt)

    print("\nTruncating dataset_record ...")
    cur.execute("TRUNCATE TABLE dataset_record RESTART IDENTITY")

    rows = []
    for r in df.itertuples(index=False):
        rows.append(
            (
                int(r.year),
                int(r.week),
                str(r.district),
                nan_none(r.avg_temp),
                nan_none(r.avg_humidity),
                nan_none(r.total_precip),
                nan_none(r.avg_windspeed),
                dengue_value(r),
                nan_none(r.max_temp),
                nan_none(r.min_temp),
                nan_none(r.rainy_days),
                nan_none(r.population_density),
                None if nan_none(r.district_id) is None else int(r.district_id),
            )
        )

    execute_values(
        cur,
        """
        INSERT INTO dataset_record
          (year, week, district, avg_temp, avg_humidity, total_rainfall, avg_windspeed,
           dengue_cases, max_temp, min_temp, rainy_days, population_density, district_id)
        VALUES %s
        """,
        rows,
        page_size=500,
    )
    conn.commit()

    print("\n--- after ---")
    inspect(cur)
    cur.execute(
        """
        SELECT year, week, district, avg_temp, total_rainfall, dengue_cases
        FROM dataset_record
        WHERE year = 2026 AND week = 32 AND district = 'Colombo'
        """
    )
    print("Colombo 2026_32:", cur.fetchone())
    cur.execute(
        """
        SELECT year, week, COUNT(*) n, COUNT(avg_temp) has_weather, COUNT(dengue_cases) has_dengue
        FROM dataset_record
        WHERE year = 2026 AND week BETWEEN 32 AND 40
        GROUP BY year, week
        ORDER BY week
        """
    )
    print("Aug-Sep weeks:")
    for r in cur.fetchall():
        print(" ", r)

    cur.close()
    conn.close()

    out = pd.DataFrame(
        {
            "Year": df["year"],
            "Week": df["week"],
            "District": df["district"],
            "Avg_Temp": df["avg_temp"],
            "Avg_Humidity": df["avg_humidity"],
            "Total_Rainfall": df["total_precip"],
            "Avg_Windspeed": df["avg_windspeed"],
            "Dengue_Cases": df[dengue_col],
            "Max_Temp": df["max_temp"],
            "Min_Temp": df["min_temp"],
            "Rainy_Days": df["rainy_days"],
            "Population_Density": df["population_density"],
            "District_Id": df["district_id"],
            "Year_Week": df["year_week"],
        }
    )
    OUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(OUT_CSV, index=False)
    print(f"Wrote {len(out)} rows to {OUT_CSV}")

    weather = df[df["avg_temp"].notna()][["year", "week", "district", "avg_temp", "avg_humidity", "total_precip", "avg_windspeed"]]
    weather.to_csv(WEATHER_CSV, index=False, header=["year", "week", "district", "avg_temp", "humidity", "precipitation", "wind_speed"])
    print(f"Wrote {len(weather)} rows to {WEATHER_CSV}")

    dengue = df[df[dengue_col].notna()][["district", "week", "year", dengue_col]]
    dengue.to_csv(DENGUE_CSV, index=False, header=["district", "week", "year", "cases"])
    print(f"Wrote {len(dengue)} rows to {DENGUE_CSV}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
