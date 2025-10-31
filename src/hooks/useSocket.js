import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export const useSocket = () => {
    const [socket, setSocket] = useState(null);
    const [deviceStatuses, setDeviceStatuses] = useState({});

    useEffect(() => {
        // Connect to main server Socket.IO for predictions and raw data
        const MAIN_SOCKET_SERVER = 'http://localhost:5000';
        console.log('🔌 Connecting to main Socket.IO server:', MAIN_SOCKET_SERVER);
        
        const newSocket = io(MAIN_SOCKET_SERVER, {
            forceNew: true,
            timeout: 10000,
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
            upgrade: true
        });
        setSocket(newSocket);

        newSocket.on('fault_prediction', (data) => {
            console.log('🔮 AI Prediction:', data.prediction);
            // Store prediction as global system status (no device ID needed)
            setDeviceStatuses({
                globalPrediction: {
                    status: data.prediction,
                    confidence: data.confidence || 0.0,
                    timestamp: data.timestamp
                }
            });
        });

        newSocket.on('raw_sensor_data', (data) => {
            // Raw data received (no logging to reduce clutter)
        });

        newSocket.on('connect', () => {
            console.log('✅ Connected to main Socket.IO server');
        });

        newSocket.on('connect_error', (error) => {
            console.error('❌ Main Socket.IO server connection error:', error);
        });

        return () => {
            console.log('🔌 Disconnecting from UDP Socket.IO server');
            newSocket.close();
        };
    }, []);

    return { socket, deviceStatuses };
};