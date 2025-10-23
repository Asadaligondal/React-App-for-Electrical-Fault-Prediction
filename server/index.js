// index.js (ESM)
import http from "http";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import dgram from "dgram";

const HTTP_PORT = parseInt(process.env.STREAM_HTTP_PORT || "5002", 10);
const UDP_PORT  = parseInt(process.env.UDP_LISTEN_PORT  || "5001", 10);
const UDP_HOST  = process.env.UDP_HOST || "0.0.0.0";

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: "/socket.io/",
});

app.get("/health", (_req, res) => res.json({ ok: true }));

io.on("connection", (socket) => {
  const addr = socket.handshake.address || "unknown";
  console.log("🔗 client connected:", socket.id, "from", addr);
  socket.on("disconnect", (reason) => {
    console.log("🔌 client disconnected:", socket.id, "reason:", reason);
  });
});

server.listen(HTTP_PORT, () => {
  console.log(`✅ Stream server listening at http://0.0.0.0:${HTTP_PORT}`);
  console.log(`➡️  Client connect URL: http://<THIS-IP>:${HTTP_PORT}`);
});

// UDP listener
const udpSock = dgram.createSocket("udp4");
udpSock.on("error", (err) => console.error("❌ UDP socket error:", err));

udpSock.on("message", (buf, rinfo) => {
  try {
    if (buf.length < 8) return;
    const packetId = buf.readUInt32LE(0);
    const count    = buf.readUInt32LE(4);
    const expected = 8 + count * 4;
    if (buf.length < expected) return;

    const samples = new Float32Array(count);
    for (let i = 0, off = 8; i < count; i++, off += 4) {
      samples[i] = buf.readFloatLE(off);
    }

    if (packetId % 20 === 0) {
      console.log(`📦 UDP #${packetId} from ${rinfo.address} (n=${count})`);
    }

    io.emit("accel:samples", {
      deviceId: rinfo.address,
      packetId,
      sampleRate: 38400,
      samples: Array.from(samples),
      receivedAt: Date.now(),
    });
  } catch (e) {
    console.error("UDP decode error:", e);
  }
});

udpSock.bind(UDP_PORT, UDP_HOST, () => {
  const a = udpSock.address();
  console.log(`📡 UDP listening on ${a.address}:${a.port}`);
});
