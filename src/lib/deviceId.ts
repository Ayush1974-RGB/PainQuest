import { v4 as uuidv4 } from "uuid";

const DEVICE_ID_KEY = "motion_sensor_device_id";

/**
 * Retrieves the persisted device ID from localStorage, or generates and stores
 * a new UUID v4 if none exists. Safe to call on every page load.
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") {
    // SSR guard — return a placeholder; real ID is resolved client-side
    return "ssr-placeholder";
  }

  try {
    const stored = localStorage.getItem(DEVICE_ID_KEY);
    if (stored && isValidUUID(stored)) {
      return stored;
    }
  } catch {
    // localStorage unavailable (private browsing restrictions, etc.)
  }

  const newId = uuidv4();

  try {
    localStorage.setItem(DEVICE_ID_KEY, newId);
  } catch {
    // Silently continue — ID will not persist across reloads but app still works
  }

  return newId;
}

/**
 * Validates that a string matches UUID v4 format.
 */
function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
