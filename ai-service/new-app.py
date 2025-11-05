import numpy as np
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List

# Import your prediction function
try:
    from ai_inference import predict_fault
    print("✅ ai_inference module loaded successfully")
except ImportError:
    # Dummy function for testing if file is missing
    print("⚠️  Warning: 'ai_inference' not found. Using dummy predictor.")
    def predict_fault(data): 
        # Simple dummy predictor for testing
        return "healthy_dummy"

app = FastAPI(title="AI Component Health Predictor (HTTP API)", version="3.0.0")

# --- Pydantic Models for API ---
class PredictionRequest(BaseModel):
    samples: List[float]  # 38,400 preprocessed samples from Node.js
    deviceId: str

class PredictionResponse(BaseModel):
    label: str
    confidence: float

# --- FastAPI Startup Event ---
@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print("🚀 AI Service Starting (HTTP-only mode)")
    print("=" * 60)
    print("📡 Listening on: http://0.0.0.0:8001")
    print("🔌 UDP handled by: Node.js UDP service (port 3000)")
    print("📊 Expecting: 38,400 preprocessed samples per request")
    print("🎯 Data format: Normalized to [-1, 1] range (Z-score + scaling)")
    print("=" * 60)

# --- HTTP Endpoints ---
@app.post("/predict-real-time", response_model=PredictionResponse)
async def predict_real_time(request: PredictionRequest):
    """
    Receives preprocessed data from Node.js UDP service
    Data is already normalized to [-1, 1] range (matching training)
    Returns AI prediction with confidence
    """
    try:
        # Convert to numpy array
        samples = np.array(request.samples, dtype=np.float32)
        
        # Validate input shape (should be 38,400 preprocessed samples)
        if len(samples) != 38400:
            raise HTTPException(
                status_code=400, 
                detail=f"Expected 38400 samples, got {len(samples)}"
            )
        
        # Validate preprocessing (data should be roughly in [-1, 1] range)
        sample_min = np.min(samples)
        sample_max = np.max(samples)
        if sample_min < -2.0 or sample_max > 2.0:
            print(f"⚠️  Warning: Data range unusual. Min: {sample_min:.3f}, Max: {sample_max:.3f}")
        
        print(f"📊 Received data from {request.deviceId}")
        print(f"   Samples: {len(samples)}, Range: [{sample_min:.3f}, {sample_max:.3f}]")
        print(f"   Mean: {np.mean(samples):.3f}, Std: {np.std(samples):.3f}")
        
        # Run prediction using your ai_inference module
        result = predict_fault(samples)
        
        # If your predict_fault returns just a label string, create a response
        if isinstance(result, str):
            label = result
            confidence = 0.95  # Default confidence if not provided by model
            print(f"🤖 Prediction: {label} (using default confidence)")
        else:
            # If it returns a dict with label and confidence
            label = result.get('label', 'unknown')
            confidence = result.get('confidence', 0.0)
            print(f"🤖 Prediction: {label} (confidence: {confidence:.2%})")
        
        return PredictionResponse(
            label=label,
            confidence=confidence
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {
        "message": "AI Component Health Predictor",
        "version": "3.0.0",
        "status": "running",
        "expected_input": "38400 preprocessed samples (normalized to [-1, 1])",
        "api_endpoint": "/predict-real-time",
        "architecture": "HTTP API (UDP handled by Node.js service)"
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ai-prediction",
        "expected_sample_count": 38400,
        "port": 8001
    }

if __name__ == "__main__":
    print("🚀 Starting AI Service (HTTP-only mode)")
    print("📡 Node.js UDP service handles UDP reception and preprocessing")
    print("🔌 This service only provides HTTP prediction endpoints")
    uvicorn.run(app, host="0.0.0.0", port=8001)