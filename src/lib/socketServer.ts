import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SensorPayload,
} from "@/types";
import {
  registerDevice,
  unregisterDevice,
  updateSensorData,
} from "@/lib/registry";

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null;

/**
 * Initialises the Socket.IO server once and attaches it to the provided HTTP
 * server. Subsequent calls are no-ops (returns the existing instance).
 */
export function initSocketServer(
  httpServer: HTTPServer
): SocketIOServer<ClientToServerEvents, ServerToClientEvents> {
  if (io) return io;

  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      path: "/ws",
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL ?? "*",
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    }
  );

  io.on("connection", (socket) => {
    let currentDeviceId: string | null = null;

    // ── Device registration ────────────────────────────────────────────────
    socket.on("device:register", ({ deviceId }) => {
      if (!deviceId || typeof deviceId !== "string") {
        socket.emit("error", { message: "Invalid device ID" });
        return;
      }

      currentDeviceId = deviceId;

      registerDevice({
        deviceId,
        socketId: socket.id,
        connectedAt: Date.now(),
        lastSeen: Date.now(),
      });

      socket.emit("device:registered", {
        deviceId,
        timestamp: Date.now(),
      });

      console.log(`[WS] Device registered: ${deviceId} (${socket.id})`);
    });

    // ── Sensor data ingestion ─────────────────────────────────────────────
    socket.on("sensor:data", (payload: SensorPayload) => {
      if (!currentDeviceId || payload.deviceId !== currentDeviceId) return;
      updateSensorData({ ...payload, timestamp: Date.now() });
    });

    // ── Disconnection ──────────────────────────────────────────────────────
    socket.on("disconnect", (reason) => {
      if (currentDeviceId) {
        unregisterDevice(currentDeviceId);
        console.log(
          `[WS] Device disconnected: ${currentDeviceId} — ${reason}`
        );
      }
    });
  });

  console.log("[WS] Socket.IO server initialised");
  return io;
}
