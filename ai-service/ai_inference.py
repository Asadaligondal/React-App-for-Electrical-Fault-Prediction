import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np

# --- 1. Load Class Mapping ---
CLASS_MAPPING = {}
try:
    with open("class_mapping.txt", 'r') as f:
        for line in f:
            line = line.strip()
            if ":" in line:
                idx_str, class_name = line.split(':', 1)
                CLASS_MAPPING[int(idx_str)] = class_name
    print(f"Loaded class mapping: {CLASS_MAPPING}")
except FileNotFoundError:
    print("Error: class_mapping.txt not found. Exiting.")
    exit()
except Exception as e:
    print(f"Error reading class_mapping.txt: {e}")
    exit()


# --- 2. Define The Model Architecture ---
# This MUST be the *exact* same architecture as in your train.py
# The number of classes is now dynamic based on your mapping file.
NUM_CLASSES = len(CLASS_MAPPING)

class SimpleCNN(nn.Module):
    def __init__(self, num_classes=4):
        super(SimpleCNN, self).__init__()

        # Multiple conv layers with different kernel sizes to capture different frequencies
        self.conv1 = nn.Conv1d(1, 32, kernel_size=64, stride=2, padding=32)
        self.bn1 = nn.BatchNorm1d(32)
        self.conv2 = nn.Conv1d(32, 64, kernel_size=32, stride=2, padding=16)
        self.bn2 = nn.BatchNorm1d(64)
        self.conv3 = nn.Conv1d(64, 128, kernel_size=16, stride=2, padding=8)
        self.bn3 = nn.BatchNorm1d(128)
        self.conv4 = nn.Conv1d(128, 256, kernel_size=8, stride=2, padding=4)
        self.bn4 = nn.BatchNorm1d(256)
        
        self.pool = nn.AdaptiveAvgPool1d(64)
        self.dropout = nn.Dropout(0.3)
        
        self.fc1 = nn.Linear(256 * 64, 512)
        self.fc2 = nn.Linear(512, 128)
        self.fc3 = nn.Linear(128, num_classes)
        
    def forward(self, x):
        x = F.relu(self.bn1(self.conv1(x)))
        x = F.relu(self.bn2(self.conv2(x)))
        x = F.relu(self.bn3(self.conv3(x)))
        x = F.relu(self.bn4(self.conv4(x)))
        
        x = self.pool(x)
        x = x.view(x.size(0), -1)
        x = self.dropout(F.relu(self.fc1(x)))
        x = self.dropout(F.relu(self.fc2(x)))
        x = self.fc3(x)
        return x

# --- 3. Load Model and Weights ---
MODEL_PATH = "fault_detector.pt"

# Initialize the model
model = SimpleCNN(num_classes=NUM_CLASSES)

# Load the saved weights
try:
    # Use map_location='cpu' if you are not using a GPU for inference
    model.load_state_dict(torch.load(MODEL_PATH, map_location=torch.device('cpu')))
    model.eval() # Set model to evaluation mode (VERY IMPORTANT!)
    print(f"Successfully loaded model from {MODEL_PATH}")
except Exception as e:
    print(f"Error loading model {MODEL_PATH}: {e}")
    print("Please make sure the file exists and the model definition is correct.")
    exit()

# --- 4. Define Prediction Function ---
def predict_fault(samples: np.ndarray) -> str:
    """
    Takes a 1D numpy array of raw signal samples (e.g., 38400 samples)
    and returns a string label (e.g., "healthy", "belt").
    """
    if samples.ndim != 1:
        raise ValueError(f"Expected 1D numpy array, but got shape {samples.shape}")

    # 1. Normalize the new, incoming data
    #    This MUST match the normalization used in your `preprocess_data.py`
    # normalized_samples = samples
    chunk_mean = np.mean(samples)
    chunk_std = np.std(samples)
    if chunk_std > 0:
        # Z-score normalization then scale to [-1, 1]
        chunk_normalized = (samples - chunk_mean) / chunk_std
        chunk_max = np.max(np.abs(chunk_normalized))
        if chunk_max > 0:
            normalized_samples = chunk_normalized / chunk_max
        else:
            normalized_samples = chunk_normalized
    else:
        # If std is 0 (constant signal), just center around 0
        normalized_samples = np.zeros_like(samples)
    
    # 2. Convert to PyTorch Tensor
    #    Shape must be [1, 1, num_samples] -> (Batch, Channels, Length)
    with torch.no_grad(): # Disable gradient calculation for inference
        signal_tensor = torch.tensor(normalized_samples, dtype=torch.float32).unsqueeze(0).unsqueeze(0) # TODO: Check Size
        
        # 3. Get model output (logits)
        logits = model(signal_tensor)
        
        # 4. Get predicted class index
        predicted_idx = torch.argmax(logits, dim=1).item()
        
        # 5. Map index to string label
        label = CLASS_MAPPING.get(predicted_idx, "healthy")  # Default to healthy instead of Unknown
        
        print(f"🤖 AI Prediction: Index {predicted_idx} -> '{label}' (confidence based on logits)")
        
        return label