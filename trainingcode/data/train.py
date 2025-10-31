import os
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import numpy as np
import torch.nn.functional as F

# 1) Custom Dataset
class VibrationDataset(Dataset):
    def __init__(self, data_root, transform=None):
        self.samples = []
        self.labels = []
        self.transform = transform

        # data_root is a directory with subfolders for each class
        # e.g. ["healthy", "belt", "bearing", ...]
        class_names = sorted(os.listdir(data_root))
        
        # This creates a mapping like {'bearing': 0, 'belt': 1, 'healthy': 2, ...}
        self.class_to_idx = {name: i for i, name in enumerate(class_names)}
        self.idx_to_class = {i: name for name, i in self.class_to_idx.items()}

        print(f"Loading data... Found classes: {self.class_to_idx}")

        for class_name in class_names:
            class_path = os.path.join(data_root, class_name)
            if not os.path.isdir(class_path):
                continue
            
            label = self.class_to_idx[class_name]
            
            for fname in os.listdir(class_path):
                if fname.endswith(".npy"):
                    filepath = os.path.join(class_path, fname)
                    self.samples.append(filepath)
                    self.labels.append(label)

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        filepath = self.samples[idx]
        label = self.labels[idx]
        
        # Load the pre-processed .npy file
        # The pre-processing script already normalized it.
        signal = np.load(filepath)
        
        # Apply any additional transforms if needed
        if self.transform:
            signal = self.transform(signal)
        
        # Convert to PyTorch tensors
        # Shape for signal: [1, 38400] (channels, signal_length)
        signal_tensor = torch.tensor(signal, dtype=torch.float32).unsqueeze(0)
        label_tensor = torch.tensor(label, dtype=torch.long)
        
        return signal_tensor, label_tensor

# 2) Define Model (Improved CNN)
class ImprovedCNN(nn.Module):
    def __init__(self, num_classes=4):
        super(ImprovedCNN, self).__init__()
        
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

def train_model(data_root, epochs=50, batch_size=8, lr=0.0005):  # More epochs, smaller batch
    # dataset
    dataset = VibrationDataset(data_root=data_root)
    
    # --- Create Train/Validation Split ---
    # 80% for training, 20% for validation
    train_size = int(0.8 * len(dataset))
    val_size = len(dataset) - train_size
    train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])

    print(f"Total samples: {len(dataset)}")
    print(f"Training samples: {len(train_dataset)}")
    print(f"Validation samples: {len(val_dataset)}")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)

    # model, loss, optimizer
    num_classes = len(dataset.class_to_idx)
    model = ImprovedCNN(num_classes=num_classes)
    
    # Check for GPU
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model.to(device)
    print(f"Training on device: {device}")

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    scheduler = optim.lr_scheduler.StepLR(optimizer, step_size=15, gamma=0.5)  # Reduce LR every 15 epochs

    # train loop
    for epoch in range(epochs):
        model.train() # Set model to training mode
        running_loss = 0.0
        correct_train = 0
        total_train = 0
        
        for signals, labels in train_loader:
            signals, labels = signals.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(signals)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * signals.size(0)
            _, predicted = torch.max(outputs, 1)
            correct_train += (predicted == labels).sum().item()
            total_train += labels.size(0)

        epoch_loss = running_loss / total_train
        epoch_acc = correct_train / total_train
        
        # --- Validation Loop ---
        model.eval() # Set model to evaluation mode
        correct_val = 0
        total_val = 0
        with torch.no_grad():
            for signals, labels in val_loader:
                signals, labels = signals.to(device), labels.to(device)
                outputs = model(signals)
                _, predicted = torch.max(outputs, 1)
                correct_val += (predicted == labels).sum().item()
                total_val += labels.size(0)
        
        val_acc = correct_val / total_val

        print(f"Epoch {epoch+1}/{epochs}: "
              f"Train Loss={epoch_loss:.4f}, Train Acc={epoch_acc:.4f} | "
              f"Val Acc={val_acc:.4f}")

        scheduler.step()

    # Save model
    model_save_path = "fault_detector.pt"
    torch.save(model.state_dict(), model_save_path)
    print(f"Model saved to {model_save_path}")
    
    # Save the class mapping
    class_map_path = "class_mapping.txt"
    with open(class_map_path, 'w') as f:
        for idx, class_name in dataset.idx_to_class.items():
            f.write(f"{idx}:{class_name}\n")
    print(f"Class mapping saved to {class_map_path}")


if __name__ == "__main__":
    # Use your actual chunks folder name
    train_model(data_root="secdatachunks", epochs=10, batch_size=16)