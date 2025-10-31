from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
import uvicorn
import numpy as np

# Import the prediction function from our new file
try:
    from ai_inference import predict_fault
except ImportError:
    print("Error: Could not import 'predict_fault' from ai_inference.py.")
    print("Make sure the file exists and has no errors.")
    exit()

# Create FastAPI instance
app = FastAPI(title="AI Component Health Predictor", version="1.0.0")

# --- NEW Data Models ---
# This model defines the data we EXPECT from React
class RealtimeData(BaseModel):
    samples: List[float]  # This is the 1-second chunk of raw data
    deviceId: str

# This model defines the data we WILL SEND back to React
class PredictionResponse(BaseModel):
    label: str      # The single predicted label (e.g., "healthy", "belt")
    success: bool
    deviceId: str

# --- API Endpoints ---

@app.get("/")
async def root():
    return {"message": "AI Service is running!", "status": "healthy"}

# --- This is our NEW prediction endpoint ---
@app.post("/predict-real-time", response_model=PredictionResponse)
async def predict_realtime(data: RealtimeData):
    """
    Receives a 1-second chunk of sensor data and returns a
    single prediction for the system's state.
    """
    try:
        # 1. Convert the incoming list of samples to a NumPy array
        # This is what our 'predict_fault' function expects
        samples_np = np.array(data.samples, dtype=np.float32)

        # 2. Check if we have the right amount of data (optional but good)
        # For a 1-second chunk at 38.4kHz
        if len(samples_np) < 38000: # Give some buffer
             raise ValueError(f"Not enough samples. Expected ~38400, got {len(samples_np)}")

        # 3. Call our AI model function
        predicted_label = predict_fault(samples_np)

        # 4. Return the successful response
        return PredictionResponse(
            label=predicted_label,
            success=True,
            deviceId=data.deviceId
        )
        
    except Exception as e:
        # If anything goes wrong, return an error
        print(f"Error during prediction: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error processing prediction: {str(e)}"
        )

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "ai-predictor"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)