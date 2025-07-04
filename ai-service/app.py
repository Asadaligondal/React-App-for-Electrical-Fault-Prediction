from fastapi import FastAPI
from pydantic import BaseModel
from typing import Dict, Any
import uvicorn

# Create FastAPI instance
app = FastAPI(title="AI Component Health Predictor", version="1.0.0")

# Data models for API (like TypeScript interfaces)
class SensorData(BaseModel):
    voltage: float
    deviceId: str
    timestamp: float  # optional for time series

class ComponentPrediction(BaseModel):
    status: str
    confidence: float

class PredictionResponse(BaseModel):
    predictions: Dict[str, ComponentPrediction]
    success: bool
    message: str

# Test endpoint
@app.get("/")
async def root():
    return {"message": "AI Service is running!", "status": "healthy"}

# Main prediction endpoint
@app.post("/predict", response_model=PredictionResponse)
async def predict_component_health(data: SensorData):
    # Mock predictions for now - we'll replace this with real AI
    mock_predictions = {
        "motor": ComponentPrediction(status="Normal", confidence=0.85),
        "pulley": ComponentPrediction(status="Warning", confidence=0.72),
        "belt": ComponentPrediction(status="Normal", confidence=0.91),
        "bearing": ComponentPrediction(status="Normal", confidence=0.88),
        "gear": ComponentPrediction(status="Faulty", confidence=0.79)
    }
    
    return PredictionResponse(
        predictions=mock_predictions,
        success=True,
        message=f"Predictions generated for device {data.deviceId}"
    )

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-predictor"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)