"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Vector3, OrientationData, SensorPermissions, PermissionState } from "@/types";

export interface MotionSensorState {
  accelerometer: Vector3;
  gyroscope: Vector3;
  orientation: OrientationData;
  permissions: SensorPermissions;
  isActive: boolean;
  error: string | null;
}
// This hook is used to get the motion sensors data from the device
const ZERO_VEC: Vector3 = { x: 0, y: 0, z: 0 };
const ZERO_ORI: OrientationData = { alpha: null, beta: null, gamma: null, absolute: false };

export function useMotionSensors(onReading?: (state: MotionSensorState) => void) {
  const [state, setState] = useState<MotionSensorState>({
    accelerometer: ZERO_VEC, gyroscope: ZERO_VEC, orientation: ZERO_ORI,
    permissions: { motion: "idle", orientation: "idle" }, isActive: false, error: null,
  });
  const onReadingRef = useRef(onReading);
  onReadingRef.current = onReading;
  const latestRef = useRef(state);
  latestRef.current = state;
// requesting permission from the user
  const requestPermission = useCallback(async () => {
    setState(s => ({ ...s, permissions: { motion: "requesting", orientation: "requesting" }, error: null }));
    let motionState: PermissionState = "granted";
    let orientationState: PermissionState = "granted";

    if (typeof DeviceMotionEvent !== "undefined") {
      // @ts-expect-error iOS
      if (typeof DeviceMotionEvent.requestPermission === "function") {
        try { 
          // @ts-expect-error iOS
          const r = await DeviceMotionEvent.requestPermission();
          motionState = r === "granted" ? "granted" : "denied";
        } catch { motionState = "denied"; }
      }
    } else { motionState = "unsupported"; }

    if (typeof DeviceOrientationEvent !== "undefined") {
      // @ts-expect-error iOS
      if (typeof DeviceOrientationEvent.requestPermission === "function") {
        try {
          // @ts-expect-error iOS
          const r = await DeviceOrientationEvent.requestPermission();
          orientationState = r === "granted" ? "granted" : "denied";
        } catch { orientationState = "denied"; }
      }
    } else { orientationState = "unsupported"; }
// setting the state of the permissions
    setState(s => ({
      ...s,
      permissions: { motion: motionState, orientation: orientationState },
      error: motionState === "denied" || orientationState === "denied"
        ? "Sensor permission denied. Please allow motion access in browser settings."
        : motionState === "unsupported" && orientationState === "unsupported"
        ? "Motion sensors are not supported on this device or browser."
        : null,
    }));
  }, []);
// getting the motion sensors data from the device
  useEffect(() => {
    const { motion, orientation } = state.permissions;
    if (motion !== "granted" && orientation !== "granted") return;

    let accel = ZERO_VEC, gyro = ZERO_VEC, orient = ZERO_ORI;

    function handleMotion(e: DeviceMotionEvent) {
      const la = e.acceleration; const rr = e.rotationRate;
      accel = { x: la?.x ?? accel.x, y: la?.y ?? accel.y, z: la?.z ?? accel.z };
      gyro  = { x: rr?.alpha ?? gyro.x, y: rr?.beta ?? gyro.y, z: rr?.gamma ?? gyro.z };
      const next: MotionSensorState = { ...latestRef.current, accelerometer: accel, gyroscope: gyro, isActive: true };
      setState(next);
      onReadingRef.current?.(next);
    }
// getting the motion sensors data from the device
    function handleOrientation(e: DeviceOrientationEvent) {
      orient = { alpha: e.alpha, beta: e.beta, gamma: e.gamma, absolute: e.absolute };
      const next: MotionSensorState = { ...latestRef.current, orientation: orient, isActive: true };
      setState(next);
      onReadingRef.current?.(next);
    }
// adding event listeners for the motion sensors
    window.addEventListener("devicemotion", handleMotion);
    window.addEventListener("deviceorientation", handleOrientation);
    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [state.permissions]);

  return { state, requestPermission };
}
