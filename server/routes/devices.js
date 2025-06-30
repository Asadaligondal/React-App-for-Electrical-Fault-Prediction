const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Get all devices for the authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ devices: user.devices });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a new device
router.post('/', auth, async (req, res) => {
  try {
    const { name, ipAddress } = req.body;

    // Basic validation
    if (!name || !ipAddress) {
      return res.status(400).json({ error: 'Name and IP address are required' });
    }

    const user = await User.findById(req.user._id);
    
    // Check if device name already exists for this user
    const existingDevice = user.devices.find(device => device.name === name);
    if (existingDevice) {
      return res.status(400).json({ error: 'Device with this name already exists' });
    }

    // Add new device
    user.devices.push({ name, ipAddress });
    await user.save();

    res.status(201).json({ 
      message: 'Device added successfully',
      device: user.devices[user.devices.length - 1]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a device
router.put('/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { name, ipAddress } = req.body;

    const user = await User.findById(req.user._id);
    const device = user.devices.id(deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    // Update device fields
    if (name) device.name = name;
    if (ipAddress) device.ipAddress = ipAddress;

    await user.save();

    res.json({ 
      message: 'Device updated successfully',
      device
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a device
router.delete('/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const user = await User.findById(req.user._id);
    user.devices.id(deviceId).deleteOne();
    await user.save();

    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;