# 🎯 Quick Start: After the Fix

## 🔧 What Was Fixed

The **main server (port 5000)** now properly:
1. ✅ **Listens** for `fault_prediction` events from the UDP service
2. ✅ **Relays** those predictions to all connected React clients
3. ✅ **Connects to UDP service** to establish bidirectional communication

## 📍 Communication Architecture (NOW WORKING)

```
AI Service (8001)
├─ Receives: 38,400 samples from UDP Service
├─ Predicts: "healthy" / "bearing" / "belt" / "flywheel"
└─ Returns: JSON response with prediction

     ↓ (HTTP POST)

UDP Service (5001) - RandomSensorDataGenerator
├─ Generates fake OR receives real sensor data
├─ SENDS to AI Service: raw samples
├─ RECEIVES: AI predictions
├─ EMITS EVENT "fault_prediction" → port 5000 ✅ NEW
├─ EMITS EVENT "raw_sensor_data" → port 5000 ✅ NEW
└─ Also broadcasts locally on port 5001

     ↓ (Socket.IO events)

MAIN SERVER (5000) - NOW FIXED ✅
├─ LISTENS for "fault_prediction" from UDP Service ✅ NEW
├─ LISTENS for "raw_sensor_data" from UDP Service ✅ NEW
├─ BROADCASTS both events to ALL React clients ✅ NEW
└─ Connects as CLIENT to UDP Service (port 5001) ✅ NEW

     ↓ (Socket.IO broadcast)

React Browser (3000)
├─ useSocket hook receives "fault_prediction"
├─ Updates deviceStatuses state
├─ Re-renders component labels with predictions
└─ Displays: "Bearing" status = "healthy" / "bearing fault" ✅
```

## 🚀 To Test the Fix

### Step 1: Start AI Service
```powershell
cd ai-service
python app.py
# Should show: "Uvicorn running on http://0.0.0.0:8001"
```

### Step 2: Start UDP Service  
```powershell
cd server
node startUDPService.js
# Should show: "🚀 UDP Socket.IO server running on port 5001"
# Should show: "📊 Generating 38400 samples every XXms"
# Should show: "🤖 AI ENABLED - Sending 38400 samples to AI service"
```

### Step 3: Start Main Server (WITH FIX)
```powershell
cd server
node index.js
# Should show: "✅ Main Server running on port 5000"
# Should show: "✅ Main Server: Connected to UDP Service (port 5001)"
# Should show: "📨 Main Server: Received fault_prediction..."
# Should show: "✅ Relayed fault_prediction to X React clients"
```

### Step 4: Start React App
```powershell
npm start
# Should show: "🔌 Connecting to main Socket.IO server: http://localhost:5000"
# Should show: "✅ Connected to main Socket.IO server"
# Should show: "🔮 Received fault_prediction:"
# Should see component status labels update from "No Signal" → actual predictions
```

## ✅ Expected Results

### Before Fix ❌
- Console: `⚠️ No globalStatus or status found - showing "No Signal"`
- Components: All three show "No Signal"
- Debug panel: `Debug: 0 device(s) tracked`

### After Fix ✅
- Console: `🔮 Received fault_prediction: { deviceId: '192.168.1.35', prediction: 'healthy', ... }`
- Components: All three show current status (green/red based on health)
- Debug panel: `Debug: 1 device(s) tracked: 192.168.1.35`
- Component cards show: Bearing, Belt, Flywheel with actual health status

## 📊 Debug Checklist

Check these in your browser console/terminal:

### React Console
```javascript
✅ Look for:
"🔮 Received fault_prediction:"
"📊 Updated deviceStatuses:"
"Debug: 1 device(s) tracked: 192.168.1.35"
```

### Main Server Console
```javascript
✅ Look for:
"✅ Main Server: Connected to UDP Service (port 5001)"
"📨 Main Server: Received fault_prediction:"
"✅ Relayed fault_prediction to X React clients"
```

### UDP Service Console
```javascript
✅ Look for:
"🤖 AI ENABLED - Sending XXXXX samples to AI service"
"🤖 AI Service Response:" (with prediction)
"✅ Emitted to MAIN SERVER (port 5000):"
```

## 🔗 Data Flow Verification

Use this checklist to verify each step works:

1. **AI Service Running**
   - [ ] Port 5001 receives predictions
   - [ ] Returns JSON with "label" field
   - Check: `curl http://localhost:8001/health`

2. **UDP Service Running**
   - [ ] Generates or receives sensor data
   - [ ] Sends data to AI service
   - [ ] Receives predictions back
   - Check logs: `AI ENABLED - Sending XXX samples`

3. **Main Server Running (FIXED)**
   - [ ] Listens on port 5000
   - [ ] Connects to UDP Service on port 5001
   - [ ] Relays fault_prediction events
   - Check logs: `Relayed fault_prediction to X React clients`

4. **React App Running**
   - [ ] Connects to port 5000
   - [ ] Receives fault_prediction events
   - [ ] Updates component status labels
   - Check: Component cards show predictions instead of "No Signal"

## 🐛 Troubleshooting

### If component status still shows "No Signal":
1. Check main server log: Should show `✅ Relayed fault_prediction to X React clients`
2. Check React console: Should show `🔮 Received fault_prediction:` 
3. Verify device ID: Should be `192.168.1.35`
4. Check all ports are running (5000, 5001, 8001)

### If "Connected to UDP Service" fails:
1. Make sure UDP Service is running on port 5001
2. Check firewall isn't blocking localhost connections
3. Verify config files reference correct ports

### If no predictions from AI service:
1. Check AI service is running: `python app.py` in ai-service/
2. Check fault_detector.pt model exists
3. Check requirements.txt dependencies installed
4. Run: `pip install -r requirements.txt`

## 📝 Summary

**The Problem:** Main server wasn't forwarding predictions to React

**The Solution:** Added prediction listeners and relay logic to main server

**Files Modified:** 
- `server/index.js` ✅

**Services Running:**
- AI Service: http://localhost:8001
- UDP Service: http://localhost:5001
- Main Server: http://localhost:5000 (now with relay!)
- React App: http://localhost:3000

**Result:** Component status labels now display predictions! 🎉
