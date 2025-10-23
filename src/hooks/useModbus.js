import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useModbus = () => {
  const { token } = useAuth();
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState({});

  const API_URL = 'http://localhost:5000/api/modbus';
 
  // Helper function for API calls
  const makeApiCall = async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'API call failed');
      }

      return result;
    } catch (error) {
      console.error('Modbus API error:', error);
      setError(error.message);
      throw error;
    }
  };

  // Read data from a specific device
  const readDeviceData = useCallback(async (deviceId) => {
    if (!token) return null;

    setLoading(true);
    try {
      const result = await makeApiCall(`/device/${deviceId}`);
      
      // Update data for this specific device
      setData(prevData => ({
        ...prevData,
        [deviceId]: result
      }));

      return result;
    } catch (error) {
      console.error(`Failed to read data from device ${deviceId}:`, error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Read data from all user's devices
  const readAllDevices = useCallback(async () => {
    if (!token) return [];

    setLoading(true);
    try {
      const result = await makeApiCall('/devices/all');
      
      // Update data for all devices
      const deviceData = {};
      result.devices.forEach(device => {
        deviceData[device.deviceId] = device;
      });
      setData(deviceData);

      return result.devices;
    } catch (error) {
      console.error('Failed to read data from all devices:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Test connection to an IP address
  const testConnection = useCallback(async (ipAddress, port = 502) => {
    if (!token) return null;

    setLoading(true);
    try {
      const result = await makeApiCall('/test-connection', {
        method: 'POST',
        body: JSON.stringify({ ipAddress, port }),
      });

      return result;
    } catch (error) {
      console.error(`Failed to test connection to ${ipAddress}:`, error);
      return { connected: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Get connection status for all devices
  const getConnectionStatus = useCallback(async () => {
    if (!token) return {};

    try {
      const result = await makeApiCall('/status');
      setConnectionStatus(result.connectionStatus);
      return result.connectionStatus;
    } catch (error) {
      console.error('Failed to get connection status:', error);
      return {};
    }
  }, [token]);

  // Start polling data from all devices
  const startPolling = useCallback((intervalMs = 1000) => {
    const interval = setInterval(() => {
      readAllDevices();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [readAllDevices]);

  // Clear error
  const clearError = () => setError(null);

  return {
    data,
    loading,
    error,
    connectionStatus,
    readDeviceData,
    readAllDevices,
    testConnection,
    getConnectionStatus,
    startPolling,
    clearError
  };
};