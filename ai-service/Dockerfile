FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy AI service code
COPY . .

# Expose FastAPI port
EXPOSE 8001

# Start AI service
CMD ["uvicorn", "new-app:app", "--host", "0.0.0.0", "--port", "8001"]