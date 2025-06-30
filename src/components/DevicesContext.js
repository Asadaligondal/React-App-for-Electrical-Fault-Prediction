import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Create the context
const DevicesContext = createContext();

// Custom hook to use the context
export const useDevices = () => {
  const context = useContext(DevicesContext);
  if (!context) {
    throw new Error('useDevices must be used within a DevicesProvider');
  }
  return context;
};

// Provider component
export const DevicesProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_URL = 'http://localhost:5000/api';

  // Helper function to make authenticated API calls
  const makeApiCall = async (url, options = {}) => {
    try {
      const response = await fetch(`${API_URL}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API call failed');
      }

      return data;
    } catch (error) {
      console.error('API call error:', error);
      setError(error.message);
      throw error;
    }
  };

  // Fetch devices when user logs in
  const fetchDevices = async () => {
    if (!user || !token) return;

    setLoading(true);
    setError(null);

    try {
      const data = await makeApiCall('/devices');
      setDevices(data.devices || []);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
      // If fetch fails, set some default devices so the UI still works
      setDevices([
        { _id: 'default1', name: "Motor", status: "Normal", health: 90, imageUrl: "", ipAddress: "192.168.1.100" },
        { _id: 'default2', name: "Pulley", status: "Normal", health: 85, imageUrl: "", ipAddress: "192.168.1.101" },
        { _id: 'default3', name: "Belt", status: "Warning", health: 60, imageUrl: "", ipAddress: "192.168.1.102" },
        { _id: 'default4', name: "Bearing", status: "Normal", health: 95, imageUrl: "", ipAddress: "192.168.1.103" },
        { _id: 'default5', name: "Gear", status: "Faulty", health: 35, imageUrl: "", ipAddress: "192.168.1.104" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Load devices when user logs in
  useEffect(() => {
    if (user && token) {
      fetchDevices();
    } else {
      setDevices([]);
    }
  }, [user, token]);

  // Function to add a new device
  const addDevice = async (newDevice) => {
    if (!user || !token) {
      setError('User not authenticated');
      return null;
    }

    try {
      setLoading(true);
      const data = await makeApiCall('/devices', {
        method: 'POST',
        body: JSON.stringify(newDevice),
      });

      const deviceWithId = { ...data.device, id: data.device._id };
      setDevices(prevDevices => [...prevDevices, deviceWithId]);
      console.log("New device added:", deviceWithId);
      return deviceWithId;
    } catch (error) {
      console.error('Failed to add device:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Function to delete a device
  const deleteDevice = async (deviceId) => {
    if (!user || !token) {
      setError('User not authenticated');
      return;
    }

    try {
      setLoading(true);
      
      // Find the device to get its MongoDB _id
      const device = devices.find(d => d.id === deviceId || d._id === deviceId);
      const mongoId = device?._id || deviceId;

      await makeApiCall(`/devices/${mongoId}`, {
        method: 'DELETE',
      });

      setDevices(prevDevices => 
        prevDevices.filter(device => 
          device.id !== deviceId && device._id !== deviceId
        )
      );
      console.log(`Device with ID: ${deviceId} deleted`);
    } catch (error) {
      console.error('Failed to delete device:', error);
    } finally {
      setLoading(false);
    }
  };

  // Function to update device status (local only - not saved to backend yet)
  const updateDeviceStatus = (deviceId, newStatus) => {
    setDevices(prevDevices => 
      prevDevices.map(device =>
        (device.id === deviceId || device._id === deviceId) 
          ? { ...device, status: newStatus } 
          : device
      )
    );
    console.log(`Device ID: ${deviceId} status updated to: ${newStatus}`);
  };

  // Function to update multiple device statuses from AI predictions
  const updateDevicesFromAI = (aiPredictions) => {
    if (!aiPredictions) return;

    setDevices(prevDevices => {
      const updatedDevices = prevDevices.map(device => {
        const componentName = device.name.toLowerCase();
        
        if (aiPredictions[componentName]) {
          const prediction = aiPredictions[componentName];
          
          return {
            ...device,
            status: prediction.status,
            aiConfidence: Math.round(prediction.confidence * 100),
            lastAIUpdate: Date.now()
          };
        }
        
        return device;
      });

      console.log('Devices updated from AI predictions:', updatedDevices);
      return updatedDevices;
    });
  };

  // Function to manually update device health (local only)
  const updateDeviceHealth = (deviceId, newHealth) => {
    setDevices(prevDevices => 
      prevDevices.map(device =>
        (device.id === deviceId || device._id === deviceId)
          ? { ...device, health: newHealth } 
          : device
      )
    );
    console.log(`Device ID: ${deviceId} health updated to: ${newHealth}%`);
  };

  // Function to get a specific device by ID
  const getDeviceById = (deviceId) => {
    return devices.find(device => 
      device.id === deviceId || device._id === deviceId
    );
  };

  // Function to get device by name
  const getDeviceByName = (deviceName) => {
    return devices.find(device => 
      device.name.toLowerCase() === deviceName.toLowerCase()
    );
  };

  // Function to refresh devices from server
  const refreshDevices = () => {
    if (user && token) {
      fetchDevices();
    }
  };

  // Context value object
  const contextValue = {
    devices: devices.map(device => ({
      ...device,
      id: device.id || device._id // Ensure id field exists for backward compatibility
    })),
    addDevice,
    deleteDevice,
    updateDeviceStatus,
    updateDevicesFromAI,
    updateDeviceHealth,
    getDeviceById,
    getDeviceByName,
    refreshDevices,
    deviceCount: devices.length,
    loading,
    error,
    clearError: () => setError(null)
  };

  return (
    <DevicesContext.Provider value={contextValue}>
      {children}
    </DevicesContext.Provider>
  );
};