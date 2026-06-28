"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { getOrCreateDeviceId } from "@/lib/deviceId";
import { useMotionSensors, type MotionSensorState } from "@/hooks/useMotionSensors";
import { useSocketStream } from "@/hooks/useSocketStream";
import StatusBadge from "@/components/StatusBadge";
import PermissionGate from "@/components/PermissionGate";
import { VectorPanel, OrientationPanel } from "@/components/SensorPanel";
import type { SensorPayload } from "@/types";
import type { PoseProps } from "@/components/Stickman";

// Dynamically import Stickman — Three.js cannot run on the server
const Stickman = dynamic(() => import("@/components/Stickman"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

interface MotionFeatures {
  meanAcc: number;
  varAcc:  number;
  maxAcc:  number;
  meanRot: number;
  varRot:  number;
  freq:    number;
}

interface BenchmarkProfile {
  name:      string;
  features:  MotionFeatures;
  isSystem?: boolean;
}

type Attachment = "torso" | "left_arm" | "right_arm";

// ─── Default activity profiles ────────────────────────────────────────────────

const DEFAULT_BENCHMARKS: BenchmarkProfile[] = [
  { name: "walking",    isSystem: true, features: { meanAcc: 10.8, varAcc: 3.5,  maxAcc: 14.5, meanRot: 1.8,  varRot: 0.9,  freq: 2.2 } },
  { name: "hand raise", isSystem: true, features: { meanAcc: 9.8,  varAcc: 0.8,  maxAcc: 11.8, meanRot: 3.2,  varRot: 2.4,  freq: 0.4 } },
  { name: "sitting",    isSystem: true, features: { meanAcc: 9.8,  varAcc: 0.05, maxAcc: 9.9,  meanRot: 0.05, varRot: 0.01, freq: 0.0 } },
  { name: "waving",     isSystem: true, features: { meanAcc: 10.4, varAcc: 2.2,  maxAcc: 13.0, meanRot: 4.8,  varRot: 3.2,  freq: 3.2 } },
  { name: "punching",   isSystem: true, features: { meanAcc: 12.8, varAcc: 8.5,  maxAcc: 22.0, meanRot: 5.5,  varRot: 5.0,  freq: 0.8 } },
];

// ─── Feature extraction ───────────────────────────────────────────────────────

function calcFeatures(
  data: { accMag: number; rotMag: number }[]
): MotionFeatures {
  const n = data.length;
  let sumAcc = 0, sumRot = 0, maxAcc = 0;

  for (const d of data) {
    sumAcc += d.accMag;
    sumRot += d.rotMag;
    if (d.accMag > maxAcc) maxAcc = d.accMag;
  }

  const meanAcc = sumAcc / n;
  const meanRot = sumRot / n;
  let varAccSum = 0, varRotSum = 0;

  for (const d of data) {
    varAccSum += (d.accMag - meanAcc) ** 2;
    varRotSum += (d.rotMag - meanRot) ** 2;
  }

  let peaks = 0;
  for (let i = 1; i < n - 1; i++) {
    if (
      data[i].accMag > data[i - 1].accMag &&
      data[i].accMag > data[i + 1].accMag &&
      data[i].accMag > 11.2
    ) peaks++;
  }

  return {
    meanAcc: +meanAcc.toFixed(3),
    varAcc:  +(varAccSum / n).toFixed(3),
    maxAcc:  +maxAcc.toFixed(3),
    meanRot: +meanRot.toFixed(3),
    varRot:  +(varRotSum / n).toFixed(3),
    freq:    +((peaks / (n * 0.025)) * 1.5).toFixed(3),
  };
}

// ─── Classifier ───────────────────────────────────────────────────────────────

function classifyActivity(
  features: MotionFeatures,
  benchmarks: BenchmarkProfile[]
): { activity: string; confidence: number } {
  let best = "unknown", maxSim = 0;

  for (const b of benchmarks) {
    const dMeanAcc = Math.abs(features.meanAcc - b.features.meanAcc) / (b.features.meanAcc || 1);
    const dVarAcc  = Math.abs(features.varAcc  - b.features.varAcc)  / (b.features.varAcc  + 0.1);
    const dMeanRot = Math.abs(features.meanRot - b.features.meanRot) / (b.features.meanRot + 0.1);
    const dFreq    = Math.abs(features.freq    - b.features.freq)    / (b.features.freq    + 0.1);
    const dist     = dMeanAcc * 0.3 + dVarAcc * 0.3 + dMeanRot * 0.2 + dFreq * 0.2;
    const sim      = Math.max(0, 100 - dist * 45);
    if (sim > maxSim) { maxSim = sim; best = b.name; }
  }

  const confidence = Math.round(maxSim);
  return confidence > 45
    ? { activity: best, confidence }
    : { activity: "unknown", confidence };
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function DashboardPage() {

  // ── Device + stream ────────────────────────────────────────────────────
  const [deviceId,     setDeviceId]     = useState("ssr-placeholder");
  const [fps,          setFps]          = useState(0);
  const [totalFrames,  setTotalFrames]  = useState(0);
  const [uptime,       setUptime]       = useState(0);
  const frameRef = useRef(0);
  const startRef = useRef(Date.now());

  useEffect(() => { setDeviceId(getOrCreateDeviceId()); }, []);

  useEffect(() => {
    const t1 = setInterval(() => {
      setFps(frameRef.current);
      setTotalFrames(n => n + frameRef.current);
      frameRef.current = 0;
    }, 1000);
    const t2 = setInterval(
      () => setUptime(Math.floor((Date.now() - startRef.current) / 1000)),
      1000
    );
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const { status, error: wsError, stream } = useSocketStream(deviceId, 30);

  const handleReading = useCallback((s: MotionSensorState) => {
    if (deviceId === "ssr-placeholder") return;
    frameRef.current += 1;
    stream({
      deviceId,
      timestamp:       Date.now(),
      clientTimestamp: performance.now(),
      accelerometer:   s.accelerometer,
      gyroscope:       s.gyroscope,
      orientation:     s.orientation,
    } as SensorPayload);
  }, [deviceId, stream]);

  const { state: sensor, requestPermission } = useMotionSensors(handleReading);

  const isGranted = sensor.permissions.motion === "granted" ||
                    sensor.permissions.orientation === "granted";
  const showGate  = !isGranted || sensor.permissions.motion === "idle";

  // ── Classification state ───────────────────────────────────────────────
  const [benchmarks,       setBenchmarks]       = useState<BenchmarkProfile[]>(DEFAULT_BENCHMARKS);
  const [detectedActivity, setDetectedActivity] = useState({ activity: "unknown", confidence: 0 });
  const [attachment,       setAttachment]       = useState<Attachment>("torso");
  const [invertDir,        setInvertDir]        = useState(false);
  const [newActivityName,  setNewActivityName]  = useState("");
  const [recordStatus,     setRecordStatus]     = useState("");
  const [motionMag,        setMotionMag]        = useState(0);

  // Refs to avoid stale closures in RAF loop
  const attachRef       = useRef<Attachment>("torso");
  const invertRef       = useRef(false);
  const historyRef      = useRef<{ accMag: number; rotMag: number }[]>([]);
  const recordBufRef    = useRef<{ accMag: number; rotMag: number }[]>([]);
  const isRecordingRef  = useRef(false);
  const benchmarksRef   = useRef(benchmarks);
  const activityRef     = useRef("unknown");

  useEffect(() => { attachRef.current    = attachment;  }, [attachment]);
  useEffect(() => { invertRef.current    = invertDir;   }, [invertDir]);
  useEffect(() => { benchmarksRef.current = benchmarks; }, [benchmarks]);

  // Load saved custom benchmarks from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("pq_custom_benchmarks");
    if (!saved) return;
    try {
      const parsed: BenchmarkProfile[] = JSON.parse(saved);
      setBenchmarks([...DEFAULT_BENCHMARKS, ...parsed]);
    } catch {}
  }, []);

  // ── Pose state ─────────────────────────────────────────────────────────
  const [pose, setPose] = useState<PoseProps>({
    headRotation: 0, bodyTilt:  0,
    leftArm:      5, rightArm: -5,
    leftLeg:      0, rightLeg:  0,
  });

  // ── RAF: classification + pose ─────────────────────────────────────────
  useEffect(() => {
    if (!isGranted) return;
    let rafId: number;

    function tick() {
      const acc    = sensor.accelerometer;
      const gyro   = sensor.gyroscope;
      const orient = sensor.orientation;

      const accMag  = Math.sqrt(acc.x ** 2 + acc.y ** 2 + acc.z ** 2);
      const gyroMag = Math.sqrt(
        (gyro.x ?? 0) ** 2 + (gyro.y ?? 0) ** 2 + (gyro.z ?? 0) ** 2
      );

      setMotionMag(+accMag.toFixed(2));

      // Maintain 60-sample sliding window (~2 s at 30 Hz)
      historyRef.current.push({ accMag, rotMag: gyroMag });
      if (historyRef.current.length > 60) historyRef.current.shift();

      if (isRecordingRef.current) {
        recordBufRef.current.push({ accMag, rotMag: gyroMag });
      }

      if (historyRef.current.length >= 15) {
        const features = calcFeatures(historyRef.current);
        const result   = classifyActivity(features, benchmarksRef.current);
        activityRef.current = result.activity;
        setDetectedActivity(result);
      }

      // Drive stickman pose from orientation + detected activity
      computePose(orient, activityRef.current, attachRef.current, invertRef.current);

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isGranted, sensor]);

  function computePose(
    orient: MotionSensorState["orientation"],
    activity: string,
    att: Attachment,
    invert: boolean
  ) {
    let head = 0, tilt = 0, lArm = 5, rArm = -5, lLeg = 0, rLeg = 0;
    const beta  = orient.beta  ?? 0;
    const gamma = orient.gamma ?? 0;

    // Map phone orientation to joint based on attachment point
    if (att === "torso") {
      tilt = invert ? gamma : -gamma;
      head = Math.max(-45, Math.min(45, beta - 60));
    } else if (att === "left_arm") {
      lArm = invert ? (beta - 90) : (90 - beta);
    } else {
      rArm = invert ? (90 - beta) : (beta - 90);
    }

    // Override / add animation based on classified activity
    if (activity === "walking") {
      const c = Date.now() / 120;
      lLeg = Math.sin(c) * 35;
      rLeg = -Math.sin(c) * 35;
      if (att === "torso") { lArm = -Math.sin(c) * 20; rArm = Math.sin(c) * 20; }
    } else if (activity === "hand raise") {
      if (att === "torso") { lArm = -140; rArm = -140; }
    } else if (activity === "sitting") {
      lLeg = 45; rLeg = 45;
      if (att === "torso") { lArm = 10; rArm = 10; }
    } else if (activity === "waving") {
      const w = Math.sin(Date.now() / 80) * 55 - 90;
      if (att === "left_arm") lArm = w;
      else rArm = -w;
    } else if (activity === "punching") {
      if (att === "left_arm") lArm = -90;
      else rArm = 90;
    }

    setPose({ headRotation: head, bodyTilt: tilt, leftArm: lArm, rightArm: rArm, leftLeg: lLeg, rightLeg: rLeg });
  }

  // ── Benchmark recorder ─────────────────────────────────────────────────
  const startRecording = () => {
    if (!newActivityName.trim()) return;
    setRecordStatus("Hold still and perform the motion for 3 seconds…");
    recordBufRef.current = [];
    isRecordingRef.current = true;

    setTimeout(() => {
      isRecordingRef.current = false;
      const buf = recordBufRef.current;
      if (buf.length < 10) {
        setRecordStatus("Failed — move your phone more and try again.");
        return;
      }
      const features = calcFeatures(buf);
      const profile: BenchmarkProfile = {
        name: newActivityName.trim().toLowerCase(),
        features,
      };
      const saved = localStorage.getItem("pq_custom_benchmarks");
      let custom: BenchmarkProfile[] = [];
      try { if (saved) custom = JSON.parse(saved); } catch {}
      custom = custom.filter(b => b.name !== profile.name);
      custom.push(profile);
      localStorage.setItem("pq_custom_benchmarks", JSON.stringify(custom));
      setBenchmarks([...DEFAULT_BENCHMARKS, ...custom]);
      setRecordStatus(`Saved profile: "${profile.name}"`);
      setNewActivityName("");
    }, 3000);
  };

  const clearCustom = () => {
    localStorage.removeItem("pq_custom_benchmarks");
    setBenchmarks(DEFAULT_BENCHMARKS);
    setRecordStatus("Custom benchmarks cleared.");
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const mag  = Math.sqrt(
    sensor.accelerometer.x ** 2 +
    sensor.accelerometer.y ** 2 +
    sensor.accelerometer.z ** 2
  );
  const fmt  = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const confColor =
    detectedActivity.confidence > 70 ? "bg-success" :
    detectedActivity.confidence > 45 ? "bg-yellow"  : "bg-grey2";

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-black flex flex-col">
      <div className="h-1 bg-yellow shrink-0" />

      {/* Header */}
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

      <div className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full space-y-4 pb-10">
        {showGate ? (
          <PermissionGate
            permissions={sensor.permissions}
            onRequest={requestPermission}
            error={sensor.error}
          />
        ) : (
          <>
            {/* Device + stream strip */}
            <div className="bg-card border border-line rounded-xl p-4 relative overflow-hidden bracket">
              <div className="absolute right-0 top-0 bottom-0 w-1 bg-yellow rounded-r-xl" />
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1">
                    Device ID
                  </p>
                  <p className="font-mono text-sm text-yellow break-all">
                    {deviceId.slice(0, 8)}
                    <span className="text-grey2">{deviceId.slice(8)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <p className="font-mono text-xs text-grey2 mb-0.5">Stream</p>
                    <p className="font-heading text-3xl text-yellow tabular-nums leading-none">
                      {fps}
                      <span className="font-mono text-xs text-grey2 ml-1">fps</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-grey2 mb-0.5">Uptime</p>
                    <p className="font-heading text-3xl text-wht tabular-nums leading-none">
                      {fmt(uptime)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {wsError && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 font-mono text-xs text-danger">
                {wsError}
              </div>
            )}

            {/* Activity + Stickman card */}
            <div className="bg-card border border-line rounded-xl overflow-hidden">

              {/* Activity header */}
              <div className="px-4 pt-4 pb-3 border-b border-line">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1">
                      Detected Activity
                    </p>
                    <p className="font-heading text-4xl text-wht tracking-wide capitalize leading-none">
                      {detectedActivity.activity}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs text-grey2 mb-1">Confidence</p>
                    <p className={`font-heading text-3xl tabular-nums leading-none ${
                      detectedActivity.confidence > 70 ? "text-success" :
                      detectedActivity.confidence > 45 ? "text-yellow"  : "text-grey"
                    }`}>
                      {detectedActivity.confidence}%
                    </p>
                  </div>
                </div>
                {/* Confidence bar */}
                <div className="mt-3 h-1 bg-line rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${confColor}`}
                    style={{ width: `${detectedActivity.confidence}%` }}
                  />
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
                {[
                  { label: "G-Force",  value: `${mag.toFixed(2)}`, unit: "m/s²" },
                  { label: "Profiles", value: `${benchmarks.length}`, unit: "active" },
                  { label: "Frames",   value: totalFrames > 9999 ? `${(totalFrames / 1000).toFixed(1)}k` : String(totalFrames), unit: "total" },
                ].map(({ label, value, unit }) => (
                  <div key={label} className="px-4 py-3">
                    <p className="font-mono text-xs text-grey2 uppercase tracking-widest">{label}</p>
                    <p className="font-heading text-2xl text-yellow mt-0.5 tabular-nums leading-tight">
                      {value}
                      <span className="font-mono text-xs text-grey2 ml-1 font-normal">{unit}</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* 3D Stickman */}
              <div className="p-4">
                <Stickman pose={pose} />
              </div>

              {/* Joint angle readout */}
              <div className="px-4 pb-4 grid grid-cols-3 gap-2">
                {([
                  ["Head",  pose.headRotation],
                  ["Body",  pose.bodyTilt],
                  ["L-Arm", pose.leftArm],
                  ["R-Arm", pose.rightArm],
                  ["L-Leg", pose.leftLeg],
                  ["R-Leg", pose.rightLeg],
                ] as [string, number][]).map(([label, val]) => (
                  <div key={label} className="bg-black border border-line rounded-lg px-3 py-2">
                    <p className="font-mono text-xs text-grey2">{label}</p>
                    <p className="font-heading text-lg text-yellow tabular-nums leading-tight">
                      {Math.round(val)}°
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Phone attachment */}
            <div className="bg-card border border-line rounded-xl p-4 space-y-3">
              <div>
                <p className="font-heading text-lg text-wht tracking-wide">PHONE ATTACHMENT</p>
                <p className="font-mono text-xs text-grey2 mt-1">
                  Where is the phone placed? Maps sensor rotation to the correct joint on the stickman.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(["torso", "left_arm", "right_arm"] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setAttachment(mode)}
                    className={`py-2.5 rounded-lg border font-heading tracking-wider text-sm transition-all active:scale-95 capitalize ${
                      attachment === mode
                        ? "bg-yellow border-yellow text-black"
                        : "bg-black border-line2 text-grey hover:border-grey2 hover:text-wht"
                    }`}
                  >
                    {mode.replace("_", " ")}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-3 pt-2 border-t border-line cursor-pointer">
                <input
                  type="checkbox"
                  checked={invertDir}
                  onChange={e => setInvertDir(e.target.checked)}
                  className="w-4 h-4 rounded accent-yellow"
                />
                <span className="font-mono text-xs text-grey">
                  Invert sensor direction (if movements feel reversed)
                </span>
              </label>
            </div>

            {/* Motion Trainer */}
            <div className="bg-card border border-line rounded-xl p-4 space-y-3">
              <div>
                <p className="font-heading text-lg text-wht tracking-wide">MOTION TRAINER</p>
                <p className="font-mono text-xs text-grey2 mt-1">
                  Train new activity profiles. Type a name, press REC, then hold the motion for 3 seconds.
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  value={newActivityName}
                  onChange={e => setNewActivityName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && startRecording()}
                  placeholder="e.g. running, jumping, climbing"
                  className="flex-1 bg-black border border-line2 rounded-lg px-3 py-2.5 font-mono text-xs text-wht placeholder-grey2 focus:outline-none focus:border-yellow transition-colors"
                />
                <button
                  onClick={startRecording}
                  disabled={!newActivityName.trim()}
                  className="btn-yellow px-4 py-2.5 rounded-lg font-heading tracking-wider text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  REC 3s
                </button>
              </div>

              {recordStatus && (
                <div className="bg-black border border-line2 rounded-lg px-3 py-2.5">
                  <p className="font-mono text-xs text-yellow">{recordStatus}</p>
                </div>
              )}

              {/* Profile chips */}
              <div className="flex flex-wrap gap-2 pt-1">
                {benchmarks.map(b => (
                  <span
                    key={b.name}
                    className={`font-mono text-xs px-2.5 py-1 rounded-full border capitalize ${
                      b.isSystem
                        ? "border-line2 text-grey2"
                        : "border-yellow/30 text-yellow bg-yellow/5"
                    }`}
                  >
                    {b.name}{!b.isSystem && " ★"}
                  </span>
                ))}
              </div>

              {benchmarks.some(b => !b.isSystem) && (
                <button
                  onClick={clearCustom}
                  className="font-mono text-xs text-danger hover:text-danger/80 transition-colors"
                >
                  Clear custom benchmarks
                </button>
              )}
            </div>

            {/* Raw sensor panels */}
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

            {/* REST API */}
            <div className="bg-card border border-line rounded-xl p-4 space-y-3">
              <p className="font-mono text-xs text-grey2 uppercase tracking-widest">
                REST Endpoints
              </p>
              <div className="space-y-2 font-mono text-xs">
                {[
                  `/api/device/${deviceId.slice(0, 8)}…`,
                  `/api/device/${deviceId.slice(0, 8)}…/sensor`,
                ].map(ep => (
                  <div key={ep} className="flex items-center gap-2">
                    <span className="text-success bg-success/10 px-1.5 py-0.5 rounded font-semibold">
                      GET
                    </span>
                    <span className="text-grey break-all">{ep}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Workout CTA */}
            <Link
              href="/exercise"
              className="flex items-center justify-between w-full bg-yellow rounded-xl px-5 py-4 group card-lift"
            >
              <div>
                <p className="font-heading text-xl text-black tracking-wide">WORKOUT TRACKER</p>
                <p className="text-black/60 text-xs mt-0.5">Rep Counter · Form Check</p>
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