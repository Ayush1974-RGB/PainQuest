import type { DeviceRecord, SensorPayload, DeviceInfo } from "@/types";

/**
 * In-memory registry of connected devices.
 * Stored on the global object to survive Next.js hot-reloads in development.
 */
declare global {
  // eslint-disable-next-line no-var
  var __deviceRegistry: Map<string, DeviceRecord> | undefined;
}

function getRegistry(): Map<string, DeviceRecord> {
  if (!global.__deviceRegistry) {
    global.__deviceRegistry = new Map();
  }
  return global.__deviceRegistry;
}

// ─── Registry API ─────────────────────────────────────────────────────────────

export function registerDevice(info: DeviceInfo): void {
  const registry = getRegistry();
  const existing = registry.get(info.deviceId);
  registry.set(info.deviceId, {
    info: { ...info },
    latestSensor: existing?.latestSensor ?? null,
  });
}

export function unregisterDevice(deviceId: string): void {
  getRegistry().delete(deviceId);
}

export function updateSensorData(payload: SensorPayload): void {
  const registry = getRegistry();
  const record = registry.get(payload.deviceId);
  if (!record) return;

  record.latestSensor = payload;
  record.info.lastSeen = Date.now();
}

export function getDevice(deviceId: string): DeviceRecord | undefined {
  return getRegistry().get(deviceId);
}

export function getAllDevices(): DeviceRecord[] {
  return Array.from(getRegistry().values());
}

export function deviceCount(): number {
  return getRegistry().size;
}
