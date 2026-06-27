"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { getOrCreateDeviceId } from "@/lib/deviceId";
import { useMotionSensors, type MotionSensorState } from "@/hooks/useMotionSensors";
import { useSocketStream } from "@/hooks/useSocketStream";
import StatusBadge from "@/components/StatusBadge";
import PermissionGate from "@/components/PermissionGate";
import { VectorPanel, OrientationPanel } from "@/components/SensorPanel";
import type { SensorPayload } from "@/types";

function StatBox({
  label, value, sub,
}: {
  label: string; value: string; sub?: string;
}) {
  return (
    <div className="bg-card border border-line rounded-xl p-4">
      <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-2">
        {label}
      </p>
      <p className="font-heading text-3xl text-yellow tabular-nums leading-none">
        {value}
      </p>
      {sub && <p className="font-mono text-xs text-grey2 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [deviceId, setDeviceId] = useState("ssr-placeholder");
  const [fps, setFps]           = useState(0);
  const [totalFrames, setTotal] = useState(0);
  const [uptime, setUptime]     = useState(0);
  const frameRef = useRef(0);
  const startRef = useRef(Date.now());

  useEffect(() => { setDeviceId(getOrCreateDeviceId()); }, []);

  useEffect(() => {
    const t1 = setInterval(() => {
      setFps(frameRef.current);
      setTotal(n => n + frameRef.current);
      frameRef.current = 0;
    }, 1000);
    const t2 = setInterval(
      () => setUptime(Math.floor((Date.now() - startRef.current) / 1000)),
      1000
    );
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const { status, error: wsError, stream } = useSocketStream(deviceId, 30);

  const handleReading = useCallback(
    (s: MotionSensorState) => {
      if (deviceId === "ssr-placeholder") return;
      frameRef.current += 1;
      stream({
        deviceId,
        timestamp: Date.now(),
        clientTimestamp: performance.now(),
        accelerometer: s.accelerometer,
        gyroscope: s.gyroscope,
        orientation: s.orientation,
      } as SensorPayload);
    },
    [deviceId, stream]
  );

  const { state: sensor, requestPermission } = useMotionSensors(handleReading);

  const isGranted =
    sensor.permissions.motion === "granted" ||
    sensor.permissions.orientation === "granted";
  const showGate = !isGranted || sensor.permissions.motion === "idle";

  const mag = Math.sqrt(
    sensor.accelerometer.x ** 2 +
    sensor.accelerometer.y ** 2 +
    sensor.accelerometer.z ** 2
  );
  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <main className="min-h-screen bg-black flex flex-col">
      <div className="h-1 bg-yellow shrink-0" />

      <header className="glass border-b border-line px-5 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-grey hover:text-wht transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="w-px h-4 bg-line2" />
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-yellow rounded flex items-center justify-center">
              <span className="font-heading text-black text-xs leading-none">P</span>
            </div>
            <span className="font-heading text-lg text-wht tracking-wider">PAINQUEST</span>
          </div>
          <span className="font-mono text-xs text-grey2">/ sensors</span>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4">
        {showGate ? (
          <PermissionGate
            permissions={sensor.permissions}
            onRequest={requestPermission}
            error={sensor.error}
          />
        ) : (
          <>
            {/* Device card */}
            <div className="bg-card border border-line rounded-xl p-4 relative overflow-hidden bracket">
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-yellow rounded-r-xl" />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1.5">
                    Device ID
                  </p>
                  <p className="font-mono text-sm text-yellow break-all leading-relaxed">
                    {deviceId.slice(0, 8)}
                    <span className="text-grey2">{deviceId.slice(8)}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1.5">
                    Stream
                  </p>
                  <p className="font-heading text-4xl text-yellow tabular-nums leading-none text-glow-yellow">
                    {fps}
                  </p>
                  <p className="font-mono text-xs text-grey2 mt-0.5">fps</p>
                </div>
              </div>
            </div>

            {/* Stat boxes */}
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Uptime"  value={fmt(uptime)} />
              <StatBox
                label="Frames"
                value={
                  totalFrames > 9999
                    ? `${(totalFrames / 1000).toFixed(1)}k`
                    : String(totalFrames)
                }
              />
              <StatBox label="G-Force" value={mag.toFixed(1)} sub="m/s²" />
            </div>

            {wsError && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 font-mono text-xs text-danger">
                {wsError}
              </div>
            )}

            <VectorPanel
              title="Accelerometer"
              data={sensor.accelerometer}
              unit="m/s²"
              maxValue={20}
              color="yellow"
              tag="sensor 01"
            />
            <VectorPanel
              title="Gyroscope"
              data={sensor.gyroscope}
              unit="°/s"
              maxValue={360}
              color="white"
              tag="sensor 02"
            />
            <OrientationPanel
              alpha={sensor.orientation.alpha}
              beta={sensor.orientation.beta}
              gamma={sensor.orientation.gamma}
              absolute={sensor.orientation.absolute}
            />

            {/* API */}
            <div className="bg-card border border-line rounded-xl p-4 space-y-3">
              <p className="font-mono text-xs text-grey2 uppercase tracking-widest">
                REST Endpoints
              </p>
              <div className="space-y-2 font-mono text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-success bg-success/10 px-1.5 py-0.5 rounded font-semibold">
                    GET
                  </span>
                  <span className="text-grey break-all">
                    /api/device/{deviceId.slice(0, 8)}…
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-success bg-success/10 px-1.5 py-0.5 rounded font-semibold">
                    GET
                  </span>
                  <span className="text-grey break-all">
                    /api/device/{deviceId.slice(0, 8)}…/sensor
                  </span>
                </div>
              </div>
            </div>

            {/* Workout CTA */}
            <Link
              href="/exercise"
              className="flex items-center justify-between w-full bg-yellow rounded-xl px-5 py-4 group card-lift"
            >
              <div>
                <p className="font-heading text-xl text-black tracking-wide">
                  WORKOUT TRACKER
                </p>
                <p className="text-black/60 text-xs mt-0.5">
                  Rep Counter · Form Check
                </p>
              </div>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="black"
                strokeWidth="2.5"
                className="group-hover:translate-x-1 transition-transform"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}