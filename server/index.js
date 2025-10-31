const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const ioClient = require('socket.io-client');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:5001", "http://localhost:5002"],
        methods: ["GET", "POST"]
    }
});

// Store connected React clients
const reactClients = new Set();

app.get("/health", (_req, res) => res.json({ ok: true }));

io.on("connection", (socket) => {
    console.log('🔌 Client connected to main server:', socket.id);
    reactClients.add(socket.id);
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected from main server:', socket.id);
        reactClients.delete(socket.id);
    });
    
    // Listen for fault predictions from UDP service
    socket.on('fault_prediction', (data) => {
        io.emit('fault_prediction', data);
        console.log(`🤖 Prediction: ${data.prediction}`);
    });
    
    // Listen for raw sensor data from UDP service
    socket.on('raw_sensor_data', (data) => {
        io.emit('raw_sensor_data', data);
        // Raw data relayed (no logging to reduce clutter)
    });
});

// Connect to UDP service to listen for predictions it sends
const udpServiceClient = ioClient('http://localhost:5001', {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10
});

udpServiceClient.on('connect', () => {
    console.log('✅ Main Server: Connected to UDP Service (port 5001)');
});

udpServiceClient.on('fault_prediction', (data) => {
    io.emit('fault_prediction', data);
    console.log(`🤖 Prediction: ${data.prediction}`);
});

udpServiceClient.on('raw_sensor_data', (data) => {
    io.emit('raw_sensor_data', data);
});

udpServiceClient.on('disconnect', () => {
    console.log('❌ Main Server: Disconnected from UDP Service');
});

server.listen(process.env.STREAM_HTTP_PORT || 5000, () => {
    console.log(`✅ Main Server running on port ${process.env.STREAM_HTTP_PORT || 5000}`);
});
