import os
import numpy as np
import glob
try:
    import pandas as pd
except ModuleNotFoundError:
    pd = None

# --- CONFIGURE THIS ---
SOURCE_FILES = {
    "healthy": "healthy/*.csv",
    "belt":    "belt/*.csv",
    "bearing": "bearing/*.csv",
    "flywheel":"flywheel/*.csv",
}

OUTPUT_DIRECTORY = "secdatachunks"
SAMPLE_RATE = 38400  # 38k samples/sec
CHUNK_SIZE_SECONDS = 1
CHUNK_SAMPLES = SAMPLE_RATE * CHUNK_SIZE_SECONDS  # 38,400 samples

def slice_and_save_data():
    print("Starting data preprocessing...")
    
    for class_name, file_pattern in SOURCE_FILES.items():
        print(f"Processing class: {class_name}")
        
        output_class_path = os.path.join(OUTPUT_DIRECTORY, class_name)
        os.makedirs(output_class_path, exist_ok=True)
        
        chunk_counter = 0
        
        for filepath in glob.glob(file_pattern):
            print(f"  Loading file: {filepath}")
            
            try:
                ext = os.path.splitext(filepath)[1].lower()
                signal = None

                if ext == ".csv":
                    if pd is not None:
                        df = pd.read_csv(filepath)
                        print(f"    CSV columns: {list(df.columns)}")
                        
                        # Specifically look for the voltage column
                        if 'Voltage_V' in df.columns:
                            signal = df['Voltage_V'].values
                            print(f"    Using 'Voltage_V' column")
                        elif 'voltage' in df.columns:
                            signal = df['voltage'].values
                            print(f"    Using 'voltage' column")
                        else:
                            # Fall back to numeric columns
                            numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
                            # Filter out Sample and Time columns
                            signal_cols = [col for col in numeric_cols if not any(x in col.lower() for x in ['sample', 'time', 'index'])]
                            if signal_cols:
                                signal = df[signal_cols[0]].values
                                print(f"    Using column '{signal_cols[0]}'")
                            else:
                                raise ValueError("No suitable signal column found")
                    else:
                        # Numpy fallback - load CSV and take the voltage column (column index 2)
                        try:
                            data = np.genfromtxt(filepath, delimiter=",", skip_header=1)  # skip header
                            if data.ndim == 2 and data.shape[1] >= 3:
                                signal = data[:, 2]  # Voltage_V is the 3rd column (index 2)
                                print(f"    Using column 2 (Voltage_V)")
                            else:
                                raise ValueError("CSV doesn't have expected 3 columns")
                        except:
                            raise ValueError("Failed to read CSV with numpy")
                
                else:
                    raise ValueError(f"Unsupported file extension: {ext}")

                # Ensure signal is a 1-D numpy array
                signal = np.asarray(signal, dtype=np.float64)
                if signal.ndim > 1:
                    signal = signal.flatten()
                
                print(f"    Signal stats: shape={signal.shape}, mean={np.mean(signal):.4f}, std={np.std(signal):.4f}, min={np.min(signal):.4f}, max={np.max(signal):.4f}")
                
                # Calculate how many full chunks we can get
                num_chunks = len(signal) // CHUNK_SAMPLES
                print(f"    Can extract {num_chunks} chunks of {CHUNK_SAMPLES} samples each")
                
                for i in range(num_chunks):
                    start_index = i * CHUNK_SAMPLES
                    end_index = start_index + CHUNK_SAMPLES
                    
                    # Get the 1-second chunk
                    chunk = signal[start_index:end_index]
                    
                    # Normalize the chunk to [-1, 1] range
                    chunk_mean = np.mean(chunk)
                    chunk_std = np.std(chunk)
                    
                    if chunk_std > 0:
                        # Z-score normalization then scale to [-1, 1]
                        chunk_normalized = (chunk - chunk_mean) / chunk_std
                        chunk_max = np.max(np.abs(chunk_normalized))
                        if chunk_max > 0:
                            chunk_final = chunk_normalized / chunk_max
                        else:
                            chunk_final = chunk_normalized
                    else:
                        # If std is 0 (constant signal), just center around 0
                        chunk_final = np.zeros_like(chunk)
                    
                    # Save the chunk
                    chunk_filename = f"chunk_{chunk_counter:05d}.npy"
                    chunk_path = os.path.join(output_class_path, chunk_filename)
                    np.save(chunk_path, chunk_final.astype(np.float32))
                    
                    chunk_counter += 1
                
                print(f"    Extracted {num_chunks} chunks from {os.path.basename(filepath)}")
                
            except Exception as e:
                print(f"    Failed to process {filepath}: {e}")
                
    print(f"\nPreprocessing complete. Data saved in '{OUTPUT_DIRECTORY}' directory.")

if __name__ == "__main__":
    slice_and_save_data()