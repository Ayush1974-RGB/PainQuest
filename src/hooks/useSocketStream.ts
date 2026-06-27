"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents, SensorPayload } from "@/types";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export function useSocketStream(deviceId: string, targetFps = 30) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const lastEmitRef = useRef(0);
  const minInterval = 1000 / targetFps;

  useEffect(() => {
    if (!deviceId || deviceId === "ssr-placeholder") return;
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? window.location.origin;
    setStatus("connecting");

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(wsUrl, {
      path: "/ws", transports: ["websocket", "polling"],
      reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on("connect", () => { setStatus("connected"); setError(null); socket.emit("device:register", { deviceId }); });
    socket.on("disconnect", (reason) => { setStatus("disconnected"); if (reason === "io server disconnect") socket.connect(); });
    socket.on("connect_error", (e) => { setStatus("error"); setError(`Connection error: ${e.message}`); });
    socket.on("error", ({ message }) => { setError(message); });

    return () => { socket.disconnect(); socketRef.current = null; setStatus("disconnected"); };
  }, [deviceId]);

  const stream = useCallback((payload: SensorPayload) => {
    const now = performance.now();
    if (now - lastEmitRef.current < minInterval) return;
    lastEmitRef.current = now;
    socketRef.current?.volatile.emit("sensor:data", payload);
  }, [minInterval]);

  return { status, error, stream };
}
