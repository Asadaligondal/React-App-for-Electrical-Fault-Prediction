// server/udp/listener.js
import dgram from "dgram";

/**
 * Minimal UDP decoder for packets shaped like:
 *   [uint32LE packetId][uint32LE count][count x float32LE]
 */
export function createUDPListener({ port, host = "0.0.0.0" }, onBatch) {
  const sock = dgram.createSocket("udp4");

  sock.on("message", (msg, rinfo) => {
    try {
      if (msg.length < 8) return; // need at least header
      const packetId = msg.readUInt32LE(0);
      const count    = msg.readUInt32LE(4);
      const expected = 8 + count * 4;
      if (msg.length < expected) return;

      const samples = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        samples[i] = msg.readFloatLE(8 + i * 4);
      }

      onBatch?.({
        deviceId: rinfo.address,     // source IP as device id (simple & robust)
        packetId,
        sampleRate: 38400,           // matches your Pi script
        samples,
        receivedAt: Date.now(),
      });
    } catch (err) {
      console.error("UDP decode error:", err);
    }
  });

  sock.on("error", (err) => {
    console.error("UDP socket error:", err);
  });

  sock.bind(port, host, () => {
    const addr = sock.address();
    console.log(`🟢 UDP bound at ${addr.address}:${addr.port}`);
  });

  return sock;
}
