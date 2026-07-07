"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useCamera } from "@/hooks/useCamera";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import { useExerciseAnalyzer, type ExerciseType } from "@/hooks/useExerciseAnalyzer";
import { useVideoAnalysis } from "@/hooks/useVideoAnalysis";

const EXERCISES: {
  id: ExerciseType; label: string; short: string; muscle: string; tip: string;
}[] = [
  { id: "bicep_curl",     label: "Bicep Curl",    short: "CURL",  muscle: "Biceps",         tip: "Stand sideways to camera. Keep elbow pinned to your side through the full rep." },
  { id: "squat",          label: "Squat",          short: "SQUAT", muscle: "Quads / Glutes", tip: "Stand sideways to camera. Feet shoulder-width. Break parallel for a full rep." },
  { id: "pushup",         label: "Push-Up",        short: "PUSH",  muscle: "Chest",          tip: "Camera on your side. Body in a straight line. Chest to 90° before pressing up." },
  { id: "shoulder_press", label: "Shoulder Press", short: "PRESS", muscle: "Shoulders",      tip: "Face the camera. Start at ear level, press directly overhead until arms lock out." },
  { id: "jumping_jack",   label: "Jumping Jack",   short: "JACK",  muscle: "Full Body",      tip: "Face the camera. Arms and legs must reach full extension on every up phase." },
];

const PHASE_LABEL: Record<string, string> = { up: "UP", down: "DOWN", neutral: "HOLD" };

const FB_STYLE: Record<string, string> = {
  good: "border-success/30 text-success bg-success/5",
  warn: "border-yellow/30  text-yellow  bg-yellow/5",
  info: "border-line2      text-grey    bg-transparent",
};

type Mode = "live" | "video";

// ─── Small reusable bits ──────────────────────────────────────────────────────

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function WarnIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
    </svg>
  );
}
function XIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExercisePage() {
  const [selected,    setSelected]    = useState<ExerciseType>("bicep_curl");
  const [isActive,    setIsActive]    = useState(false);
  const [repFlash,    setRepFlash]    = useState(false);
  const [sessionSets, setSessionSets] = useState<{ exercise: string; reps: number }[]>([]);
  const [mode,        setMode]        = useState<Mode>("live");
  const prevRepsRef = useRef(0);

  // ── Live camera ────────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { status: camStatus, error: camError, start: startCam, stop: stopCam } = useCamera(videoRef);
  const { status: poseStatus, pose, error: poseError, canvasRef } = usePoseDetection(videoRef, isActive);
  const { state: ex, analyze, reset } = useExerciseAnalyzer(selected);

  useEffect(() => {
    if (pose && isActive) analyze(pose);
  }, [pose, analyze, isActive]);

  useEffect(() => {
    if (ex.reps > prevRepsRef.current) {
      prevRepsRef.current = ex.reps;
      setRepFlash(true);
      const t = setTimeout(() => setRepFlash(false), 350);
      return () => clearTimeout(t);
    }
  }, [ex.reps]);

  const handleStart = useCallback(async () => {
    reset(); prevRepsRef.current = 0;
    await startCam(); setIsActive(true);
  }, [startCam, reset]);

  const handleStop = useCallback(() => {
    setIsActive(false); stopCam();
    if (ex.reps > 0) {
      const cur = EXERCISES.find(e => e.id === selected)!;
      setSessionSets(s => [...s, { exercise: cur.label, reps: ex.reps }]);
    }
  }, [stopCam, ex.reps, selected]);

  const handleSelect = useCallback((id: ExerciseType) => {
    if (isActive) handleStop();
    setSelected(id); reset(); prevRepsRef.current = 0;
    va.reset();
  }, [isActive, handleStop, reset]);

  // ── Video analysis ─────────────────────────────────────────────────────
  const va = useVideoAnalysis();
  const uploadVideoRef  = useRef<HTMLVideoElement | null>(null);
  const fileInputRef    = useRef<HTMLInputElement | null>(null);
  const objectUrlRef    = useRef<string | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Clean up previous object URL
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);

    va.reset();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;

    // Wait for the video element to be ready
    const videoEl = uploadVideoRef.current;
    if (!videoEl) return;

    videoEl.src = url;
    videoEl.load();

    await new Promise<void>((res) => {
      videoEl.onloadedmetadata = () => res();
    });

    // Attach to the analysis engine — analysis starts when video plays
    await va.attachVideo(videoEl, selected);
  }, [va, selected]);

  const curEx     = EXERCISES.find(e => e.id === selected)!;
  const totalReps = sessionSets.reduce((a, b) => a + b.reps, 0) + (isActive ? ex.reps : 0);
  const confPct   = Math.round(ex.confidence * 100);

  // Timeline bar data (sampled for display)
  const timelineBars = va.liveFrames.filter((_, i) => i % 5 === 0);

  // Progress through video (0–100)
  const videoProgress = va.duration > 0 ? (va.currentTime / va.duration) * 100 : 0;

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
          <span className="font-mono text-xs text-grey2">/ workout</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${
            poseStatus === "ready"   ? "bg-success pulse-dot" :
            poseStatus === "loading" ? "bg-yellow pulse-dot"  : "bg-grey2"
          }`} />
          <span className={`font-mono text-xs ${
            poseStatus === "ready"   ? "text-success" :
            poseStatus === "loading" ? "text-yellow"  : "text-grey2"
          }`}>
            {poseStatus === "loading" ? "LOADING…" : poseStatus === "ready" ? "READY" : "OFFLINE"}
          </span>
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-4 pb-10">

        {/* Exercise picker */}
        <div>
          <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-2">Choose Exercise</p>
          <div className="grid grid-cols-5 gap-1.5">
            {EXERCISES.map(e => (
              <button key={e.id} onClick={() => handleSelect(e.id)}
                className={`py-2.5 rounded-lg border font-heading text-sm tracking-wider transition-all active:scale-95 ${
                  selected === e.id
                    ? "bg-yellow border-yellow text-black"
                    : "bg-card border-line2 text-grey hover:border-grey2 hover:text-wht"
                }`}>
                {e.short}
              </button>
            ))}
          </div>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2">
          {(["live", "video"] as Mode[]).map(m => (
            <button key={m} onClick={() => { if (isActive) handleStop(); setMode(m); }}
              className={`py-2.5 rounded-lg border font-heading text-sm tracking-wider transition-all active:scale-95 ${
                mode === m
                  ? "bg-yellow border-yellow text-black"
                  : "bg-card border-line2 text-grey hover:border-grey2 hover:text-wht"
              }`}>
              {m === "live" ? "LIVE CAMERA" : "VIDEO FILE"}
            </button>
          ))}
        </div>

        {/* ══════════ LIVE CAMERA MODE ══════════ */}
        {mode === "live" && (
          <>
            {/* Camera frame */}
            <div className={`relative bg-card rounded-xl overflow-hidden aspect-[4/3] border-2 transition-all duration-200 ${
              repFlash ? "border-yellow glow-yellow" : isActive ? "border-line2" : "border-line"
            }`}>
              <video ref={videoRef} autoPlay playsInline muted
                className="w-full h-full object-cover scale-x-[-1]"
                style={{ display: camStatus === "active" ? "block" : "none" }} />
              <canvas ref={canvasRef}
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
                style={{ display: camStatus === "active" ? "block" : "none" }} />

              {camStatus !== "active" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5">
                  <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-yellow/40" />
                  <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-yellow/40" />
                  <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-yellow/40" />
                  <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-yellow/40" />
                  <div className="border border-line2 rounded-xl p-4">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5">
                      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="font-heading text-xl text-wht tracking-wide">{curEx.label}</p>
                    <p className="text-grey text-xs mt-1">{curEx.muscle}</p>
                  </div>
                  {(camError || poseError) && (
                    <div className="bg-danger/10 border border-danger/30 rounded-lg p-3 text-danger text-xs text-center max-w-xs">
                      {camError ?? poseError}
                    </div>
                  )}
                </div>
              )}

              {camStatus === "active" && (
                <>
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/80 rounded px-2 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-danger live-dot" />
                    <span className="font-mono text-xs text-wht">REC</span>
                  </div>
                  <div className="absolute top-3 right-3 bg-black/80 rounded px-2 py-1">
                    <span className={`font-mono text-xs font-semibold ${
                      confPct > 60 ? "text-success" : confPct > 30 ? "text-yellow" : "text-danger"
                    }`}>{confPct}%</span>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black/80 rounded px-3 py-2">
                    <p className="font-mono text-xs text-grey2">ANGLE</p>
                    <p className="font-heading text-2xl text-yellow tabular-nums leading-tight">{ex.angle}°</p>
                  </div>
                  <div className={`absolute bottom-3 right-3 rounded px-3 py-2 font-heading text-sm tracking-widest ${
                    ex.phase === "up"   ? "bg-success/20 text-success" :
                    ex.phase === "down" ? "bg-yellow/20 text-yellow"   : "bg-black/80 text-grey"
                  }`}>{PHASE_LABEL[ex.phase]}</div>
                  {repFlash && <div className="absolute inset-0 border-4 border-yellow rounded-xl pointer-events-none" />}
                </>
              )}
            </div>

            {/* Rep counter */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`bg-card border-2 rounded-xl p-4 transition-all duration-200 ${
                repFlash ? "border-yellow shimmer-rep" : "border-line"
              }`}>
                <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1">Reps</p>
                <p className={`font-heading tabular-nums leading-none text-8xl ${
                  repFlash ? "text-yellow text-glow-yellow rep-pop" : "text-wht"
                }`}>{ex.reps}</p>
              </div>
              <div className="space-y-3">
                <div className="bg-card border border-line rounded-xl p-3">
                  <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1">Phase</p>
                  <p className={`font-heading text-3xl tracking-wider leading-tight ${
                    ex.phase === "up"   ? "text-success" :
                    ex.phase === "down" ? "text-yellow"  : "text-grey"
                  }`}>{PHASE_LABEL[ex.phase]}</p>
                </div>
                <div className="bg-card border border-line rounded-xl p-3">
                  <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1">Session</p>
                  <p className="font-heading text-3xl text-wht tabular-nums leading-tight">{totalReps}</p>
                  <p className="font-mono text-xs text-grey2">{sessionSets.length} sets</p>
                </div>
              </div>
            </div>

            {/* Live form errors */}
            {ex.formErrors.length > 0 && (
              <div className="bg-danger/5 border border-danger/30 rounded-xl p-4 space-y-2">
                <p className="font-mono text-xs text-danger uppercase tracking-widest">Form Errors</p>
                {ex.formErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-danger">
                    <span className="shrink-0 mt-0.5"><XIcon /></span>
                    <p className="text-xs leading-snug">{err}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Feedback */}
            <div className={`border rounded-xl px-4 py-3 flex items-center gap-3 ${FB_STYLE[ex.feedbackType]}`}>
              <span className="shrink-0">
                {ex.feedbackType === "good" ? <CheckIcon /> : ex.feedbackType === "warn" ? <WarnIcon /> : <InfoIcon />}
              </span>
              <p className="text-sm font-medium leading-snug">{ex.feedback}</p>
            </div>

            {/* Start / Stop */}
            {!isActive ? (
              <button onClick={handleStart} className="btn-yellow w-full py-4 rounded-xl font-heading text-2xl tracking-widest">
                START {curEx.short}
              </button>
            ) : (
              <button onClick={handleStop}
                className="w-full py-4 rounded-xl font-heading text-2xl tracking-widest border-2 border-danger text-danger hover:bg-danger/10 transition-colors active:scale-95">
                FINISH SET
              </button>
            )}

            {/* Tip */}
            <div className="bg-card border border-line rounded-xl p-4 flex gap-3">
              <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5c400" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
              </svg>
              <div>
                <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1">Camera Position</p>
                <p className="text-grey text-xs leading-relaxed">{curEx.tip}</p>
              </div>
            </div>

            {/* Set history */}
            {sessionSets.length > 0 && (
              <div className="bg-card border border-line rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-line">
                  <p className="font-mono text-xs text-grey2 uppercase tracking-widest">Set History</p>
                </div>
                <div className="divide-y divide-line">
                  {sessionSets.map((set, i) => (
                    <div key={i} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-grey2 w-8">#{i + 1}</span>
                        <span className="text-sm text-wht">{set.exercise}</span>
                      </div>
                      <span className="font-heading text-xl text-yellow">
                        {set.reps} <span className="font-mono text-xs text-grey2 font-normal">reps</span>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 border-t border-yellow/20 bg-yellow/5 flex items-center justify-between">
                  <span className="font-mono text-xs text-grey2">{sessionSets.length} SETS</span>
                  <span className="font-heading text-xl text-yellow">
                    {totalReps} <span className="font-mono text-xs text-grey2 font-normal">total reps</span>
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════ VIDEO FILE MODE ══════════ */}
        {mode === "video" && (
          <>
            {/* Hidden video element used for analysis */}
            <video
              ref={uploadVideoRef}
              controls
              playsInline
              className={`w-full rounded-xl border-2 border-line bg-card ${
                va.status === "idle" ? "hidden" : "block"
              }`}
              style={{ maxHeight: 300 }}
              onPlay={() => va.onVideoResume()}
              onPause={() => va.onVideoPause()}
              onEnded={() => va.onVideoEnded()}
            />

            {/* Upload area — shown only when idle or done */}
            {(va.status === "idle" || va.status === "done") && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-line2 rounded-xl p-8 text-center cursor-pointer hover:border-yellow/50 hover:bg-yellow/5 transition-all"
              >
                <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 border border-line2 rounded-xl flex items-center justify-center">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-heading text-lg text-wht tracking-wide">
                      {va.status === "done" ? "UPLOAD ANOTHER VIDEO" : "UPLOAD VIDEO"}
                    </p>
                    <p className="text-grey text-xs mt-1">
                      MP4, MOV, WebM · analyzed live as it plays
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Model loading */}
            {va.status === "loading_model" && (
              <div className="bg-card border border-line rounded-xl p-4 space-y-2">
                <p className="font-heading text-lg text-wht tracking-wide">LOADING MODEL…</p>
                <div className="h-1 bg-line rounded-full overflow-hidden">
                  <div className="h-full bg-yellow rounded-full animate-pulse w-1/2" />
                </div>
                <p className="font-mono text-xs text-grey2">Loading pose detection model into browser…</p>
              </div>
            )}

            {/* Live analysis overlay — shown while playing/paused */}
            {(va.status === "playing" || va.status === "paused") && (
              <>
                {/* Live rep counters */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-card border border-line rounded-xl p-3 text-center">
                    <p className="font-mono text-xs text-grey2 uppercase tracking-widest">Good Reps</p>
                    <p className="font-heading text-4xl text-success tabular-nums mt-1">{va.goodReps}</p>
                  </div>
                  <div className="bg-card border border-line rounded-xl p-3 text-center">
                    <p className="font-mono text-xs text-grey2 uppercase tracking-widest">Bad Reps</p>
                    <p className="font-heading text-4xl text-danger tabular-nums mt-1">{va.badReps}</p>
                  </div>
                  <div className="bg-card border border-line rounded-xl p-3 text-center">
                    <p className="font-mono text-xs text-grey2 uppercase tracking-widest">Total</p>
                    <p className="font-heading text-4xl text-yellow tabular-nums mt-1">
                      {va.goodReps + va.badReps}
                    </p>
                  </div>
                </div>

                {/* Live joint angle + phase */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-card border border-line rounded-xl p-3">
                    <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1">Joint Angle</p>
                    <p className="font-heading text-4xl text-yellow tabular-nums leading-tight">{va.liveAngle}°</p>
                  </div>
                  <div className="bg-card border border-line rounded-xl p-3">
                    <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1">Phase</p>
                    <p className={`font-heading text-4xl tracking-wider leading-tight ${
                      va.livePhase === "up"   ? "text-success" :
                      va.livePhase === "down" ? "text-yellow"  : "text-grey"
                    }`}>{PHASE_LABEL[va.livePhase]}</p>
                  </div>
                </div>

                {/* Live form errors */}
                {va.liveErrors.length > 0 ? (
                  <div className="bg-danger/5 border border-danger/30 rounded-xl p-4 space-y-2">
                    <p className="font-mono text-xs text-danger uppercase tracking-widest">
                      Form Error — Rep NOT counted
                    </p>
                    {va.liveErrors.map((err, i) => (
                      <div key={i} className="flex items-start gap-2 text-danger">
                        <span className="shrink-0 mt-0.5"><XIcon /></span>
                        <p className="text-xs leading-snug">{err}</p>
                      </div>
                    ))}
                  </div>
                ) : va.livePhase !== "neutral" ? (
                  <div className="bg-success/5 border border-success/30 rounded-xl px-4 py-3 flex items-center gap-3 text-success">
                    <CheckIcon />
                    <p className="text-sm font-medium">Good form — rep will count</p>
                  </div>
                ) : null}

                {/* Confidence */}
                <div className="bg-card border border-line rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-mono text-xs text-grey2 uppercase tracking-widest">Pose Confidence</p>
                    <p className={`font-mono text-xs font-semibold ${
                      va.liveConf > 0.6 ? "text-success" : va.liveConf > 0.3 ? "text-yellow" : "text-danger"
                    }`}>{Math.round(va.liveConf * 100)}%</p>
                  </div>
                  <div className="h-1 bg-line rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-150 ${
                        va.liveConf > 0.6 ? "bg-success" : va.liveConf > 0.3 ? "bg-yellow" : "bg-danger"
                      }`}
                      style={{ width: `${Math.round(va.liveConf * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Live timeline */}
                {timelineBars.length > 0 && (
                  <div className="bg-card border border-line rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-mono text-xs text-grey2 uppercase tracking-widest">Rep Timeline</p>
                      <p className="font-mono text-xs text-grey2">{fmt(va.currentTime)} / {fmt(va.duration)}</p>
                    </div>
                    {/* Progress bar */}
                    <div className="h-0.5 bg-line rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-yellow rounded-full transition-all duration-300"
                        style={{ width: `${videoProgress}%` }} />
                    </div>
                    {/* Angle bars */}
                    <div className="flex items-end gap-px h-12">
                      {timelineBars.map((f, i) => {
                        const h   = Math.max(4, (f.angle / 180) * 100);
                        const col =
                          f.repCounted        ? "bg-yellow"  :
                          f.formErrors.length ? "bg-danger"  :
                          f.phase === "up"    ? "bg-success" :
                          f.phase === "down"  ? "bg-grey"    : "bg-line2";
                        return (
                          <div key={i} className={`flex-1 rounded-sm ${col} opacity-80`}
                            style={{ height: `${h}%` }} />
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {[
                        { col: "bg-yellow",  label: "Rep counted" },
                        { col: "bg-success", label: "Up / good form" },
                        { col: "bg-danger",  label: "Form error" },
                        { col: "bg-line2",   label: "Hold" },
                      ].map(({ col, label }) => (
                        <div key={label} className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-sm ${col}`} />
                          <span className="font-mono text-xs text-grey2">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── END SUMMARY ── */}
            {va.status === "done" && va.summary && (
              <>
                {/* Score cards */}
                <div className="bg-card border border-line rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-line">
                    <p className="font-mono text-xs text-grey2 uppercase tracking-widest">Session Summary</p>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-line">
                    <div className="px-4 py-4 text-center">
                      <p className="font-mono text-xs text-grey2 mb-1">Total Reps</p>
                      <p className="font-heading text-4xl text-yellow tabular-nums">{va.summary.totalReps}</p>
                    </div>
                    <div className="px-4 py-4 text-center">
                      <p className="font-mono text-xs text-grey2 mb-1">Good</p>
                      <p className="font-heading text-4xl text-success tabular-nums">{va.summary.goodReps}</p>
                    </div>
                    <div className="px-4 py-4 text-center">
                      <p className="font-mono text-xs text-grey2 mb-1">Bad Form</p>
                      <p className="font-heading text-4xl text-danger tabular-nums">{va.summary.badReps}</p>
                    </div>
                  </div>
                  <div className="px-4 py-3 border-t border-line flex items-center justify-between">
                    <p className="font-mono text-xs text-grey2">Form Score</p>
                    <p className={`font-heading text-2xl tabular-nums ${
                      va.summary.totalReps > 0 &&
                      va.summary.goodReps / va.summary.totalReps > 0.7
                        ? "text-success" : "text-yellow"
                    }`}>
                      {va.summary.totalReps > 0
                        ? Math.round((va.summary.goodReps / va.summary.totalReps) * 100)
                        : 0}%
                    </p>
                  </div>
                </div>

                {/* What to improve */}
                <div className="bg-card border border-line rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-line">
                    <p className="font-mono text-xs text-grey2 uppercase tracking-widest">What To Improve</p>
                  </div>
                  <div className="divide-y divide-line">
                    {va.summary.improvements.map((tip, i) => (
                      <div key={i} className="px-4 py-3 flex items-start gap-3">
                        <div className="shrink-0 w-5 h-5 rounded-full bg-yellow/10 border border-yellow/30 flex items-center justify-center mt-0.5">
                          <span className="font-heading text-yellow text-xs">{i + 1}</span>
                        </div>
                        <p className="text-sm text-wht leading-snug">{tip}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Form error breakdown */}
                {Object.keys(va.summary.formErrorCounts).length > 0 && (
                  <div className="bg-card border border-line rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-line">
                      <p className="font-mono text-xs text-grey2 uppercase tracking-widest">Error Breakdown</p>
                    </div>
                    <div className="divide-y divide-line">
                      {Object.entries(va.summary.formErrorCounts)
                        .sort((a, b) => b[1] - a[1])
                        .map(([msg, count]) => (
                          <div key={msg} className="px-4 py-3 flex items-start gap-3">
                            <span className="shrink-0 mt-0.5 text-danger"><XIcon size={12} /></span>
                            <p className="flex-1 text-xs text-grey leading-snug">{msg}</p>
                            <span className="font-mono text-xs text-danger bg-danger/10 px-2 py-0.5 rounded shrink-0">
                              {count}×
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Full timeline */}
                {timelineBars.length > 0 && (
                  <div className="bg-card border border-line rounded-xl p-4">
                    <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-3">Full Timeline</p>
                    <div className="flex items-end gap-px h-16">
                      {timelineBars.map((f, i) => {
                        const h   = Math.max(4, (f.angle / 180) * 100);
                        const col =
                          f.repCounted        ? "bg-yellow"  :
                          f.formErrors.length ? "bg-danger"  :
                          f.phase === "up"    ? "bg-success" :
                          f.phase === "down"  ? "bg-grey"    : "bg-line2";
                        return (
                          <div key={i} className={`flex-1 rounded-sm ${col} opacity-80`}
                            style={{ height: `${h}%` }} />
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="font-mono text-xs text-grey2">0s</span>
                      <span className="font-mono text-xs text-grey2">{fmt(va.summary.durationSeconds)}</span>
                    </div>
                  </div>
                )}

                {/* Upload another */}
                <button onClick={va.reset}
                  className="w-full py-3 rounded-xl font-heading text-lg tracking-wider border border-line2 text-grey hover:border-yellow/40 hover:text-yellow transition-colors">
                  ANALYZE ANOTHER VIDEO
                </button>
              </>
            )}

            {/* Error */}
            {va.status === "error" && va.error && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl p-4">
                <p className="font-mono text-xs text-danger uppercase tracking-widest mb-1">Error</p>
                <p className="text-sm text-danger">{va.error}</p>
                <button onClick={va.reset} className="mt-3 font-mono text-xs text-grey hover:text-wht transition-colors">
                  Try again
                </button>
              </div>
            )}

            {/* Info when idle */}
            {va.status === "idle" && (
              <div className="bg-card border border-line rounded-xl p-4 flex gap-3">
                <svg className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5c400" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
                </svg>
                <div className="space-y-1">
                  <p className="font-mono text-xs text-grey2 uppercase tracking-widest">How it works</p>
                  <p className="text-grey text-xs leading-relaxed">
                    Upload a video of yourself doing <span className="text-wht">{curEx.label}</span>.
                    Press play — the app analyzes your form in real time as the video plays,
                    counts good vs bad reps, and gives you a full report at the end.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        <div className="h-4" />
      </div>
    </main>
  );
}