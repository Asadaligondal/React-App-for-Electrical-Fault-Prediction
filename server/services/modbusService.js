const ModbusRTU = require("modbus-serial");

class ModbusService {
  constructor() {
    this.connections = new Map(); // Store connections by IP address
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
      return this.connections.get(connectionKey);
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

  // Read accelerometer data (assuming registers 0-2 for X, Y, Z)
  async readVoltageData(ipAddress, port = 502) {
  try {
    const connection = await this.connectToDevice(ipAddress, port);
    
    // Read 3 holding registers starting from address 0 (reg0, reg1, reg2)
    const data = await connection.client.readHoldingRegisters(0, 3);
    
    // Method 1: Convert IEEE 754 format (registers 0 and 1) - optional
    const voltage_ieee = this.registers_to_double(data.data[0], data.data[1]);
    
    // Method 2: Use scaled integer (register 2) - primary method
    const voltage_scaled = data.data[2] / 1000.0;
    
    return {
      timestamp: new Date().toISOString(),
      voltage: voltage_scaled, // Primary voltage reading
      voltage_ieee: voltage_ieee, // Alternative IEEE format (optional)
      raw_registers: [data.data[0], data.data[1], data.data[2]], // For debugging
      ipAddress,
      connected: true
    };
  } catch (error) {
    console.error(`Failed to read voltage data from ${ipAddress}`, error);
    return {
      timestamp: new Date().toISOString(),
      voltage: 0,
      voltage_ieee: 0,
      raw_registers: [0, 0, 0],
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
        voltage_ieee: 0,
        raw_registers: [0, 0, 0]
      };
    }
  });
}

  // Disconnect from a device
  async disconnectDevice(ipAddress, port = 502) {
    const connectionKey = `${ipAddress}:${port}`;
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
      status[key] = {
        connected: connection.connected,
        lastConnected: connection.lastConnected
      };
    });
    return status;
  }
}

module.exports = new ModbusService();