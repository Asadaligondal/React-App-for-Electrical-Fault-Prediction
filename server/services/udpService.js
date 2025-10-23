// server/services/udpService.js
const dgram = require('dgram');

class UdpService {
  constructor() {
    this.sock = null;
    this.isListening = false;
    this.lastEmit = 0;
    this.minGapMs = 5; // throttle (5ms) -> ~200 emits/sec; tune for your charts
  }

  start(io, { host = '0.0.0.0', port = 7000, maxEmitPerSec = 120 } = {}) {
    if (this.isListening) return;
    if (maxEmitPerSec && maxEmitPerSec > 0) {
      this.minGapMs = Math.max(1, Math.floor(1000 / maxEmitPerSec));
    }

    this.sock = dgram.createSocket('udp4');

    this.sock.on('message', (msg, rinfo) => {
      // Expect JSON from Pi:
      // { ts, device, channel, sampleRate, data: [ ...samples... ] }
      let payload;
      try {
        payload = JSON.parse(msg.toString('utf8'));
      } catch (e) {
        payload = { ts: Date.now(), device: 'pi', raw: msg.toString('base64') };
      }

      // attach sender info (optional)
      payload._from = `${rinfo.address}:${rinfo.port}`;

      const now = Date.now();
      if (now - this.lastEmit >= this.minGapMs) {
        io.emit('udp:data', payload);
        this.lastEmit = now;
      }
    });

    this.sock.on('listening', () => {
      const a = this.sock.address();
      console.log(`[UDP] listening on ${a.address}:${a.port}`);
      this.isListening = true;
    });

    this.sock.on('error', (err) => {
      console.error('[UDP] socket error:', err);
    });

    this.sock.bind(port, host);
  }

  stop() {
    if (!this.isListening || !this.sock) return;
    try {
      this.sock.close();
    } catch (e) {
      console.error('[UDP] close error:', e);
    }
    this.sock = null;
    this.isListening = false;
    console.log('[UDP] stopped');
  }
}

module.exports = new UdpService();
