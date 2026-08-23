from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import subprocess
import json
import os

app = FastAPI(title="DengueWatch ML Service")

WEATHER_CSV = os.environ.get("WEATHER_CSV_PATH", "../backend/data/weekly_weather.csv")
DENGUE_CSV = os.environ.get("DENGUE_CSV_PATH", "../backend/data/dengue_counts.csv")
PREDICTION_CSV = os.environ.get("PREDICTION_CSV_PATH", "../backend/data/predictions.csv")
MODEL_PATH = os.environ.get("MODEL_PATH", "model/dengue_model.h5")


class PredictRequest(BaseModel):
    dryRun: bool = False

@app.get("/")
def health_check():
    return {"status": "ok", "service": "DengueWatch ML"}

@app.post("/predict")
def run_prediction(req: PredictRequest):
    try:
        import sys
        args = [
            sys.executable, "predict.py",
            "--weather-csv", WEATHER_CSV,
            "--dengue-csv", DENGUE_CSV,
            "--model-path", MODEL_PATH,
            "--output-csv", PREDICTION_CSV,
        ]
        if req.dryRun:
            args.append("--dry-run")

        result = subprocess.run(
            args,
            cwd=os.path.dirname(os.path.abspath(__file__)),
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise Exception(
                f"Process failed with code {result.returncode}. stderr: {result.stderr}, stdout: {result.stdout}"
            )

        output_lines = result.stdout.split("\n")
        json_line = next((line for line in output_lines if "PREDICTION_RESULT:" in line), None)
        error_line = next((line for line in output_lines if "PREDICTION_ERROR:" in line), None)

        if error_line:
            raise Exception(f"Script error: {error_line}")

        if json_line:
            data = json.loads(json_line.split("PREDICTION_RESULT:")[1])
            return data
        raise Exception(f"No PREDICTION_RESULT found. stdout: {result.stdout}")
    except Exception as e:
        print("PREDICTION EXCEPTION:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
