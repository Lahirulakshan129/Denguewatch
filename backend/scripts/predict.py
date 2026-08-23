import os
import sys
import json
import pandas as pd
import numpy as np
import warnings
import tensorflow as tf
from tensorflow.keras.models import load_model
import joblib

warnings.filterwarnings('ignore')
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'

try:
    # 1. Load Paths
    DATA_PATH = r"E:\#Research\DataSets\final\weather_dengue_population_merged.xlsx"
    MODEL_PATH = r"E:\#Research\past training\models\bilstm_improved.keras"
    SCALER_X_PATH = r"E:\#Research\past training\models\scaler_X.pkl"
    SCALER_Y_PATH = r"E:\#Research\past training\models\scaler_y.pkl"
    
    # 2. Load Model and Scalers
    model = load_model(MODEL_PATH)
    scaler_X = joblib.load(SCALER_X_PATH)
    scaler_y = joblib.load(SCALER_Y_PATH)
    
    # 3. Load Data
    df = pd.read_excel(DATA_PATH)
    df["date_week_start"] = pd.to_datetime(df["date_week_start"])
    df["year"] = df["date_week_start"].dt.year
    df["week"] = df["date_week_start"].dt.isocalendar().week
    df = df.sort_values(["district_id", "date_week_start"]).reset_index(drop=True)
    
    # 4. Feature Engineering
    df['week_sin'] = np.sin(2 * np.pi * df['week'] / 52.0)
    df['week_cos'] = np.cos(2 * np.pi * df['week'] / 52.0)

    def calc_rolling_features(group):
        group = group.copy()
        group['dengue_roll_mean_4'] = group['dengue_cases'].rolling(4, min_periods=1).mean()
        group['dengue_roll_std_4'] = group['dengue_cases'].rolling(4, min_periods=1).std().fillna(0)
        group['dengue_lag_1'] = group['dengue_cases'].shift(1).fillna(0)
        group['dengue_lag_4'] = group['dengue_cases'].shift(4).fillna(0)
        return group
    
    df = df.groupby("district_id").apply(calc_rolling_features).reset_index(drop=True)
    
    # Only keep complete data
    df = df.dropna(subset=['dengue_cases', 'avg_temp', 'total_precip']).reset_index(drop=True)
    
    feature_cols = [
        "population_density", "avg_temp", "max_temp", "min_temp",
        "avg_humidity", "total_precip", "avg_windspeed", "rainy_days",
        "week_sin", "week_cos", "dengue_lag_1", "dengue_lag_4",
        "dengue_roll_mean_4", "dengue_roll_std_4"
    ]
    
    df_scaled = df.copy()
    df_scaled[feature_cols] = scaler_X.transform(df[feature_cols])
    
    TIMESTEPS = 8
    
    predictions = []
    
    for district, group in df_scaled.groupby("district"):
        group = group.sort_values("date_week_start")
        if len(group) < TIMESTEPS:
            continue
        
        # Take the LAST 8 weeks to predict the NEXT week
        recent_data = group.tail(TIMESTEPS)
        
        X = np.array([recent_data[feature_cols].values])
        
        # Predict
        pred_scaled = model.predict(X, verbose=0)
        pred_actual = scaler_y.inverse_transform(pred_scaled).flatten()[0]
        
        pred_rounded = int(max(0, round(pred_actual)))
        
        # Calculate target week (the week AFTER the latest data)
        last_date = pd.to_datetime(recent_data["date_week_start"].iloc[-1])
        next_date = last_date + pd.Timedelta(weeks=1)
        
        predictions.append({
            "district": district,
            "predicted_week": next_date.isocalendar().week,
            "predicted_year": next_date.year,
            "predicted_cases": pred_rounded,
            # Arbitrary confidence interval for visualization
            "confidence_low": int(max(0, pred_rounded - (pred_rounded * 0.15))),
            "confidence_high": int(pred_rounded + (pred_rounded * 0.15))
        })
        
    result = {
        "success": True,
        "district_count": len(predictions),
        "predictions": predictions
    }
    
    # Save to CSV
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--weather-csv")
    parser.add_argument("--dengue-csv")
    parser.add_argument("--model-path")
    parser.add_argument("--output-csv")
    parser.add_argument("--dry-run", action="store_true")
    args, _ = parser.parse_known_args()
    
    if args.output_csv:
        out_df = pd.DataFrame(predictions)
        out_df.to_csv(args.output_csv, index=False)
        
    print(f"\nPREDICTION_RESULT:{json.dumps(result)}")
    
except Exception as e:
    err = {"success": False, "error": str(e)}
    print(f"\nPREDICTION_ERROR:{json.dumps(err)}")
    sys.exit(1)
