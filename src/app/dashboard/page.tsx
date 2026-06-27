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

function StatCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="bg-panel border border-border2 rounded-xl p-3 text-center">
      <p className="text-xs text-muted font-mono uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono tabular-nums ${color}`}>
        {value}<span className="text-xs text-muted ml-1">{unit}</span>
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const [deviceId, setDeviceId] = useState("ssr-placeholder");
  const [fps, setFps] = useState(0);
  const [totalFrames, setTotalFrames] = useState(0);
  const [uptime, setUptime] = useState(0);
  const frameRef = useRef(0);
  const startRef = useRef(Date.now());

  useEffect(() => { setDeviceId(getOrCreateDeviceId()); }, []);

  useEffect(() => {
    const fpsTimer = setInterval(() => { setFps(frameRef.current); setTotalFrames(t => t + frameRef.current); frameRef.current = 0; }, 1000);
    const uptimeTimer = setInterval(() => { setUptime(Math.floor((Date.now() - startRef.current) / 1000)); }, 1000);
    return () => { clearInterval(fpsTimer); clearInterval(uptimeTimer); };
  }, []);

  const { status, error: wsError, stream } = useSocketStream(deviceId, 30);

  const handleReading = useCallback((s: MotionSensorState) => {
    if (deviceId === "ssr-placeholder") return;
    frameRef.current += 1;
    const payload: SensorPayload = {
      deviceId, timestamp: Date.now(), clientTimestamp: performance.now(),
      accelerometer: s.accelerometer, gyroscope: s.gyroscope, orientation: s.orientation,
    };
    stream(payload);
  }, [deviceId, stream]);

  const { state: sensor, requestPermission } = useMotionSensors(handleReading);

  const isGranted = sensor.permissions.motion === "granted" || sensor.permissions.orientation === "granted";
  const showGate = !isGranted || sensor.permissions.motion === "idle";
  const magnitude = Math.sqrt(sensor.accelerometer.x ** 2 + sensor.accelerometer.y ** 2 + sensor.accelerometer.z ** 2).toFixed(2);
  const formatUptime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <main className="min-h-screen bg-void bg-grid flex flex-col">
      <header className="sticky top-0 z-20 glass border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted hover:text-txt transition-colors text-sm">←</Link>
          <div className="w-px h-4 bg-border2" />
          <div className="flex items-center gap-2">
            <span className="text-accent-cyan text-base">⚡</span>
            <span className="font-bold text-sm tracking-tight text-txt font-display">
              Pain<span className="text-accent-cyan">Quest</span>
            </span>
          </div>
          <span className="text-xs text-muted font-mono">/ sensors</span>
        </div>
        <StatusBadge status={status} />
      </header>

      <div className="flex-1 px-4 py-5 max-w-lg mx-auto w-full space-y-4">
        {showGate ? (
          <PermissionGate permissions={sensor.permissions} onRequest={requestPermission} error={sensor.error} />
        ) : (
          <>
            {/* Device info card */}
            <div className="bg-panel border border-border2 rounded-2xl p-4 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-accent-cyan/5 to-transparent pointer-events-none" />
              <div className="flex items-center justify-between gap-4 relative z-10">
                <div className="min-w-0">
                  <p className="text-xs text-muted font-mono uppercase tracking-widest mb-1">Device ID</p>
                  <p className="text-accent-cyan font-mono font-semibold text-sm break-all leading-relaxed text-glow-cyan">
                    {deviceId.slice(0, 8)}<span className="text-muted">{deviceId.slice(8)}</span>
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted font-mono uppercase tracking-widest mb-1">Stream</p>
                  <p className="text-accent-green font-bold font-mono tabular-nums text-lg text-glow-green">
                    {fps}<span className="text-muted text-xs font-normal ml-1">fps</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Uptime"  value={formatUptime(uptime)} unit="" color="text-accent-cyan" />
              <StatCard label="Frames"  value={totalFrames > 999 ? `${(totalFrames/1000).toFixed(1)}k` : String(totalFrames)} unit="" color="text-accent-purple" />
              <StatCard label="G-Force" value={magnitude} unit="m/s²" color="text-accent-amber" />
            </div>

            {wsError && (
              <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl px-4 py-3 text-sm text-accent-red">{wsError}</div>
            )}

            <VectorPanel title="Accelerometer" icon="⚡" data={sensor.accelerometer}
              unit="m/s²" maxValue={20} color="cyan" subtitle="Linear acceleration (gravity excluded)" />
            <VectorPanel title="Gyroscope" icon="🔄" data={sensor.gyroscope}
              unit="°/s" maxValue={360} color="green" subtitle="Angular velocity" />
            <OrientationPanel alpha={sensor.orientation.alpha} beta={sensor.orientation.beta}
              gamma={sensor.orientation.gamma} absolute={sensor.orientation.absolute} />

            {/* API */}
            <div className="bg-panel border border-border rounded-xl p-4 font-mono text-xs space-y-2">
              <p className="text-muted uppercase tracking-widest">REST API</p>
              <p className="text-txt-dim"><span className="text-accent-green">GET</span> <span className="text-accent-cyan">/api/device/{deviceId.slice(0,8)}…</span></p>
              <p className="text-txt-dim"><span className="text-accent-green">GET</span> <span className="text-accent-cyan">/api/device/{deviceId.slice(0,8)}…/sensor</span></p>
            </div>

            <Link href="/exercise"
              className="flex items-center justify-center gap-3 w-full bg-accent-green/10 border border-accent-green/30 rounded-2xl p-4 text-accent-green font-semibold hover:bg-accent-green/20 transition-all duration-200 active:scale-95">
              <span>🏋️</span><span>Open Exercise Tracker</span><span>→</span>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
