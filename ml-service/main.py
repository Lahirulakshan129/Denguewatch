from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

app = FastAPI(title="DengueWatch ML Service")


class PredictRequest(BaseModel):
    dryRun: bool = False
    records: Optional[List[Dict[str, Any]]] = None


@app.get("/")
def health_check():
    return {"status": "ok", "service": "DengueWatch ML", "engine": "keras"}


@app.post("/predict")
def run_prediction(req: PredictRequest):
    if not req.records:
        raise HTTPException(status_code=400, detail="records array required")
    try:
        from model_runner import predict_with_keras, MODEL_PATH
        rows = predict_with_keras(req.records)
        return {
            "success": True,
            "engine": "keras",
            "model_path": MODEL_PATH,
            "district_count": len(rows),
            "dry_run": req.dryRun,
            "predictions": rows,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Keras prediction failed: {e}")
