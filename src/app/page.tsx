"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getOrCreateDeviceId } from "@/lib/deviceId";

export default function HomePage() {
  const [deviceId, setDeviceId] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
    setMounted(true);
  }, []);

  return (
    <main className="min-h-screen bg-void bg-grid flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent-cyan/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent-purple/5 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-accent-green/3 blur-3xl pointer-events-none" />

      {/* Logo mark */}
      <div className="animate-float mb-8 relative">
        <div className="w-20 h-20 rounded-2xl bg-panel border border-border2 flex items-center justify-center relative overflow-hidden glow-cyan">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/10 to-accent-purple/10" />
          <span className="text-4xl relative z-10">⚡</span>
        </div>
        <div className="absolute -inset-1 rounded-2xl border-animated opacity-40 rounded-2xl -z-10" />
      </div>

      {/* Brand */}
      <div className="text-center mb-3">
        <h1 className="font-display font-black text-5xl sm:text-6xl tracking-tight gradient-text mb-2">
          PainQuest
        </h1>
        <p className="text-txt-dim text-sm font-mono tracking-widest uppercase">
          AI Motion Intelligence
        </p>
      </div>

      <p className="text-center text-txt-dim max-w-sm mb-10 leading-relaxed text-sm">
        Transform your smartphone into a <span className="text-accent-cyan">live motion sensor</span>. 
        Track exercises with <span className="text-accent-green">AI pose detection</span> and stream 
        <span className="text-accent-purple"> real-time telemetry</span>.
      </p>

      {/* Nav cards */}
      <div className="w-full max-w-sm space-y-3">
        <Link href="/dashboard" className="block group">
          <div className="relative bg-panel border border-border2 rounded-2xl p-5 hover:border-accent-cyan/50 transition-all duration-300 hover:glow-cyan overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-accent-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-accent-cyan/10 border border-accent-cyan/20 flex items-center justify-center text-2xl shrink-0">
                📡
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-txt text-base">Sensor Dashboard</p>
                <p className="text-txt-dim text-xs mt-0.5">Gyroscope · Accelerometer · Orientation</p>
              </div>
              <span className="text-accent-cyan text-xl group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </Link>

        <Link href="/exercise" className="block group">
          <div className="relative bg-panel border border-border2 rounded-2xl p-5 hover:border-accent-green/50 transition-all duration-300 hover:glow-green overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-accent-green/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-12 h-12 rounded-xl bg-accent-green/10 border border-accent-green/20 flex items-center justify-center text-2xl shrink-0">
                🏋️
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-txt text-base">Exercise Tracker</p>
                <p className="text-txt-dim text-xs mt-0.5">AI Pose Detection · Rep Counter · Form Analysis</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-accent-green/20 text-accent-green px-2 py-0.5 rounded-full font-mono font-semibold border border-accent-green/30">AI</span>
                <span className="text-accent-green text-xl group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Device ID */}
      {mounted && (
        <div className="mt-8 text-center">
          <p className="text-xs text-muted font-mono">
            Device{" "}
            <span className="text-accent-cyan/70">{deviceId.slice(0, 8)}…</span>
          </p>
        </div>
      )}

      {/* Version */}
      <p className="absolute bottom-4 text-xs text-muted font-mono">
        PainQuest v2.0 · Built with Next.js 15
      </p>
    </main>
  );
}
