import argparse
import json
import math
import os
from datetime import date

import pandas as pd


def read_csv(path):
    if not path or not os.path.exists(path):
        return pd.DataFrame()
    df = pd.read_csv(path)
    df.columns = [c.strip().lower() for c in df.columns]
    return df


def iso_week_plus_one(year, week):
    year = int(year)
    week = int(week) + 1
    if week > 52:
        return year + 1, 1
    return year, week


def risk_multiplier(temp, humidity, rain):
    score = 1.0
    if 26 <= temp <= 32:
        score += 0.25
    if humidity >= 80:
        score += 0.2
    elif humidity >= 70:
        score += 0.1
    if rain >= 25:
        score += 0.2
    elif rain >= 10:
        score += 0.1
    return score


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--weather-csv", required=True)
    parser.add_argument("--dengue-csv", required=True)
    parser.add_argument("--model-path", default="")
    parser.add_argument("--output-csv", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    weather = read_csv(args.weather_csv)
    dengue = read_csv(args.dengue_csv)

    if weather.empty and dengue.empty:
        print("PREDICTION_ERROR: no weather or dengue CSV data")
        return 1

    districts = set()
    if "district" in weather.columns:
        districts.update(weather["district"].dropna().astype(str))
    if "district" in dengue.columns:
        districts.update(dengue["district"].dropna().astype(str))

    rows = []
    today = date.today()
    default_year, default_week = today.isocalendar()[0], today.isocalendar()[1]

    for district in sorted(districts):
        w = weather[weather["district"].astype(str) == district] if not weather.empty else pd.DataFrame()
        d = dengue[dengue["district"].astype(str) == district] if not dengue.empty else pd.DataFrame()

        latest_w = w.iloc[-1] if not w.empty else None
        latest_d = d.iloc[-1] if not d.empty else None

        year = default_year
        week = default_week
        if latest_w is not None and "year" in latest_w and "week" in latest_w:
            year, week = iso_week_plus_one(latest_w["year"], latest_w["week"])
        elif latest_d is not None and "year" in latest_d and "week" in latest_d:
            year, week = iso_week_plus_one(latest_d["year"], latest_d["week"])

        cases = 0.0
        if latest_d is not None:
            cases = float(latest_d.get("cases", 0) or 0)
        elif not d.empty and "cases" in d.columns:
            cases = float(d["cases"].astype(float).mean())

        temp = float(latest_w.get("avg_temp", 28) or 28) if latest_w is not None else 28.0
        hum = float(latest_w.get("humidity", latest_w.get("avg_humidity", 75)) or 75) if latest_w is not None else 75.0
        rain = float(latest_w.get("precipitation", latest_w.get("total_rainfall", 10)) or 10) if latest_w is not None else 10.0

        predicted = max(0, int(round(cases * risk_multiplier(temp, hum, rain))))
        spread = max(2, int(round(math.sqrt(predicted + 1) * 2)))
        rows.append({
            "district": district,
            "predicted_cases": predicted,
            "confidence_low": max(0, predicted - spread),
            "confidence_high": predicted + spread,
            "predicted_week": week,
            "predicted_year": year,
        })

    if not args.dry_run:
        os.makedirs(os.path.dirname(os.path.abspath(args.output_csv)) or ".", exist_ok=True)
        existing = read_csv(args.output_csv)
        out = pd.DataFrame(rows)
        if not existing.empty:
            out = pd.concat([existing, out], ignore_index=True)
        out.to_csv(args.output_csv, index=False)

    result = {
        "success": True,
        "district_count": len(rows),
        "dry_run": args.dry_run,
        "predictions": rows,
    }
    print("PREDICTION_RESULT:" + json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
