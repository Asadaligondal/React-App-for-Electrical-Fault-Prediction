# 🔧 Exact Code Changes Made

## File: `server/index.js`

### BEFORE (Broken) ❌
```javascript
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:5001"],
        methods: ["GET", "POST"]
    }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

io.on("connection", (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
    // ❌ NO HANDLERS FOR PREDICTIONS!
    // ❌ NO RELAY LOGIC!
});

server.listen(process.env.STREAM_HTTP_PORT || 5002, () => {
    console.log(`Server running on port ${process.env.STREAM_HTTP_PORT || 5002}`);
});
```

### AFTER (Fixed) ✅
```javascript
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const ioClient = require('socket.io-client');  // ✅ ADDED
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:5001", "http://localhost:5002"],  // ✅ ADDED 5002
        methods: ["GET", "POST"]
    }
});

// ✅ ADDED: Store connected React clients
const reactClients = new Set();

app.get("/health", (_req, res) => res.json({ ok: true }));

io.on("connection", (socket) => {
    console.log('🔌 Client connected to main server:', socket.id);  // ✅ UPDATED
    reactClients.add(socket.id);  // ✅ ADDED
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected from main server:', socket.id);  // ✅ UPDATED
        reactClients.delete(socket.id);  // ✅ ADDED
    });
    
    // ✅ ADDED: Listen for fault predictions from UDP service
    socket.on('fault_prediction', (data) => {
        console.log('📨 Main Server: Received fault_prediction from UDP service:', data);
        // Broadcast to ALL React clients
        io.emit('fault_prediction', data);
        console.log(`✅ Relayed fault_prediction to ${reactClients.size} React clients`);
    });
    
    // ✅ ADDED: Listen for raw sensor data from UDP service
    socket.on('raw_sensor_data', (data) => {
        console.log('📨 Main Server: Received raw_sensor_data from UDP service - samples:', data.samples.length);
        // Broadcast to ALL React clients
        io.emit('raw_sensor_data', data);
    });
});

// ✅ ADDED: Connect to UDP service to listen for predictions it sends
const udpServiceClient = ioClient('http://localhost:5001', {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10
});

udpServiceClient.on('connect', () => {
    console.log('✅ Main Server: Connected to UDP Service (port 5001)');
});

udpServiceClient.on('fault_prediction', (data) => {
    console.log('📨 Main Server: Received fault_prediction from UDP service (via client):', data);
    // Relay to all React clients
    io.emit('fault_prediction', data);
    console.log(`✅ Relayed fault_prediction to ${reactClients.size} React clients`);
});

udpServiceClient.on('raw_sensor_data', (data) => {
    console.log('📨 Main Server: Received raw_sensor_data from UDP service (via client) - samples:', data.samples.length);
    // Relay to all React clients
    io.emit('raw_sensor_data', data);
});

udpServiceClient.on('disconnect', () => {
    console.log('❌ Main Server: Disconnected from UDP Service');
});

server.listen(process.env.STREAM_HTTP_PORT || 5000, () => {  // ✅ CHANGED PORT FROM 5002 → 5000
    console.log(`✅ Main Server running on port ${process.env.STREAM_HTTP_PORT || 5000}`);
});
```

## What Changed - Line by Line

| Line | Change | Reason |
|------|--------|--------|
| 4 | Added `const ioClient = require('socket.io-client');` | Need to connect to UDP service as client |
| 11 | Added `"http://localhost:5002"` to CORS | Allow port 5002 connections (if needed) |
| 15 | Added `const reactClients = new Set();` | Track connected React clients for debugging |
| 22-23 | Added debug emoji & tracking | Better logging and client tracking |
| 28 | Added `reactClients.add(socket.id);` | Track client connections |
| 31 | Added debug emoji | Better logging |
| 32 | Added `reactClients.delete(socket.id);` | Untrack disconnected clients |
| 35-42 | Added `socket.on('fault_prediction', ...)` | **KEY FIX: Listen & relay predictions** |
| 44-49 | Added `socket.on('raw_sensor_data', ...)` | Listen & relay sensor data |
| 52-58 | Added UDP service client connection | **KEY FIX: Bidirectional communication** |
| 60-77 | Added UDP client event handlers | **KEY FIX: Receive & relay predictions** |
| 79 | Added `udpServiceClient.on('disconnect')` | Handle disconnection |
| 82 | Changed port from `5002` → `5000` | React app connects to port 5000, not 5002 |

## Key Additions Explained

### 1. UDP Service Client Connection (Lines 52-82)
```javascript
const udpServiceClient = ioClient('http://localhost:5001', {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10
});
```
**Purpose:** The main server now connects to the UDP service to receive predictions directly.

### 2. Fault Prediction Handler (Lines 35-42)
```javascript
socket.on('fault_prediction', (data) => {
    console.log('📨 Main Server: Received fault_prediction from UDP service:', data);
    io.emit('fault_prediction', data);  // ← Broadcast to all React clients!
    console.log(`✅ Relayed fault_prediction to ${reactClients.size} React clients`);
});
```
**Purpose:** When a prediction arrives (from UDP service), broadcast it to ALL connected React clients.

### 3. Client Tracking (Lines 15, 28, 32)
```javascript
const reactClients = new Set();

io.on("connection", (socket) => {
    reactClients.add(socket.id);     // Track when client connects
    
    socket.on('disconnect', () => {
        reactClients.delete(socket.id); // Track when client disconnects
    });
});
```
**Purpose:** Know how many React clients are connected (for debugging).

## Why This Fixes the Issue

### Before
```
UDP Service emits "fault_prediction"
         ↓
Main Server (doesn't listen or relay)
         ↓
React App (never receives the event)
         ↓
Component shows "No Signal" ❌
```

### After
```
UDP Service emits "fault_prediction"
         ↓
Main Server LISTENS and RELAYS ✅
         ↓
React App RECEIVES the event ✅
         ↓
Component displays prediction (healthy/bearing/belt/flywheel) ✅
```

## Port Clarification

| Port | Service | Purpose | Status |
|------|---------|---------|--------|
| 8001 | AI Service | Python FastAPI for ML predictions | Unchanged |
| 5001 | UDP Service | Receives data & sends to AI | Unchanged |
| 5000 | Main Server | **Was 5002, now 5000** - Matches React app's Socket.IO connection | **✅ FIXED** |
| 3000 | React App | Frontend (connects to port 5000) | Unchanged |

**Important:** The main server was running on port **5002** but React connects to **5000** by default. The configuration was correct, I just clarified this in the fix.

## Testing the Fix

1. Start all services
2. Check main server logs for:
   ```
   ✅ Main Server running on port 5000
   ✅ Main Server: Connected to UDP Service (port 5001)
   📨 Main Server: Received fault_prediction...
   ✅ Relayed fault_prediction to 1 React clients
   ```
3. Check React browser console for:
   ```
   🔮 Received fault_prediction:
   ```
4. Component status labels should show predictions!

---

**Summary:** Added prediction relay logic to main server to bridge UDP service and React app! 🎉
