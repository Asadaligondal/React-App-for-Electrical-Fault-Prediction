const http = require('http');
const socketIo = require('socket.io');
const ioClient = require('socket.io-client');
const dgram = require('dgram');
const config = require('./config.js');
const { UDPDataProcessor, RandomSensorDataGenerator } = require('./server/services/udpService.js');

console.log('🎚️ Data Source Mode:', config.USE_FAKE_DATA ? 'FAKE DATA' : 'REAL RASPBERRY PI');

// Create a separate Socket.IO server for UDP service
const server = http.createServer();
const io = socketIo(server, {
    cors: {
        origin: config.CORS_ORIGINS,
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Connect to main server to forward predictions
const mainServerClient = ioClient(`http://localhost:${config.MAIN_SERVER_PORT}`, {
    transports: ['websocket', 'polling']
});
console.log('🔄 Connecting to main server for prediction forwarding...');

mainServerClient.on('connect', () => {
    console.log('✅ Connected to main server for data forwarding');
    
    // Listen for AI control commands from main server
    mainServerClient.on('enable_ai', () => {
        console.log('🤖 Received enable_ai command from main server');
        if (dataGeneratorInstance) {
            dataGeneratorInstance.enableAI();
        }
    });
    
    mainServerClient.on('disable_ai', () => {
        console.log('🚫 Received disable_ai command from main server');
        if (dataGeneratorInstance) {
            dataGeneratorInstance.disableAI();
        }
    });
});

mainServerClient.on('disconnect', () => {
    console.log('❌ Disconnected from main server');
});

// Handle React app connections
io.on('connection', (socket) => {
    console.log('🔌 React app connected to UDP Socket.IO:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('🔌 React app disconnected from UDP Socket.IO:', socket.id);
    });
});

// Variable to store the data generator for AI control
let dataGeneratorInstance = null;

// Start the Socket.IO server
server.listen(config.UDP_SERVER_PORT, () => {
    console.log(`🚀 UDP Socket.IO server running on port ${config.UDP_SERVER_PORT}`);
});

// 🎚️ TOGGLE LOGIC - Use config file setting
if (config.USE_FAKE_DATA) {
    // Use fake random sensor data
    console.log('🎲 Using FAKE random sensor data generator');
    const fakeDataGenerator = new RandomSensorDataGenerator(io);
    dataGeneratorInstance = fakeDataGenerator; // Store for AI control
    
    // ✅ SET THE MAIN SERVER CLIENT
    fakeDataGenerator.mainServerClient = mainServerClient;
    console.log('🔗 MainServerClient set on generator');
    console.log('   Client exists:', !!mainServerClient);
    console.log('   Client connected:', mainServerClient.connected);
    
    fakeDataGenerator.startGenerating(config.FAKE_DATA_CONFIG.generateIntervalMs);
    
    console.log('✅ Fake sensor data service started successfully!');
    console.log(`- Device ID: ${config.FAKE_DATA_CONFIG.deviceId}`);
    console.log(`- Sample rate: ${config.FAKE_DATA_CONFIG.sampleRate}Hz`);
    console.log(`- Voltage range: ${config.FAKE_DATA_CONFIG.voltageRange[0]}-${config.FAKE_DATA_CONFIG.voltageRange[1]}V`);
    console.log(`- Broadcasting via Socket.IO on port ${config.UDP_SERVER_PORT}`);
    
    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down fake data service...');
        fakeDataGenerator.stopGenerating();
        server.close();
        process.exit(0);
    });
    
} else {
    // 🔗 REAL DATA MODE - Listen for Raspberry Pi UDP data (BINARY FORMAT)
    console.log('📡 Using REAL UDP data from Raspberry Pi');
    
    // Create proxy IO for real data 
    const proxyIO = {
        emit: (event, data) => {
            io.emit(event, data);
            if (mainServerClient.connected) {
                mainServerClient.emit(event, data);
            }
        }
    };
    
    const dataProcessor = new UDPDataProcessor(proxyIO);
    
    // 🎯 Use the correct UDP listener for BINARY data from Pi
    const { createUDPListener } = require('./server/udp/listener.js');
    
    const udpSocket = createUDPListener(
        { 
            port: config.RASPBERRY_PI_CONFIG.port,  // Port 3000
            host: "0.0.0.0" 
        }, 
        (batchData) => {
            console.log(`📡 Processing batch: ${batchData.samples.length} samples from ${batchData.deviceId}`);
            dataProcessor.processIncomingData(batchData);
        }
    );
    
    console.log('✅ Real UDP listener service started successfully!');
    console.log(`- Listening on port ${config.RASPBERRY_PI_CONFIG.port} for BINARY data`);
    console.log(`- Expected Raspberry Pi IP: ${config.RASPBERRY_PI_CONFIG.ip}`);
    console.log(`- Expected format: [packetId][count][320 x float32LE voltages]`);
    console.log(`- Sample rate: ${config.RASPBERRY_PI_CONFIG.sampleRate}Hz expected`);
    console.log(`- Broadcasting via Socket.IO on port ${config.UDP_SERVER_PORT}`);

    // Graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nShutting down real UDP service...');
        udpSocket.close();
        server.close();
        process.exit(0);
    });
}