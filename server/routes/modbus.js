const express = require('express');
const modbusService = require('../services/modbusService');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

// Get real-time data from a specific device
router.get('/device/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const user = await User.findById(req.user._id);
    const device = user.devices.id(deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const data = await modbusService.readAccelerometerData(device.ipAddress);
    res.json({ device: device.name, ...data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get data from all user's devices
router.get('/devices/all', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const devicesData = await modbusService.readFromAllDevices(user.devices);
    
    res.json({ devices: devicesData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test connection to a specific IP
router.post('/test-connection', auth, async (req, res) => {
  try {
    const { ipAddress, port = 502 } = req.body;
    
    if (!ipAddress) {
      return res.status(400).json({ error: 'IP address is required' });
    }

    const data = await modbusService.readAccelerometerData(ipAddress, port);
    res.json({ 
      message: 'Connection test completed',
      ...data 
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Connection test failed',
      details: error.message 
    });
  }
});

// Get connection status for all devices
router.get('/status', auth, async (req, res) => {
  try {
    const status = modbusService.getConnectionStatus();
    res.json({ connectionStatus: status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;