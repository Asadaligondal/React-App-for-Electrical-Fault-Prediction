const fetch = require('node-fetch'); // You might need to install this

class AIService {
  constructor() {
    this.aiServiceUrl = 'http://localhost:8001';
    this.isConnected = false;
  }

  // Test connection to AI service
  async testConnection() {
    try {
      const response = await fetch(`${this.aiServiceUrl}/health`);
      const data = await response.json();
      this.isConnected = response.ok;
      return { connected: this.isConnected, data };
    } catch (error) {
      this.isConnected = false;
      return { connected: false, error: error.message };
    }
  }

  // Get AI predictions for sensor data
  async getPredictions(sensorData) {
    try {
      const response = await fetch(`${this.aiServiceUrl}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sensorData)
      });

      if (!response.ok) {
        throw new Error(`AI Service responded with status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('AI Service call failed:', error);
      throw error;
    }
  }

  // Convert Modbus data to AI service format
  formatSensorData(voltage, deviceId, timestamp = Date.now()) {
    return {
      voltage: parseFloat(voltage),
      deviceId: deviceId,
      timestamp: timestamp
    };
  }
}

module.exports = new AIService();