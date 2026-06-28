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
    <main className="min-h-screen bg-black flex flex-col relative overflow-hidden">
      {/* Diagonal stripe texture */}
      <div className="absolute inset-0 stripe-y pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-px bg-yellow/20" />

      {/* Yellow top bar */}
      <div className="h-1 bg-yellow w-full shrink-0 relative z-10" />

      {/* Header */}
      <header className="relative z-10 px-6 pt-8 pb-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow rounded flex items-center justify-center">
            <span className="font-heading text-black text-xl leading-none">P</span>
          </div>
          <span className="font-heading text-2xl text-wht tracking-wider">PAINQUEST</span>
        </div>
        {mounted && (
          <span className="font-mono text-xs text-grey2">{deviceId.slice(0, 8)}</span>
        )}
      </header>

{/* Hero */}
<div className="relative z-10 flex-1 grid lg:grid-cols-2 items-center px-6 py-10 gap-12">

  {/* LEFT SIDE */}
  <div>
    <div className="mb-2">
      <span className="font-mono text-xs text-yellow uppercase tracking-widest">
        Motion Tracker
      </span>
    </div>

    <h1 className="font-heading text-7xl sm:text-8xl text-wht leading-none mb-4">
      TRAIN
      <br />
      <span className="text-yellow">SMARTER</span>
    </h1>

    <p className="text-grey text-sm leading-relaxed max-w-xs mb-10">
      Stream live sensor data from your phone and count workout reps
      using your camera. No wearables needed.
    </p>

    {/* Nav cards */}
    <div className="space-y-3">
      <Link href="/dashboard" className="block group card-lift">
        <div className="bg-card border border-line rounded-xl p-5 relative overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-yellow/60 rounded-l-xl" />

          <div className="pl-4 flex items-center justify-between">
            <div>
              <p className="font-heading text-xl text-wht tracking-wide">
                SENSOR DASHBOARD
              </p>

              <p className="text-grey text-xs mt-1">
                Gyroscope · Accelerometer · Orientation
              </p>
            </div>

            <div className="w-10 h-10 border border-line2 rounded-lg flex items-center justify-center text-grey group-hover:border-yellow group-hover:text-yellow transition-all duration-200">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </Link>

      <Link href="/exercise" className="block group card-lift">
        <div className="bg-yellow rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-heading text-xl text-black tracking-wide">
                WORKOUT TRACKER
              </p>

              <p className="text-black/60 text-xs mt-1">
                Rep Counter · Form Check · Sets
              </p>
            </div>

            <div className="w-10 h-10 bg-black/10 rounded-lg flex items-center justify-center group-hover:bg-black/20 transition-colors">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="black"
                strokeWidth="2.5"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </Link>
    </div>
  </div>


</div>

      {/* Bottom strip */}
      <div className="relative z-10 border-t border-line px-6 py-4 flex items-center justify-between">
        <span className="font-mono text-xs text-grey2">v2.0</span>
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-success pulse-dot" />
          <span className="font-mono text-xs text-grey">READY</span>
        </div>
        <span className="font-mono text-xs text-grey2">PWA</span>
      </div>
    </main>
  );
}