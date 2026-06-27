// ─── Sensor Data Types ───────────────────────────────────────────────────────

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface OrientationData {
  /** Rotation around Z-axis (compass heading) in degrees [0, 360) */
  alpha: number | null;
  /** Rotation around X-axis (front-to-back tilt) in degrees [-180, 180] */
  beta: number | null;
  /** Rotation around Y-axis (left-to-right tilt) in degrees [-90, 90] */
  gamma: number | null;
  /** Whether orientation is absolute (compass-referenced) */
  absolute: boolean;
}

export interface SensorPayload {
  /** Unique device identifier (UUID v4) */
  deviceId: string;
  /** Server-assigned timestamp (ms since epoch) */
  timestamp: number;
  /** Client-side high-resolution timestamp for latency measurement */
  clientTimestamp: number;
  /** Linear acceleration in m/s² (gravity excluded if available) */
  accelerometer: Vector3;
  /** Angular velocity in deg/s */
  gyroscope: Vector3;
  /** Device orientation in degrees */
  orientation: OrientationData;
}

// ─── Device Registry Types ───────────────────────────────────────────────────

export interface DeviceInfo {
  deviceId: string;
  connectedAt: number;
  lastSeen: number;
  socketId: string;
}

export interface DeviceRecord {
  info: DeviceInfo;
  latestSensor: SensorPayload | null;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface ApiDeviceResponse {
  deviceId: string;
  connectedAt: number;
  lastSeen: number;
  uptime: number;
  hasSensorData: boolean;
}

export interface ApiSensorResponse {
  deviceId: string;
  timestamp: number;
  age: number;
  sensor: Omit<SensorPayload, "deviceId" | "timestamp" | "clientTimestamp">;
}

export interface ApiErrorResponse {
  error: string;
  code: string;
}

// ─── WebSocket Event Types ────────────────────────────────────────────────────

export interface ServerToClientEvents {
  /** Echoes the registration back with server-assigned timestamp */
  "device:registered": (payload: { deviceId: string; timestamp: number }) => void;
  /** Generic error from the server */
  "error": (payload: { message: string }) => void;
}

export interface ClientToServerEvents {
  /** Register a device by UUID */
  "device:register": (payload: { deviceId: string }) => void;
  /** Stream sensor data from device */
  "sensor:data": (payload: SensorPayload) => void;
}

// ─── Permission State ─────────────────────────────────────────────────────────

export type PermissionState = "idle" | "requesting" | "granted" | "denied" | "unsupported";

export interface SensorPermissions {
  motion: PermissionState;
  orientation: PermissionState;
}
