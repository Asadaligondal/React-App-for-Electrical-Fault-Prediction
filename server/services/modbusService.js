const ModbusRTU = require("modbus-serial");

class ModbusService {
  constructor() {
    this.connections = new Map(); // Store connections by IP address
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
  async readAccelerometerData(ipAddress, port = 502) {
    try {
      const connection = await this.connectToDevice(ipAddress, port);
      
      // Read 3 holding registers starting from address 0 (X, Y, Z accelerometer data)
      const data = await connection.client.readHoldingRegisters(0, 3);
      
      return {
        timestamp: new Date().toISOString(),
        x: data.data[0] / 100, // Assuming data needs scaling (adjust as needed)
        y: data.data[1] / 100,
        z: data.data[2] / 100,
        ipAddress,
        connected: true
      };
    } catch (error) {
      console.error(`Failed to read data from ${ipAddress}`, error);
      return {
        timestamp: new Date().toISOString(),
        x: 0,
        y: 0,
        z: 0,
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
        this.readAccelerometerData(device.ipAddress)
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
          x: 0, y: 0, z: 0
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