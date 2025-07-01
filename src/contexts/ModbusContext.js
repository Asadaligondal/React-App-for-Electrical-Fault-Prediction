import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useModbus } from '../hooks/useModbus';

const ModbusContext = createContext();

export const useModbusData = () => {
  const context = useContext(ModbusContext);
  if (!context) {
    throw new Error('useModbusData must be used within a ModbusProvider');
  }
  return context;
};

export const ModbusProvider = ({ children }) => {
  const { user } = useAuth();
  const modbus = useModbus();
  const [isPolling, setIsPolling] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);

  // Auto-start polling when user logs in
  useEffect(() => {
    if (user && !isPolling) {
      startPolling();
    }

    return () => {
      if (pollingInterval) {
        pollingInterval();
        setPollingInterval(null);
      }
    };
  }, [user]);

  const startPolling = (intervalMs = 2000) => {
    if (pollingInterval) {
      pollingInterval(); // Clear existing interval
    }

    const stopPolling = modbus.startPolling(intervalMs);
    setPollingInterval(() => stopPolling);
    setIsPolling(true);
    console.log(`Started Modbus polling every ${intervalMs}ms`);
  };

  const stopPolling = () => {
    if (pollingInterval) {
      pollingInterval();
      setPollingInterval(null);
      setIsPolling(false);
      console.log('Stopped Modbus polling');
    }
  };

  const value = {
    ...modbus,
    isPolling,
    startPolling,
    stopPolling
  };

  return (
    <ModbusContext.Provider value={value}>
      {children}
    </ModbusContext.Provider>
  );
};