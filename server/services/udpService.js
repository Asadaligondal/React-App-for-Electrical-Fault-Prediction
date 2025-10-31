const { createUDPListener } = require('../udp/listener.js');
const fetch = require('node-fetch');

// Random Sensor Data Generator for testing without Raspberry Pi
class RandomSensorDataGenerator {
    constructor(io) {
        this.io = io;
        this.deviceId = '192.168.1.35'; // Simulate the Raspberry Pi
        this.sampleRate = 38400; // 38.4kHz
        this.chunkDuration = 1000; // 1 second chunks
        this.samplesPerChunk = this.sampleRate; // 38400 samples per second
        this.isGenerating = false;
        this.dataBuffer = [];
        this.intervalId = null;
        this.aiEnabled = true; // AI predictions enabled by default
        
        // Voltage range: 1.5V to 2.0V
        this.baseVoltage = 1.75; // Center around 1.75V
        this.noiseAmplitude = 0.25; // ±0.25V gives us 1.5-2.0V range
        this.frequency = 50; // 50Hz base frequency (motor running)
        
        // 🎛️ CONTROL VARIABLE: Change this to see different predictions!
        // 0.0 = healthy, 0.3 = bearing fault, 0.6 = belt fault, 0.9 = flywheel fault
        this.faultIntensity = 5; // ← CHANGE THIS VALUE!
        
        // 🎯 EXACT MATCH TO TRAINING DATA FORMAT
        this.CHUNK_SAMPLES = 38400; // Exactly 38,400 samples per chunk
        this.samplesPerChunk = 38400; // Update this to match training
    }

    generateRealisticSample(sampleIndex, timestamp) {
        // Create realistic motor vibration signal
        const t = sampleIndex / this.sampleRate; // Time in seconds
        
        // Base 50Hz motor frequency
        const baseSignal = 0.1 * Math.sin(2 * Math.PI * 50 * t);
        
        // Add some harmonics for realism
        const harmonic1 = 0.05 * Math.sin(2 * Math.PI * 100 * t); // 2nd harmonic
        const harmonic2 = 0.03 * Math.sin(2 * Math.PI * 150 * t); // 3rd harmonic
        
        // Add random noise
        const noise = (Math.random() - 0.5) * 0.02;
        
        // 🎛️ CONTROLLED FAULT SIMULATION based on faultIntensity
        let faultSignal = 0;
        if (this.faultIntensity > 0.0) {
            // Different fault frequencies for different components
            const bearingFreq = 25;   // Bearing defect
            const beltFreq = 15;      // Belt slip/wear
            const flywheelFreq = 35;  // Flywheel imbalance
            
            // Scale amplitude with fault intensity
            const amplitude = this.faultIntensity * 0.15;
            
            // Mix different fault types based on intensity
            faultSignal = amplitude * (
                Math.sin(2 * Math.PI * bearingFreq * t) +
                0.7 * Math.sin(2 * Math.PI * beltFreq * t) +
                0.5 * Math.sin(2 * Math.PI * flywheelFreq * t)
            );
        }
        
        // Combine all signals
        const sample = this.baseVoltage + baseSignal + harmonic1 + harmonic2 + noise + faultSignal;
        
        // Ensure it stays within 1.5-2.0V range
        return Math.max(1.5, Math.min(2.0, sample));
    }

    // 🎯 EXACT PREPROCESSING - Matches your training script
    preprocessChunkLikeTraining(rawSamples) {
        // Convert to array if Float32Array
        const signal = Array.isArray(rawSamples) ? rawSamples : Array.from(rawSamples);
        
        // Calculate chunk statistics (same as training script)
        const chunkMean = signal.reduce((a, b) => a + b, 0) / signal.length;
        const chunkStd = Math.sqrt(signal.reduce((a, b) => a + (b - chunkMean) ** 2, 0) / signal.length);
        
        if (chunkStd > 0) {
            // Z-score normalization then scale to [-1, 1] (EXACT same as training)
            const chunkNormalized = signal.map(x => (x - chunkMean) / chunkStd);
            const chunkMax = Math.max(...chunkNormalized.map(x => Math.abs(x)));
            
            if (chunkMax > 0) {
                const chunkFinal = chunkNormalized.map(x => x / chunkMax);
                return new Float32Array(chunkFinal); // Same as np.float32 in training
            } else {
                return new Float32Array(chunkNormalized);
            }
        } else {
            // If std is 0 (constant signal), just center around 0
            return new Float32Array(signal.length).fill(0);
        }
    }

    generateChunk() {
        const timestamp = Date.now();
        const rawSamples = new Float32Array(this.CHUNK_SAMPLES); // Exactly 38,400
        
        // Generate raw voltage samples (like your original CSV data)
        for (let i = 0; i < this.CHUNK_SAMPLES; i++) {
            rawSamples[i] = this.generateRealisticSample(i, timestamp);
        }
        
        // Apply EXACT same preprocessing as training script
        const processedSamples = this.preprocessChunkLikeTraining(rawSamples);
        
        console.log(`🔥 Generated ${rawSamples.length} samples -> processed to .npy format`);
        console.log(`📈 Raw range: ${Math.min(...rawSamples).toFixed(6)}V to ${Math.max(...rawSamples).toFixed(6)}V`);
        console.log(`🎯 Processed range: ${Math.min(...processedSamples).toFixed(6)} to ${Math.max(...processedSamples).toFixed(6)} (normalized)`);
        
        return {
            deviceId: this.deviceId,
            packetId: Date.now(),
            sampleRate: this.sampleRate,
            samples: processedSamples, // Now matches .npy format exactly
            receivedAt: timestamp
        };
    }

    startGenerating(intervalMs = 100) {
        if (this.isGenerating) {
            console.log('⚠️ Random data generator already running');
            return;
        }

        console.log('🎲 Starting random sensor data generation...');
        console.log(`📊 Generating ${this.samplesPerChunk} samples every ${intervalMs}ms`);
        
        this.isGenerating = true;
        
        this.intervalId = setInterval(() => {
            const chunkData = this.generateChunk();
            this.processChunkData(chunkData);
        }, intervalMs);
    }

    stopGenerating() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isGenerating = false;
        console.log('🛑 Stopped random sensor data generation');
    }
    
    enableAI() {
        this.aiEnabled = true;
        console.log('🤖 AI predictions ENABLED');
    }
    
    disableAI() {
        this.aiEnabled = false;
        console.log('🚫 AI predictions DISABLED');
    }

    processChunkData(chunkData) {
        const { samples } = chunkData;
        
        // Emit to local Socket.IO AND main server (removed deviceId - not needed for chart data)
        const chartChunkSize = 320;
        for (let i = 0; i < samples.length; i += chartChunkSize) {
            const chartSamples = samples.slice(i, i + chartChunkSize);
            
            const chartData = {
                samples: Array.from(chartSamples),
                sampleRate: this.sampleRate,
                timestamp: Date.now()
            };
            
            // Emit to both local and main server (removed verbose logs)
            this.io.emit('raw_sensor_data', chartData);
            if (this.mainServerClient && this.mainServerClient.connected) {
                this.mainServerClient.emit('raw_sensor_data', chartData);
            }
        }

        // Buffer for AI predictions (1 second = 38400 samples)
        this.dataBuffer.push(...samples);

        if (this.dataBuffer.length >= this.samplesPerChunk) {
            const aiChunk = this.dataBuffer.slice(0, this.samplesPerChunk);
            
            // Only send to AI if enabled (removed deviceId parameter)
            if (this.aiEnabled) {
                this.sendToAIService(aiChunk);
            }
            
            // Keep some overlap for next prediction
            this.dataBuffer = this.dataBuffer.slice(this.samplesPerChunk);
        }
    }
    
    async sendToAIService(dataChunk) {
        try {
            const response = await fetch('http://localhost:8001/predict-real-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    samples: Array.from(dataChunk),
                    deviceId: 'motor_system'  // Single system, not device-specific
                })
            });

            const prediction = await response.json();
            
            // AI service returns label as string directly (e.g., 'flywheel', 'bearing', 'belt', 'healthy')
            const predictionLabel = prediction.label || prediction.prediction || 'healthy';
            
            // Simplified prediction data without device ID
            const predictionData = {
                prediction: predictionLabel,
                confidence: prediction.confidence || 0.0,
                timestamp: Date.now()
            };
            
            // Emit to main server (simplified logging)
            if (this.mainServerClient && this.mainServerClient.connected) {
                this.mainServerClient.emit('fault_prediction', predictionData);
                console.log(`🤖 AI Prediction: ${predictionLabel}`);
            }

        } catch (error) {
            console.error('❌ AI service error:', error.message);
            
            // Simplified fallback prediction
            const fallbackPrediction = {
                prediction: 'healthy',
                confidence: 0.0,
                timestamp: Date.now()
            };
            
            if (this.mainServerClient && this.mainServerClient.connected) {
                this.mainServerClient.emit('fault_prediction', fallbackPrediction);
            }
        }
    }

    // Duplicate method removed - using simplified version above
}

class UDPDataProcessor {
    constructor(io) {
        this.io = io;
        this.dataBuffer = {};
        this.bufferDuration = 1000; // 1 second
        this.targetSamples = 38400; // 1 second at 38.4kHz (EXACT match to training)
    }

    // 🎯 REAL DATA PREPROCESSING - Matches training script exactly
    preprocessRealDataChunk(rawVoltageArray) {
        console.log(`🔧 Preprocessing ${rawVoltageArray.length} real samples...`);
        
        // Convert to regular array if needed
        const signal = Array.isArray(rawVoltageArray) ? rawVoltageArray : Array.from(rawVoltageArray);
        
        // EXACT same preprocessing as your training script
        const chunkMean = signal.reduce((a, b) => a + b, 0) / signal.length;
        const chunkStd = Math.sqrt(signal.reduce((a, b) => a + (b - chunkMean) ** 2, 0) / signal.length);
        
        console.log(`📊 Real data stats: mean=${chunkMean.toFixed(6)}, std=${chunkStd.toFixed(6)}, min=${Math.min(...signal).toFixed(6)}, max=${Math.max(...signal).toFixed(6)}`);
        
        if (chunkStd > 0) {
            // Z-score normalization then scale to [-1, 1] (SAME as training)
            const chunkNormalized = signal.map(x => (x - chunkMean) / chunkStd);
            const chunkMax = Math.max(...chunkNormalized.map(x => Math.abs(x)));
            
            if (chunkMax > 0) {
                const chunkFinal = chunkNormalized.map(x => x / chunkMax);
                console.log(`✅ Preprocessed to range: ${Math.min(...chunkFinal).toFixed(6)} to ${Math.max(...chunkFinal).toFixed(6)}`);
                return new Float32Array(chunkFinal); // Same as np.float32 in training
            } else {
                return new Float32Array(chunkNormalized);
            }
        } else {
            // If std is 0 (constant signal), just center around 0
            console.log(`⚠️ Constant signal detected, returning zeros`);
            return new Float32Array(signal.length).fill(0);
        }
    }

    processIncomingData(batchData) {
        const { deviceId, samples } = batchData;
        
        // Emit raw data for charts immediately (simplified - no deviceId needed)
        this.io.emit('raw_sensor_data', {
            samples: Array.from(samples),
            sampleRate: 38400,
            timestamp: Date.now()
        });
        console.log(`📊 Emitted ${samples.length} samples to charts from ${deviceId}`);

        // Buffer for AI predictions
        if (!this.dataBuffer[deviceId]) {
            this.dataBuffer[deviceId] = {
                data: [],
                timestamp: Date.now()
            };
        }

        // Add samples to buffer
        this.dataBuffer[deviceId].data.push(...samples);

        // Check if we have enough data for AI prediction (1 second = 38400 samples)
        if (this.dataBuffer[deviceId].data.length >= this.targetSamples) {
            const rawChunk = this.dataBuffer[deviceId].data.slice(0, this.targetSamples);
            
            // 🎯 Apply EXACT same preprocessing as training script
            const preprocessedChunk = this.preprocessRealDataChunk(rawChunk);
            
            console.log(`🤖 Sending preprocessed ${preprocessedChunk.length} samples (.npy format) to AI service`);
            this.sendToAIService(deviceId, preprocessedChunk);
            
            // Keep overflow data for next chunk
            this.dataBuffer[deviceId].data = this.dataBuffer[deviceId].data.slice(this.targetSamples);
            this.dataBuffer[deviceId].timestamp = Date.now();
        }
    }

    async sendToAIService(deviceId, dataChunk) {
        try {
            const response = await fetch('http://localhost:8001/predict-real-time', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    samples: Array.from(dataChunk),
                    deviceId: deviceId
                })
            });

            const prediction = await response.json();
            
            console.log('🤖 AI Service Response:', prediction);
            
            // Emit to frontend with proper prediction structure
            this.io.emit('fault_prediction', {
                deviceId: deviceId,
                prediction: prediction.label || 'unknown',
                confidence: prediction.confidence || 0.0,
                timestamp: Date.now()
            });
            
            console.log(`🚀 Emitted prediction: ${prediction.label} for device ${deviceId}`);

        } catch (error) {
            console.error('Error sending to AI service:', error);
        }
    }

    startListening(port = 3000) {
        const udpSocket = createUDPListener(
            { port }, 
            (batchData) => this.processIncomingData(batchData)
        );
        return udpSocket;
    }
}

module.exports = { UDPDataProcessor, RandomSensorDataGenerator };
