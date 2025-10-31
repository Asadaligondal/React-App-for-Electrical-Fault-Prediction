// server/udp/listener.js
const dgram = require("dgram");

/**
 * UDP listener for Raspberry Pi binary data packets
 * Pi sends: [uint32LE packetId][uint32LE count][count x float32LE voltage values]
 * Pi config: 192.168.1.25:3000, BATCH_SIZE=320, SAMPLE_RATE=38400
 */
function createUDPListener({ port, host = "0.0.0.0" }, onBatch) {
  const sock = dgram.createSocket("udp4");

  sock.on("message", (msg, rinfo) => {
    console.log(`📦 Received UDP from ${rinfo.address}:${rinfo.port}, size: ${msg.length} bytes`);
    
    try {
      if (msg.length < 8) {
        console.log("⚠️ Packet too small, need at least 8 bytes for header");
        return;
      }
      
      const packetId = msg.readUInt32LE(0);
      const count    = msg.readUInt32LE(4);
      const expected = 8 + count * 4; // Header (8 bytes) + samples (count * 4 bytes each)
      
      console.log(`📊 Packet ID: ${packetId}, Sample count: ${count}, Expected size: ${expected}`);
      
      if (msg.length < expected) {
        console.log(`⚠️ Packet size mismatch. Got ${msg.length}, expected ${expected}`);
        return;
      }

      // Parse voltage samples (float32LE format from Pi)
      const samples = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        samples[i] = msg.readFloatLE(8 + i * 4);
      }

      console.log(`✅ Parsed ${samples.length} voltage samples from Raspberry Pi`);
      console.log(`📈 Voltage range: ${Math.min(...samples).toFixed(6)}V to ${Math.max(...samples).toFixed(6)}V`);
      console.log(`🎯 Sample preview: [${Array.from(samples.slice(0, 3)).map(v => v.toFixed(4)).join(', ')}...]`);

      // Send to UDP data processor for chart plotting and AI prediction
      onBatch?.({
        deviceId: rinfo.address,     // Pi IP as device ID
        packetId: packetId,
        sampleRate: 38400,           // Matches Pi SAMPLE_RATE
        samples: samples,            // Raw voltage values (will be preprocessed later)
        receivedAt: Date.now(),
        batchSize: count             // Pi BATCH_SIZE (320)
      });
      
    } catch (err) {
      console.error("❌ UDP decode error:", err);
      console.error("📦 Raw packet (first 50 bytes):", msg.slice(0, 50));
    }
  });

  sock.on("error", (err) => {
    console.error("❌ UDP socket error:", err);
  });

  sock.on("listening", () => {
    const addr = sock.address();
    console.log(`🟢 UDP Server listening at ${addr.address}:${addr.port}`);
    console.log(`📡 Ready to receive data from Raspberry Pi`);
    console.log(`🎯 Pi should send to: ${addr.address}:${addr.port}`);
    console.log(`📊 Expected: Binary packets with 320 voltage samples each`);
    console.log(`🔌 Pi config: PC_IP="192.168.1.25", PC_PORT=3000, BATCH_SIZE=320`);
  });

  sock.bind(port, host);

  return sock;
}

module.exports = { createUDPListener };
