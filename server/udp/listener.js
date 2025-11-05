// server/udp/listener.js
const dgram = require("dgram");

/**
 * UDP listener for NEW Raspberry Pi packet format
 * Pi sends: [windowId (4B)][packetSeqId (4B)][chunkStartIndex (4B)][chunkLength (4B)][320 × float32LE samples]
 * Total size: 16 bytes header + 1280 bytes payload = 1296 bytes per packet
 * Pi sends 120 packets per second (38400 samples / 320 samples per packet)
 */
function createUDPListener({ port, host = "0.0.0.0" }, onBatch) {
  const sock = dgram.createSocket("udp4");
  
  // Buffer to reassemble 1-second windows (38,400 samples)
  const windowBuffers = new Map(); // windowId -> { samples: Float32Array, receivedPackets: Set }

  sock.on("message", (msg, rinfo) => {
    try {
      // Validate minimum packet size: 16 bytes header + at least some samples
      if (msg.length < 16) {
        console.log("⚠️ Packet too small, need at least 16 bytes for header");
        return;
      }
      
      // Parse NEW header format (16 bytes)
      const windowId = msg.readUInt32LE(0);         // Which 1-second window
      const packetSeqId = msg.readUInt32LE(4);      // Packet sequence number
      const chunkStartIndex = msg.readUInt32LE(8);  // Sample index in window (0, 320, 640, ...)
      const chunkLength = msg.readUInt32LE(12);     // Number of samples in this chunk (usually 320)
      
      const expectedPayloadSize = chunkLength * 4; // 4 bytes per float32
      const expectedTotalSize = 16 + expectedPayloadSize;
      
      // Validate packet size
      if (msg.length < expectedTotalSize) {
        console.log(`⚠️ Packet size mismatch. Got ${msg.length}, expected ${expectedTotalSize}`);
        return;
      }

      // Parse voltage samples (float32LE format)
      const samples = new Float32Array(chunkLength);
      for (let i = 0; i < chunkLength; i++) {
        samples[i] = msg.readFloatLE(16 + i * 4); // Start after 16-byte header
      }

      // Initialize window buffer if this is first packet for this window
      if (!windowBuffers.has(windowId)) {
        windowBuffers.set(windowId, {
          samples: new Float32Array(38400), // Full 1-second buffer
          receivedPackets: new Set(),
          receivedCount: 0,
          startTime: Date.now()
        });
      }

      const windowBuffer = windowBuffers.get(windowId);
      
      // Copy samples into correct position in 1-second window
      windowBuffer.samples.set(samples, chunkStartIndex);
      windowBuffer.receivedPackets.add(packetSeqId);
      windowBuffer.receivedCount++;

      // Log progress every 30 packets (~ 1/4 second)
      if (windowBuffer.receivedCount % 30 === 0) {
        console.log(`📊 Window ${windowId}: Received ${windowBuffer.receivedCount}/120 packets (${(windowBuffer.receivedCount/120*100).toFixed(1)}%)`);
      }

      // Check if we have all 120 packets for this 1-second window
      // 38400 samples / 320 samples per packet = 120 packets total
      if (windowBuffer.receivedCount >= 120) {
        console.log(`✅ Window ${windowId} COMPLETE: All 120 packets received (${windowBuffer.samples.length} samples)`);
        console.log(`📈 Voltage range: ${Math.min(...windowBuffer.samples).toFixed(6)}V to ${Math.max(...windowBuffer.samples).toFixed(6)}V`);
        console.log(`📊 Sample preview: [${Array.from(windowBuffer.samples.slice(0, 5)).map(v => v.toFixed(4)).join(', ')}...]`);

        // Send complete 1-second window to processor
        onBatch?.({
          deviceId: rinfo.address,
          packetId: windowId,
          sampleRate: 38400,
          samples: windowBuffer.samples, // Complete 38,400 samples
          receivedAt: Date.now(),
          windowDuration: Date.now() - windowBuffer.startTime
        });

        // Clean up old window buffers (keep only last 3 windows)
        const windowIds = Array.from(windowBuffers.keys()).sort((a, b) => a - b);
        if (windowIds.length > 3) {
          const oldWindowIds = windowIds.slice(0, -3);
          oldWindowIds.forEach(id => {
            windowBuffers.delete(id);
            console.log(`🧹 Cleaned up old window ${id}`);
          });
        }
      }

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
    console.log(`📡 Ready to receive NEW packet format from Raspberry Pi`);
    console.log(`📦 Expected format: [windowId][seqId][startIndex][length][320 float32 samples]`);
    console.log(`📊 Packet size: 1296 bytes (16 header + 1280 payload)`);
    console.log(`⏱️  Expecting 120 packets per second (38400 samples / 320 per packet)`);
    console.log(`🎯 Pi config: PC_IP="${addr.address}", PC_PORT=${addr.port}`);
  });

  sock.bind(port, host);

  return sock;
}

module.exports = { createUDPListener };
