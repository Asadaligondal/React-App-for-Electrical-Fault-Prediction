# Quick diagnostic - check actual sampling rate from your CSV
import pandas as pd
df = pd.read_csv("healthy/adc_data.csv")
time_diff = df['Time_ms'].diff().mean()  # average time between samples in ms
actual_sample_rate = 1000 / time_diff    # convert to samples per second
print(f"Actual sample rate: {actual_sample_rate:.1f} Hz")
print(f"Expected: 38400 Hz")
print(f"Time span per chunk: {38400 / actual_sample_rate:.2f} seconds")