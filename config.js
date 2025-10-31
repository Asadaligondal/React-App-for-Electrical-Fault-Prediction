// Central configuration for toggling between fake and real data
module.exports = {
  // 🎚️ MAIN TOGGLE - Change this to switch data source
  USE_FAKE_DATA: false, // true = fake data, false = real Raspberry Pi data
  
  // Server configuration
  MAIN_SERVER_PORT: 5000,
  UDP_SERVER_PORT: 5001,
  AI_SERVICE_PORT: 8001,
  
  // Real Raspberry Pi configuration (when USE_FAKE_DATA = false)
  RASPBERRY_PI_CONFIG: {
    ip: '192.168.1.35',
    port: 3000,  // ← FIXED: Match Pi's PC_PORT = 3000
    sampleRate: 38400
  },
  
  // Fake data configuration (when USE_FAKE_DATA = true)
  FAKE_DATA_CONFIG: {
    deviceId: '192.168.1.35',
    sampleRate: 38400,
    generateIntervalMs: 100, // Generate data every 100ms
    voltageRange: [1.5, 2.0]
  },
  
  // CORS configuration
  CORS_ORIGINS: [
    "http://localhost:3000", // React app
    "http://localhost:5000", // Main server
    "http://localhost:5001", // UDP server
    "http://127.0.0.1:3000", 
    "http://127.0.0.1:5000",
    "http://127.0.0.1:5001"
  ]
};