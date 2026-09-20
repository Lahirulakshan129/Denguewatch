"""Fill missing weekly weather in the final Excel from Open-Meteo.

Fills every district-week that already exists in the sheet, has empty weather,
and has fully observed dates (no future days).
"""
from __future__ import annotations

import json
import math
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

import pandas as pd

SRC = Path(r"e:\Downloads\weather_dengue_population_merged_Final.xlsx")
OUT_DOWNLOADS = SRC
OUT_PROJECT = Path(r"e:\WebDashboard\Data\final sheet\weather_dengue_population_merged_Final.xlsx")

DISTRICTS: dict[str, tuple[float, float]] = {
    "Jaffna": (9.6615, 80.0255),
    "Kilinochchi": (9.3803, 80.377),
    "Mannar": (8.981, 79.9044),
    "Vavuniya": (8.7542, 80.4982),
    "Mullaitivu": (9.2671, 80.8142),
    "Trincomalee": (8.5711, 81.2335),
    "Batticaloa": (7.7102, 81.6924),
    "Ampara": (7.2912, 81.6724),
    "Hambantota": (6.1248, 81.1185),
    "Matara": (6.0535, 80.5353),
    "Galle": (6.0328, 80.215),
    "Ratnapura": (6.7056, 80.3847),
    "Monaragala": (6.8728, 81.3507),
    "Badulla": (6.9819, 81.0556),
    "Nuwara Eliya": (6.9497, 80.7837),
    "Kandy": (7.2906, 80.6337),
    "Matale": (7.4675, 80.6234),
    "Kurunegala": (7.4818, 80.3609),
    "Puttalam": (8.0362, 79.8283),
    "Anuradhapura": (8.3114, 80.4168),
    "Polonnaruwa": (7.9403, 81.0188),
    "Kegalle": (7.2513, 80.3464),
    "Kalutara": (6.5854, 79.9607),
    "Gampaha": (7.084, 80.0098),
    "Colombo": (6.9271, 79.8612),
    "Kalmunai": (7.4167, 81.8333),
}

DAILY_VARS = ",".join(
    [
        "temperature_2m_mean",
        "temperature_2m_max",
        "temperature_2m_min",
        "relative_humidity_2m_mean",
        "precipitation_sum",
        "wind_speed_10m_mean",
    ]
)


def get_json(url: str, retries: int = 2, timeout: int = 20) -> dict:
    last_err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "DengueWatch/1.0"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return json.load(resp)
        except Exception as err:
            last_err = err
            time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(f"Failed {url}: {last_err}")


def _parse_daily(payload: dict) -> dict[str, dict]:
    daily = payload.get("daily") or {}
    times = daily.get("time") or []
    out: dict[str, dict] = {}
    for i, day in enumerate(times):
        tmean = (daily.get("temperature_2m_mean") or [None])[i] if i < len(daily.get("temperature_2m_mean") or []) else None
        if tmean is None:
            continue
        out[day] = {
            "tmean": tmean,
            "tmax": (daily.get("temperature_2m_max") or [None] * (i + 1))[i],
            "tmin": (daily.get("temperature_2m_min") or [None] * (i + 1))[i],
            "hum": (daily.get("relative_humidity_2m_mean") or [None] * (i + 1))[i],
            "precip": (daily.get("precipitation_sum") or [None] * (i + 1))[i],
            "wind": (daily.get("wind_speed_10m_mean") or [None] * (i + 1))[i],
        }
    return out


def _fetch_range(lat: float, lon: float, start: str, end: str, host: str) -> dict[str, dict]:
    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start,
        "end_date": end,
        "daily": DAILY_VARS,
        "timezone": "Asia/Colombo",
    }
    query = urllib.parse.urlencode(params)
    return _parse_daily(get_json(f"{host}?{query}"))


def fetch_daily(lat: float, lon: float, start: str, end: str) -> dict[str, dict]:
    """Return {YYYY-MM-DD: metrics} using forecast for recent days, archive for older."""
    start_d = datetime.strptime(start, "%Y-%m-%d").date()
    end_d = datetime.strptime(end, "%Y-%m-%d").date()
    forecast_start = max(start_d, end_d - timedelta(days=90))
    out: dict[str, dict] = {}
    errors: list[str] = []

    if forecast_start <= end_d:
        try:
            out.update(
                _fetch_range(
                    lat,
                    lon,
                    forecast_start.isoformat(),
                    end_d.isoformat(),
                    "https://api.open-meteo.com/v1/forecast",
                )
            )
        except Exception as err:
            errors.append(f"forecast: {err}")

    archive_end = end_d
    if start_d < forecast_start:
        archive_end = forecast_start - timedelta(days=1)
    # Forecast history is ~90 days; pull archive for anything still missing.
    if start_d <= archive_end or not _range_complete(out, start, end):
        try:
            out.update(
                _fetch_range(
                    lat,
                    lon,
                    start_d.isoformat(),
                    archive_end.isoformat() if start_d < forecast_start else end_d.isoformat(),
                    "https://archive-api.open-meteo.com/v1/archive",
                )
            )
        except Exception as err:
            errors.append(f"archive: {err}")

    if not out:
        raise RuntimeError(f"No daily weather for {lat},{lon} {start}->{end}: {errors}")
    return out


def _range_complete(days: dict[str, dict], start: str, end: str) -> bool:
    cur = datetime.strptime(start, "%Y-%m-%d").date()
    last = datetime.strptime(end, "%Y-%m-%d").date()
    while cur <= last:
        if cur.isoformat() not in days:
            return False
        cur += timedelta(days=1)
    return True


def mean(vals: list[float | None]) -> float | None:
    nums = [v for v in vals if v is not None and not (isinstance(v, float) and math.isnan(v))]
    if not nums:
        return None
    return sum(nums) / len(nums)


def aggregate_week(days: list[dict]) -> dict | None:
    tmeans = [d["tmean"] for d in days]
    if all(v is None for v in tmeans):
        return None
    precip = [d["precip"] for d in days]
    return {
        "avg_temp": mean(tmeans),
        "max_temp": max(v for v in tmeans if v is not None),
        "min_temp": min(v for v in tmeans if v is not None),
        "avg_humidity": mean([d["hum"] for d in days]),
        "total_precip": sum(v or 0 for v in precip),
        "avg_windspeed": mean([d["wind"] for d in days]),
        "days_count": float(sum(1 for v in tmeans if v is not None)),
        "rainy_days": float(sum(1 for v in precip if v is not None and v > 0)),
    }


def main() -> int:
    print("Loading workbook...", flush=True)
    df = pd.read_excel(SRC)
    df["date_week_start"] = pd.to_datetime(df["date_week_start"])
    today = date.today()
    print(f"Loaded {len(df)} rows from {SRC.name}; today={today.isoformat()}")

    missing = df[df["avg_temp"].isna()].copy()
    missing["week_end"] = missing["date_week_start"].dt.date + timedelta(days=6)
    fillable = missing[missing["week_end"] <= today]
    print(
        f"Missing weather rows={len(missing)}; fillable (week fully observed)={len(fillable)}; "
        f"weeks={sorted(fillable['year_week'].unique().tolist())}"
    )
    if fillable.empty:
        print("Nothing to fill.")
        return 0

    unknown = sorted(set(fillable["district"]) - set(DISTRICTS))
    if unknown:
        raise SystemExit(f"No coordinates for districts: {unknown}")

    print(f"Fetching Open-Meteo for {fillable['district'].nunique()} districts...", flush=True)

    cache: dict[str, dict[str, dict]] = {}
    errors = []
    for district in sorted(fillable["district"].unique()):
        lat, lon = DISTRICTS[district]
        dsub = fillable[fillable["district"] == district]
        d_start = dsub["date_week_start"].min().date()
        d_end = dsub["week_end"].max()
        try:
            cache[district] = fetch_daily(lat, lon, d_start.isoformat(), d_end.isoformat())
            print(f"  {district}: {len(cache[district])} days ({d_start} -> {d_end})", flush=True)
        except Exception as err:
            errors.append(f"{district}: {err}")
            print(f"  FAIL {district}: {err}", flush=True)
        time.sleep(0.1)

    filled = 0
    skipped_future = 0
    skipped_nodata = 0
    weather_cols = [
        "avg_temp",
        "max_temp",
        "min_temp",
        "avg_humidity",
        "total_precip",
        "avg_windspeed",
        "days_count",
        "rainy_days",
    ]

    for idx, row in fillable.iterrows():
        district = row["district"]
        start_d: date = row["date_week_start"].date()
        days = []
        complete = True
        for offset in range(7):
            key = (start_d + timedelta(days=offset)).isoformat()
            rec = cache.get(district, {}).get(key)
            if rec is None or rec.get("tmean") is None:
                complete = False
                break
            days.append(rec)
        if not complete:
            skipped_nodata += 1
            continue
        metrics = aggregate_week(days)
        if not metrics:
            skipped_nodata += 1
            continue
        for col in weather_cols:
            df.at[idx, col] = metrics[col]
        filled += 1

    print(
        f"Filled={filled} skipped_nodata={skipped_nodata} skipped_future={skipped_future} fetch_errors={len(errors)}"
    )
    if errors:
        print("Fetch errors:", errors)

    OUT_DOWNLOADS.parent.mkdir(parents=True, exist_ok=True)
    OUT_PROJECT.parent.mkdir(parents=True, exist_ok=True)
    df.to_excel(OUT_DOWNLOADS, index=False)
    df.to_excel(OUT_PROJECT, index=False)

    still = df[df["avg_temp"].isna()]
    still_obs = still[pd.to_datetime(still["date_week_start"]).dt.date + timedelta(days=6) <= today]
    print(f"Wrote {OUT_DOWNLOADS}")
    print(f"Wrote {OUT_PROJECT}")
    print(
        f"Remaining missing weather={len(still)} "
        f"(of which already-elapsed weeks={len(still_obs)})"
    )
    if len(still):
        print("Remaining year_weeks:", sorted(still["year_week"].unique().tolist()))

    # Show a sample of newly filled Aug-Sep rows
    sample = df[
        df["year_week"].isin(["2026_32", "2026_36", "2026_38"])
        & (df["district"] == "Colombo")
    ][
        [
            "year_week",
            "date_week_start",
            "district",
            "avg_temp",
            "max_temp",
            "min_temp",
            "avg_humidity",
            "total_precip",
            "avg_windspeed",
            "days_count",
            "rainy_days",
            "actual_dengue_cases",
        ]
    ]
    print("Colombo sample after fill:")
    print(sample.to_string(index=False))
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
