import React, { createContext, useContext, useState } from 'react';

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
  // Initial dummy device data - this will be replaced by Firebase data later
  const [devices, setDevices] = useState([
    { id: 'dev1', name: "Motor", status: "Normal", health: 90, imageUrl: "" },
    { id: 'dev2', name: "Pulley", status: "Normal", health: 85, imageUrl: "" },
    { id: 'dev3', name: "Belt", status: "Warning", health: 60, imageUrl: "" },
    { id: 'dev4', name: "Bearing", status: "Normal", health: 95, imageUrl: "" },
    { id: 'dev5', name: "Gear", status: "Faulty", health: 35, imageUrl: "" },
  ]);

  // Function to add a new device
  const addDevice = (newDevice) => {
    const id = `custom-dev-${Date.now()}`;
    const deviceWithId = { ...newDevice, id };
    setDevices(prevDevices => [...prevDevices, deviceWithId]);
    console.log("New device added (to context):", deviceWithId);
    return deviceWithId;
  };

  // Function to delete a device
  const deleteDevice = (deviceId) => {
    setDevices(prevDevices => prevDevices.filter(device => device.id !== deviceId));
    console.log(`Device with ID: ${deviceId} deleted from context`);
  };

  // Function to update device status
  const updateDeviceStatus = (deviceId, newStatus) => {
    setDevices(prevDevices => 
      prevDevices.map(device =>
        device.id === deviceId ? { ...device, status: newStatus } : device
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
          
          // Update status and add AI confidence info
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

  // Function to manually update device health (for demo/testing)
  const updateDeviceHealth = (deviceId, newHealth) => {
    setDevices(prevDevices => 
      prevDevices.map(device =>
        device.id === deviceId ? { ...device, health: newHealth } : device
      )
    );
    console.log(`Device ID: ${deviceId} health updated to: ${newHealth}%`);
  };

  // Function to get a specific device by ID
  const getDeviceById = (deviceId) => {
    return devices.find(device => device.id === deviceId);
  };

  // Function to get device by name
  const getDeviceByName = (deviceName) => {
    return devices.find(device => device.name.toLowerCase() === deviceName.toLowerCase());
  };

  // Context value object
  const contextValue = {
    devices,
    addDevice,
    deleteDevice,
    updateDeviceStatus,
    updateDevicesFromAI,
    updateDeviceHealth,
    getDeviceById,
    getDeviceByName,
    deviceCount: devices.length
  };

  return (
    <DevicesContext.Provider value={contextValue}>
      {children}
    </DevicesContext.Provider>
  );
};