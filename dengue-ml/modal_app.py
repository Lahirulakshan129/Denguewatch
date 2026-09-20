from typing import Any, Dict, List, Optional
import modal
from pydantic import BaseModel

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi[standard]",
        "tensorflow==2.17.0",
        "numpy",
        "pandas",
        "scikit-learn==1.8.0",
        "joblib"
    )
    .add_local_dir("model", remote_path="/root/model")
    .add_local_file("model_runner.py", remote_path="/root/model_runner.py")
)

app = modal.App("denguewatch-ml", image=image)

class PredictRequest(BaseModel):
    dryRun: bool = False
    records: Optional[List[Dict[str, Any]]] = None

@app.function()
@modal.fastapi_endpoint(method="GET")
def health():
    return {
        "status": "healthy",
        "service": "DengueWatch ML",
        "engine": "keras"
    }

@app.function(timeout=300)
@modal.fastapi_endpoint(method="POST")
def predict(req: PredictRequest):
    from fastapi import HTTPException
    import traceback
    if not req.records:
        raise HTTPException(status_code=400, detail="records array required")

    import os
    os.environ["MODEL_PATH"] = "/root/model/bilstm_improved.keras"
    os.environ["SCALER_X_PATH"] = "/root/model/scaler_X.pkl"
    os.environ["SCALER_Y_PATH"] = "/root/model/scaler_y.pkl"

    import sys
    if "/root" not in sys.path:
        sys.path.append("/root")

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
        err_msg = f"{type(e).__name__}: {str(e)}\n{traceback.format_exc()}"
        print("ERROR IN PREDICTION:", err_msg)
        raise HTTPException(status_code=500, detail=err_msg)
