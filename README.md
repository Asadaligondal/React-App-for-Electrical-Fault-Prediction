# React App for Electrical Fault Prediction

A containerized motor monitoring system with real-time fault detection using AI, built with React, Node.js, Python, and MongoDB.

## 🏗️ **Architecture**
- **Frontend**: React app (Port 8080)
- **Backend**: Node.js + Socket.IO (Port 5000)
- **AI Service**: Python + FastAPI (Port 8001)
- **UDP Service**: Real-time data receiver (Port 3000)
- **Database**: MongoDB (Port 27017)

## 🚀 **Quick Start (Docker)**

### **Prerequisites**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- [Git](https://git-scm.com/) installed

### **1. Clone Repository**
```bash
git clone https://github.com/YOUR_USERNAME/React-App-for-Electrical-Fault-Prediction.git
cd React-App-for-Electrical-Fault-Prediction
```

### **2. Create Environment File**
Create `.env` file in project root:
```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-for-electrical-fault-prediction-2024
JWT_EXPIRES_IN=24h

# React App URLs
REACT_APP_SOCKET_URL=http://localhost:5000
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_AI_SERVICE_URL=http://localhost:8001

# MongoDB
MONGODB_URI=mongodb://admin:password123@mongodb:27017/motor_monitoring?authSource=admin

# Service URLs
AI_SERVICE_URL=http://ai-service:8001
NODE_ENV=production
```

### **3. Start All Services**
```bash
# Build and start all containers
docker compose up --build -d

# Check if all services are running
docker compose ps
```

### **4. Access Application**
- **Web App**: http://localhost:8080
- **API Server**: http://localhost:5000/health
- **AI Service**: http://localhost:8001

### **5. View Logs (Optional)**
```bash
# View all service logs
docker compose logs -f

# View specific service logs
docker compose logs -f frontend
docker compose logs -f main-server
docker compose logs -f ai-service
```

## 🛑 **Stop Application**
```bash
# Stop all containers
docker compose down

# Stop and remove all data
docker compose down -v
```

## 🔧 **Development Setup**

### **Run Locally (Without Docker)**
```bash
# Install dependencies
npm install

# Start AI service
cd ai-service
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
python new-app.py

# Start backend services (new terminal)
node server.js

# Start React app (new terminal)
npm start
```

## 📱 **Raspberry Pi Integration**

### **Pi Configuration**
Update your Raspberry Pi script to send data to:
```python
PC_IP = "YOUR_PC_IP_ADDRESS"  # Your computer's IP
PC_PORT = 3000
```

### **Expected Data Format**
- **Protocol**: UDP
- **Port**: 3000
- **Data**: 320 float32 voltage samples per packet
- **Sample Rate**: 38400Hz

## 🐳 **Docker Commands Reference**

```bash
# Build all services
docker compose build

# Start services in background
docker compose up -d

# Start with rebuild
docker compose up --build -d

# Stop services
docker compose down

# View running containers
docker compose ps

# View logs
docker compose logs [service-name]

# Restart specific service
docker compose restart [service-name]

# Remove everything (including volumes)
docker compose down -v
```

## 📊 **Service Health Checks**

```bash
# Test all services
curl http://localhost:8001    # AI Service
curl http://localhost:5000/health    # Main Server
curl http://localhost:8080    # Frontend
```

## 🔍 **Troubleshooting**

### **Port Conflicts**
If ports are busy, update `docker-compose.yml`:
```yaml
frontend:
  ports:
    - "3001:80"  # Change 8080 to 3001
```

### **MongoDB Issues**
```bash
# Reset MongoDB data
docker compose down -v
docker compose up -d
```

### **Build Failures**
```bash
# Clean Docker cache
docker system prune -a
docker compose build --no-cache
```

## 🏷️ **Project Structure**
```
├── docker-compose.yml      # Container orchestration
├── .env                   # Environment variables
├── package.json           # Node.js dependencies
├── server.js             # Main backend server
├── Dockerfile.frontend    # React app container
├── Dockerfile.server     # Backend container
├── Dockerfile.udp        # UDP service container
├── nginx.conf            # Web server config
├── src/                  # React source code
├── server/               # Backend modules
│   ├── routes/           # API routes
│   ├── config/           # Configuration
│   └── services/         # Business logic
└── ai-service/           # Python AI service
    ├── Dockerfile
    ├── requirements.txt
    └── new-app.py
```

## 🤝 **Contributing**
1. Fork the repository
2. Create feature branch
3. Make changes
4. Test with Docker
5. Submit pull request

## 📄 **License**
MIT License - see LICENSE file for details