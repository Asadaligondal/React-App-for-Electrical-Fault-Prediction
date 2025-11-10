const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const connectDB = require('./server/config/database');
const config = require('./config');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Enhanced Socket.IO with better CORS and transport options
const io = socketIo(server, {
    cors: {
        origin: [
            'http://localhost:8080',  // Frontend container
            'http://localhost:3000',  // React dev server
            'http://localhost',       // Production
            'http://127.0.0.1:8080',  // Alternative localhost
            'http://127.0.0.1:3000',
            'http://127.0.0.1'
        ],
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"]
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
});

const PORT = process.env.PORT || config.MAIN_SERVER_PORT;

// Connect to MongoDB
connectDB();

// Enhanced CORS middleware
app.use(cors({
    origin: [
        'http://localhost:8080',  // Frontend container
        'http://localhost:3000',  // React dev server
        'http://localhost',       // Production
        'http://127.0.0.1:8080',  // Alternative localhost
        'http://127.0.0.1:3000',
        'http://127.0.0.1'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json());

// Routes
app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/devices', require('./server/routes/devices'));  // Add this line
// Basic test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend server is running!' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Handle fault predictions from UDP service
    socket.on('fault_prediction', (data) => {
        console.log('📥 MAIN SERVER received fault prediction:', data);
        console.log(`   From client: ${socket.id}`);
        console.log(`   Will broadcast to ${io.engine.clientsCount} connected clients`);
        // Broadcast to all connected React clients
        io.emit('fault_prediction', data);
        console.log('📤 Broadcasted prediction to all React clients');
    });
    
    // Handle raw sensor data from UDP service for charts
    socket.on('raw_sensor_data', (data) => {
        console.log(`📊 Received chart data: ${data.samples.length} samples for device ${data.deviceId}`);
        // Broadcast to all connected React clients
        io.emit('raw_sensor_data', data);
    });
    
    // Handle AI control from React app
    socket.on('enable_ai', () => {
        console.log('🤖 Received enable_ai command from React');
        // Broadcast to UDP service
        io.emit('enable_ai');
    });
    
    socket.on('disable_ai', () => {
        console.log('🚫 Received disable_ai command from React');
        // Broadcast to UDP service
        io.emit('disable_ai');
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Export io for use in other modules
module.exports = { io };