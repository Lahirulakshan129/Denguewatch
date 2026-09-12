"""Load Data/final sheet/weather_dengue_population_merged.xlsx into dataset_record."""
import math
import os
import sys

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

XLSX = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "Data", "final sheet", "weather_dengue_population_merged.xlsx")
)
OUT_CSV = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "training_dataset.csv"))

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


def main():
    if not os.path.exists(XLSX):
        print(f"Missing workbook: {XLSX}")
        return 1

    df = pd.read_excel(XLSX)
    parts = df["year_week"].astype(str).str.split("_", n=1, expand=True)
    df["year"] = parts[0].astype(int)
    df["week"] = parts[1].astype(int)

    out = pd.DataFrame({
        "Year": df["year"],
        "Week": df["week"],
        "District": df["district"],
        "Avg_Temp": df["avg_temp"],
        "Avg_Humidity": df["avg_humidity"],
        "Total_Rainfall": df["total_precip"],
        "Avg_Windspeed": df["avg_windspeed"],
        "Dengue_Cases": df["dengue_cases"],
        "Max_Temp": df["max_temp"],
        "Min_Temp": df["min_temp"],
        "Rainy_Days": df["rainy_days"],
        "Population_Density": df["population_density"],
        "District_Id": df["district_id"],
        "Year_Week": df["year_week"],
    })
    os.makedirs(os.path.dirname(OUT_CSV), exist_ok=True)
    out.to_csv(OUT_CSV, index=False)
    print(f"Wrote {len(out)} rows to {OUT_CSV}")

    conn = psycopg2.connect(**DB)
    cur = conn.cursor()
    for stmt in [
        "ALTER TABLE dataset_record ADD COLUMN IF NOT EXISTS max_temp double precision",
        "ALTER TABLE dataset_record ADD COLUMN IF NOT EXISTS min_temp double precision",
        "ALTER TABLE dataset_record ADD COLUMN IF NOT EXISTS rainy_days double precision",
        "ALTER TABLE dataset_record ADD COLUMN IF NOT EXISTS population_density double precision",
        "ALTER TABLE dataset_record ADD COLUMN IF NOT EXISTS district_id integer",
    ]:
        cur.execute(stmt)

    rows = []
    for r in df.itertuples(index=False):
        rows.append((
            int(r.year),
            int(r.week),
            str(r.district),
            nan_none(r.avg_temp),
            nan_none(r.avg_humidity),
            nan_none(r.total_precip),
            nan_none(r.avg_windspeed),
            None if nan_none(r.dengue_cases) is None else int(r.dengue_cases),
            nan_none(r.max_temp),
            nan_none(r.min_temp),
            nan_none(r.rainy_days),
            nan_none(r.population_density),
            None if nan_none(r.district_id) is None else int(r.district_id),
        ))

    execute_values(
        cur,
        """
        INSERT INTO dataset_record
          (year, week, district, avg_temp, avg_humidity, total_rainfall, avg_windspeed,
           dengue_cases, max_temp, min_temp, rainy_days, population_density, district_id)
        VALUES %s
        ON CONFLICT (year, week, district) DO UPDATE SET
          avg_temp = EXCLUDED.avg_temp,
          avg_humidity = EXCLUDED.avg_humidity,
          total_rainfall = EXCLUDED.total_rainfall,
          avg_windspeed = EXCLUDED.avg_windspeed,
          dengue_cases = EXCLUDED.dengue_cases,
          max_temp = EXCLUDED.max_temp,
          min_temp = EXCLUDED.min_temp,
          rainy_days = EXCLUDED.rainy_days,
          population_density = EXCLUDED.population_density,
          district_id = EXCLUDED.district_id
        """,
        rows,
        page_size=500,
    )
    conn.commit()
    cur.execute("SELECT COUNT(*), COUNT(DISTINCT district), MIN(year), MAX(year) FROM dataset_record")
    print("DB dataset_record:", cur.fetchone())
    cur.close()
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
