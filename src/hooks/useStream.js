// src/hooks/useStream.js
import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

/**
 * Socket.IO stream hook
 * @param {{ serverUrl: string }} opts - e.g., "http://192.168.0.100:5002"
 */
export function useStream({ serverUrl }) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [lastError, setLastError] = useState(null);
  const batchHandlerRef = useRef(null);

  const connect = useCallback(() => {
    if (socketRef.current) return; // already connected/connecting

    const socket = io(serverUrl, {
      // Allow polling handshake, then upgrade to websocket
      transports: ["polling", "websocket"],
      path: "/socket.io/",
      forceNew: true,
      withCredentials: false,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setLastError(null);
      // console.log("✅ socket connected", socket.id);
    });

    socket.on("disconnect", (reason) => {
      setConnected(false);
      // console.log("ℹ️ socket disconnected:", reason);
    });

    socket.on("connect_error", (err) => {
      setLastError(err?.message || "connect_error");
      // console.error("socket connect_error:", err);
    });

    socket.on("accel:samples", (payload) => {
      // payload: { deviceId, packetId, sampleRate, samples(Array), receivedAt }
      // console.log("accel:samples", payload.packetId, payload.deviceId, payload.samples?.length);
      if (batchHandlerRef.current) batchHandlerRef.current(payload);
    });
  }, [serverUrl]);

  const disconnect = useCallback(() => {
    const s = socketRef.current;
    if (s) {
      s.disconnect();
      socketRef.current = null;
    }
  }, []);

  const onBatch = useCallback((fn) => {
    batchHandlerRef.current = fn;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return { connected, lastError, connect, disconnect, onBatch };
}
