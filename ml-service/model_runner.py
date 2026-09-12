import math
import os
from functools import lru_cache

import numpy as np
import pandas as pd
from tensorflow.keras.models import load_model
import joblib

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model")
MODEL_PATH = os.environ.get("MODEL_PATH", os.path.join(MODEL_DIR, "bilstm_improved.keras"))
SCALER_X_PATH = os.environ.get("SCALER_X_PATH", os.path.join(MODEL_DIR, "scaler_X.pkl"))
SCALER_Y_PATH = os.environ.get("SCALER_Y_PATH", os.path.join(MODEL_DIR, "scaler_y.pkl"))

TIMESTEPS = 8
FEATURE_COLS = [
    "population_density", "avg_temp", "max_temp", "min_temp",
    "avg_humidity", "total_precip", "avg_windspeed", "rainy_days",
    "week_sin", "week_cos", "dengue_lag_1", "dengue_lag_4",
    "dengue_roll_mean_4", "dengue_roll_std_4",
]

POPULATION_DENSITY = {
    "Colombo": 3330, "Gampaha": 1711, "Kalutara": 775, "Kandy": 716,
    "Matale": 279, "Nuwara Eliya": 412, "Galle": 658, "Matara": 630,
    "Hambantota": 240, "Jaffna": 611, "Kilinochchi": 92, "Mannar": 85,
    "Vavuniya": 92, "Mullaitivu": 38, "Batticaloa": 210, "Ampara": 150,
    "Trincomalee": 150, "Kurunegala": 360, "Puttalam": 240, "Anuradhapura": 125,
    "Polonnaruwa": 130, "Badulla": 290, "Monaragala": 80, "Ratnapura": 330,
    "Kegalle": 500,
}


@lru_cache(maxsize=1)
def load_artifacts():
    if not os.path.exists(MODEL_PATH) or os.path.getsize(MODEL_PATH) < 1000:
        raise FileNotFoundError(f"Keras model missing or empty: {MODEL_PATH}")
    if not os.path.exists(SCALER_X_PATH) or not os.path.exists(SCALER_Y_PATH):
        raise FileNotFoundError("scaler_X.pkl and scaler_y.pkl must sit next to the model")
    model = load_model(MODEL_PATH)
    scaler_x = joblib.load(SCALER_X_PATH)
    scaler_y = joblib.load(SCALER_Y_PATH)
    return model, scaler_x, scaler_y


def next_week(year: int, week: int):
    """Return (year, week) for the ISO week following (year, week).
    Handles 53-week years correctly via Python date arithmetic."""
    from datetime import date, timedelta
    # Build the Monday of the given ISO week
    d = date.fromisocalendar(year, week, 1)  # Monday = weekday 1
    d_next = d + timedelta(weeks=1)
    iso = d_next.isocalendar()
    return iso[0], iso[1]  # (year, week)


def _num(v, default=0.0):
    try:
        if v is None or v == "":
            return default
        return float(v)
    except (TypeError, ValueError):
        return default


def records_to_frame(records):
    rows = []
    for r in records:
        district = r.get("district")
        if not district:
            continue
        year = int(_num(r.get("year"), 0))
        week = int(_num(r.get("week"), 0))
        temp = _num(r.get("avg_temp"), 28)
        rain = _num(r.get("total_rainfall") or r.get("total_precip"), 0)
        cases = r.get("dengue_cases")
        cases = _num(cases, 0) if cases not in (None, "") else np.nan
        rows.append({
            "district": district,
            "year": year,
            "week": week,
            "population_density": _num(r.get("population_density"), POPULATION_DENSITY.get(district, 250)),
            "avg_temp": temp,
            "max_temp": _num(r.get("max_temp"), temp + 2.5) if r.get("max_temp") not in (None, "") else temp + 2.5,
            "min_temp": _num(r.get("min_temp"), temp - 2.5) if r.get("min_temp") not in (None, "") else temp - 2.5,
            "avg_humidity": _num(r.get("avg_humidity"), 75),
            "total_precip": rain,
            "avg_windspeed": _num(r.get("avg_windspeed"), 12),
            "rainy_days": _num(r.get("rainy_days"), min(7, max(0, round(rain / 12)))),
            "week_sin": math.sin(2 * math.pi * week / 52.0),
            "week_cos": math.cos(2 * math.pi * week / 52.0),
            "dengue_cases": cases,
        })
    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df = df.sort_values(["district", "year", "week"]).reset_index(drop=True)

    def lags(group):
        group = group.copy()
        cases = group["dengue_cases"].ffill().fillna(0)
        group["dengue_lag_1"] = cases.shift(1).fillna(0)
        group["dengue_lag_4"] = cases.shift(4).fillna(0)
        group["dengue_roll_mean_4"] = cases.rolling(4, min_periods=1).mean()
        group["dengue_roll_std_4"] = cases.rolling(4, min_periods=1).std().fillna(0)
        return group

    return df.groupby("district", group_keys=False).apply(lags)


def pad_timesteps(block):
    if len(block) >= TIMESTEPS:
        return block.tail(TIMESTEPS)
    pad = pd.concat([block.iloc[[0]]] * (TIMESTEPS - len(block)), ignore_index=True)
    return pd.concat([pad, block], ignore_index=True)


def predict_with_keras(records):
    model, scaler_x, scaler_y = load_artifacts()
    df = records_to_frame(records)
    if df.empty:
        raise ValueError("No district rows to predict")

    df[FEATURE_COLS] = scaler_x.transform(df[FEATURE_COLS])
    out = []
    for district, group in df.groupby("district"):
        group = group.sort_values(["year", "week"])
        window = pad_timesteps(group)
        X = np.array([window[FEATURE_COLS].values], dtype="float32")
        pred_scaled = model.predict(X, verbose=0)
        pred = float(scaler_y.inverse_transform(pred_scaled).flatten()[0])
        predicted = int(max(0, round(pred)))
        latest = group.iloc[-1]
        year, week = next_week(int(latest["year"]), int(latest["week"]))
        spread = max(2, int(round(predicted * 0.15)))
        out.append({
            "district": district,
            "predicted_cases": predicted,
            "confidence_low": max(0, predicted - spread),
            "confidence_high": predicted + spread,
            "predicted_week": week,
            "predicted_year": year,
        })
    return out
