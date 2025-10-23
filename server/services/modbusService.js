const ModbusRTU = require("modbus-serial");
const ipAddress = "192.168.1.35";
class ModbusService {
  constructor() {
    this.connections = new Map(); // Store connections by IP address
    this.pollingIntervals = new Map(); // Store polling intervals
  }

  // Function to convert two 16-bit registers back to double (IEEE 754)
  registers_to_double(reg_high, reg_low) {
    const combined = (BigInt(reg_high) << 16n) | BigInt(reg_low);
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeBigUInt64BE(combined << 32n, 0);
    return buffer.readDoubleLE(0);
  }

  // Connect to a Modbus device
  async connectToDevice(ipAddress, port = 502) {
    const connectionKey = `${ipAddress}:${port}`;
    
    if (this.connections.has(connectionKey)) {
      const connection = this.connections.get(connectionKey);
      // Check if connection is still valid
      if (connection.connected && connection.client.isOpen) {
        return connection;
      }
    }

    try {
      const client = new ModbusRTU();
      await client.connectTCP(ipAddress, { port });
      client.setID(1); // Set Modbus slave ID (usually 1)
      
      const connection = {
        client,
        ipAddress,
        port,
        connected: true,
        lastConnected: new Date()
      };

      this.connections.set(connectionKey, connection);
      console.log(`Modbus connected to ${ipAddress}:${port}`);
      
      return connection;
    } catch (error) {
      console.error(`Failed to connect to Modbus device at ${ipAddress}:${port}`, error);
      throw error;
    }
  }

  // Read voltage data from Modbus device (integrated from your working script)
  async readVoltageData(ipAddress, port = 502) {
    try {
      const connection = await this.connectToDevice(ipAddress, port);
      
      // Read 3 registers: reg0 (high), reg1 (low), reg2 (scaled)
      const data = await connection.client.readHoldingRegisters(0, 3);
      
      console.log(`🔋 Raw register data from ${ipAddress}:`, data.data);
      
      // Method 1: Convert IEEE 754 format (registers 0 and 1)
      const voltage_ieee = this.registers_to_double(data.data[0], data.data[1]);
      
      // Method 2: Use scaled integer (register 2) - same as your working script
      const voltage_scaled = data.data[2] / 1000.0;
      
      console.log(`📊 Live voltage: ${voltage_scaled.toFixed(6)} V`);
      
      return {
        timestamp: new Date().toISOString(),
        voltage: voltage_scaled, // Use the scaled version (same as working script)
        voltageIEEE: voltage_ieee, // Also provide IEEE version for comparison
        voltageRaw: data.data[2], // Raw scaled integer
        registers: data.data, // All register values for debugging
        ipAddress,
        connected: true
      };
    } catch (error) {
      console.error(`Failed to read voltage from ${ipAddress}`, error);
      return {
        timestamp: new Date().toISOString(),
        voltage: 0,
        voltageIEEE: 0,
        voltageRaw: 0,
        ipAddress,
        connected: false,
        error: error.message
      };
    }
  }

  // Read data from multiple devices
  async readFromAllDevices(deviceList) {
    const results = await Promise.allSettled(
      deviceList.map(device => 
        this.readVoltageData(device.ipAddress)
          .then(data => ({ ...data, deviceName: device.name, deviceId: device._id }))
      )
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          deviceName: deviceList[index].name,
          deviceId: deviceList[index]._id,
          ipAddress: deviceList[index].ipAddress,
          connected: false,
          error: result.reason?.message || 'Unknown error',
          timestamp: new Date().toISOString(),
          voltage: 0,
          voltageIEEE: 0,
          voltageRaw: 0
        };
      }
    });
  }

  // Start continuous polling for a device (like your setInterval script)
  startPolling(ipAddress, port = 502, intervalMs = 1000, onData = null) {
    const connectionKey = `${ipAddress}:${port}`;
    
    // Stop existing polling if any
    this.stopPolling(ipAddress, port);
    
    console.log(`Starting voltage polling for ${ipAddress}:${port} every ${intervalMs}ms`);
    
    const pollFunction = async () => {
      try {
        const voltageData = await this.readVoltageData(ipAddress, port);
        
        // Call the callback function if provided
        if (onData && typeof onData === 'function') {
          onData(voltageData);
        }
        
        return voltageData;
      } catch (error) {
        console.error(`Polling error for ${ipAddress}:${port}`, error);
      }
    };
    
    // Initial read
    pollFunction();
    
    // Start interval
    const interval = setInterval(pollFunction, intervalMs);
    this.pollingIntervals.set(connectionKey, interval);
    
    return interval;
  }

  // Stop polling for a device
  stopPolling(ipAddress, port = 502) {
    const connectionKey = `${ipAddress}:${port}`;
    const interval = this.pollingIntervals.get(connectionKey);
    
    if (interval) {
      clearInterval(interval);
      this.pollingIntervals.delete(connectionKey);
      console.log(`Stopped polling for ${ipAddress}:${port}`);
    }
  }

  // Stop all polling
  stopAllPolling() {
    this.pollingIntervals.forEach((interval, key) => {
      clearInterval(interval);
      console.log(`Stopped polling for ${key}`);
    });
    this.pollingIntervals.clear();
  }

  // Test connection and verify data
  async testConnection(ipAddress, port = 502) {
    try {
      console.log(`🔍 Testing connection to ${ipAddress}:${port}`);
      
      const connection = await this.connectToDevice(ipAddress, port);
      console.log(`✅ Connected successfully to ${ipAddress}:${port}`);
      
      // Test reading voltage data
      const voltageData = await this.readVoltageData(ipAddress, port);
      console.log(`📊 Voltage test result:`, voltageData);
      
      return {
        connected: true,
        voltageData: voltageData
      };
    } catch (error) {
      console.error(`❌ Connection test failed for ${ipAddress}:${port}`, error);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  // Get single voltage reading (equivalent to your working script)
  async getSingleVoltageReading(ipAddress, port = 502) {
    try {
      const voltageData = await this.readVoltageData(ipAddress, port);
      return voltageData.voltage;
    } catch (error) {
      console.error(`Error getting single voltage reading from ${ipAddress}:${port}`, error);
      return null;
    }
  }

  // Disconnect from a device
  async disconnectDevice(ipAddress, port = 502) {
    const connectionKey = `${ipAddress}:${port}`;
    
    // Stop polling first
    this.stopPolling(ipAddress, port);
    
    const connection = this.connections.get(connectionKey);
    
    if (connection) {
      try {
        await connection.client.close();
        this.connections.delete(connectionKey);
        console.log(`Disconnected from ${ipAddress}:${port}`);
      } catch (error) {
        console.error(`Error disconnecting from ${ipAddress}:${port}`, error);
      }
    }
  }

  // Disconnect all devices
  async disconnectAll() {
    // Stop all polling first
    this.stopAllPolling();
    
    const disconnectPromises = Array.from(this.connections.keys()).map(key => {
      const [ip, port] = key.split(':');
      return this.disconnectDevice(ip, parseInt(port));
    });
    
    await Promise.all(disconnectPromises);
  }

  // Get connection status
  getConnectionStatus() {
    const status = {};
    this.connections.forEach((connection, key) => {
      const isPolling = this.pollingIntervals.has(key);
      status[key] = {
        connected: connection.connected,
        lastConnected: connection.lastConnected,
        isPolling: isPolling
      };
    });
    return status;
  }

  // Get all polling status
  getPollingStatus() {
    const status = {};
    this.pollingIntervals.forEach((interval, key) => {
      status[key] = {
        isPolling: true,
        intervalId: interval
      };
    });
    return status;
  }
}

module.exports = new ModbusService();