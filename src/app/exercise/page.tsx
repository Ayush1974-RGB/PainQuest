"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useCamera } from "@/hooks/useCamera";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import { useExerciseAnalyzer, type ExerciseType } from "@/hooks/useExerciseAnalyzer";

const EXERCISES: {
  id: ExerciseType; label: string; short: string; muscle: string; tip: string;
}[] = [
  { id: "bicep_curl",     label: "Bicep Curl",    short: "CURL",  muscle: "Biceps",       tip: "Stand sideways to camera. Keep elbow pinned to your side through the full rep." },
  { id: "squat",          label: "Squat",          short: "SQUAT", muscle: "Quads / Glutes", tip: "Stand sideways to camera. Feet shoulder-width. Break parallel for a full rep." },
  { id: "pushup",         label: "Push-Up",        short: "PUSH",  muscle: "Chest",        tip: "Camera on your side. Body in a straight line. Chest to 90° before pressing up." },
  { id: "shoulder_press", label: "Shoulder Press", short: "PRESS", muscle: "Shoulders",    tip: "Face the camera. Start at ear level, press directly overhead until arms lock out." },
  { id: "jumping_jack",   label: "Jumping Jack",   short: "JACK",  muscle: "Full Body",    tip: "Face the camera. Arms and legs must reach full extension on every up phase." },
];

const PHASE_LABEL: Record<string, string> = {
  up: "UP", down: "DOWN", neutral: "HOLD",
};

const FB_STYLE: Record<string, string> = {
  good: "border-success/30 text-success bg-success/5",
  warn: "border-yellow/30  text-yellow  bg-yellow/5",
  info: "border-line2      text-grey    bg-transparent",
};

export default function ExercisePage() {
  const [selected, setSelected]       = useState<ExerciseType>("bicep_curl");
  const [isActive, setIsActive]       = useState(false);
  const [repFlash, setRepFlash]       = useState(false);
  const [sessionSets, setSessionSets] = useState<{ exercise: string; reps: number }[]>([]);
  const prevRepsRef = useRef(0);

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
    reset();
    prevRepsRef.current = 0;
    await startCam();
    setIsActive(true);
  }, [startCam, reset]);

  const handleStop = useCallback(() => {
    setIsActive(false);
    stopCam();
    if (ex.reps > 0) {
      const cur = EXERCISES.find(e => e.id === selected)!;
      setSessionSets(s => [...s, { exercise: cur.label, reps: ex.reps }]);
    }
  }, [stopCam, ex.reps, selected]);

  const handleSelect = useCallback((id: ExerciseType) => {
    if (isActive) handleStop();
    setSelected(id);
    reset();
    prevRepsRef.current = 0;
  }, [isActive, handleStop, reset]);

  const curEx     = EXERCISES.find(e => e.id === selected)!;
  const totalReps = sessionSets.reduce((a, b) => a + b.reps, 0) + (isActive ? ex.reps : 0);
  const confPct   = Math.round(ex.confidence * 100);

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
            {poseStatus === "loading" ? "LOADING…" :
             poseStatus === "ready"   ? "READY"    : "OFFLINE"}
          </span>
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-4">

        {/* Exercise picker */}
        <div>
          <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-2">
            Choose Exercise
          </p>
          <div className="grid grid-cols-5 gap-1.5">
            {EXERCISES.map(e => (
              <button
                key={e.id}
                onClick={() => handleSelect(e.id)}
                className={`py-2.5 rounded-lg border font-heading text-sm tracking-wider transition-all duration-150 active:scale-95 ${
                  selected === e.id
                    ? "bg-yellow border-yellow text-black"
                    : "bg-card border-line2 text-grey hover:border-grey2 hover:text-wht"
                }`}
              >
                {e.short}
              </button>
            ))}
          </div>
        </div>

        {/* Camera frame */}
        <div className={`relative bg-card rounded-xl overflow-hidden aspect-[4/3] border-2 transition-all duration-200 ${
          repFlash ? "border-yellow glow-yellow" :
          isActive  ? "border-line2"              : "border-line"
        }`}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
            style={{ display: camStatus === "active" ? "block" : "none" }}
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
            style={{ display: camStatus === "active" ? "block" : "none" }}
          />

          {/* Idle state */}
          {camStatus !== "active" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5">
              {/* Corner brackets */}
              <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-yellow/40" />
              <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-yellow/40" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-yellow/40" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-yellow/40" />
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

          {/* Live overlays */}
          {camStatus === "active" && (
            <>
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/80 rounded px-2 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-danger live-dot" />
                <span className="font-mono text-xs text-wht">REC</span>
              </div>
              <div className="absolute top-3 right-3 bg-black/80 rounded px-2 py-1">
                <span className={`font-mono text-xs font-semibold ${
                  confPct > 60 ? "text-success" :
                  confPct > 30 ? "text-yellow"  : "text-danger"
                }`}>
                  {confPct}%
                </span>
              </div>
              <div className="absolute bottom-3 left-3 bg-black/80 rounded px-3 py-2">
                <p className="font-mono text-xs text-grey2">ANGLE</p>
                <p className="font-heading text-2xl text-yellow tabular-nums leading-tight">
                  {ex.angle}°
                </p>
              </div>
              <div className={`absolute bottom-3 right-3 rounded px-3 py-2 font-heading text-sm tracking-widest ${
                ex.phase === "up"   ? "bg-success/20 text-success" :
                ex.phase === "down" ? "bg-yellow/20  text-yellow"  :
                                      "bg-black/80   text-grey"
              }`}>
                {PHASE_LABEL[ex.phase]}
              </div>
              {repFlash && (
                <div className="absolute inset-0 border-4 border-yellow rounded-xl pointer-events-none" />
              )}
            </>
          )}
        </div>

        {/* Rep counter */}
        <div className="grid grid-cols-2 gap-3">
          <div className={`bg-card border-2 rounded-xl p-4 transition-all duration-200 ${
            repFlash ? "border-yellow shimmer-rep" : "border-line"
          }`}>
            <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1">Reps</p>
            <p className={`font-heading tabular-nums leading-none ${
              repFlash ? "text-yellow text-glow-yellow rep-pop" : "text-wht"
            } text-8xl`}>
              {ex.reps}
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-card border border-line rounded-xl p-3">
              <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1">Phase</p>
              <p className={`font-heading text-3xl tracking-wider leading-tight ${
                ex.phase === "up"   ? "text-success" :
                ex.phase === "down" ? "text-yellow"  : "text-grey"
              }`}>
                {PHASE_LABEL[ex.phase]}
              </p>
            </div>
            <div className="bg-card border border-line rounded-xl p-3">
              <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1">Session</p>
              <p className="font-heading text-3xl text-wht tabular-nums leading-tight">
                {totalReps}
              </p>
              <p className="font-mono text-xs text-grey2">{sessionSets.length} sets</p>
            </div>
          </div>
        </div>

        {/* Feedback */}
        <div className={`border rounded-xl px-4 py-3 flex items-center gap-3 transition-all duration-300 ${FB_STYLE[ex.feedbackType]}`}>
          <div className="shrink-0">
            {ex.feedbackType === "good" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : ex.feedbackType === "warn" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4m0 4h.01" />
              </svg>
            )}
          </div>
          <p className="text-sm font-medium leading-snug">{ex.feedback}</p>
        </div>

        {/* Start / Stop */}
        {!isActive ? (
          <button
            onClick={handleStart}
            className="btn-yellow w-full py-4 rounded-xl font-heading text-2xl tracking-widest"
          >
            START {curEx.short}
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-full py-4 rounded-xl font-heading text-2xl tracking-widest border-2 border-danger text-danger hover:bg-danger/10 transition-colors duration-150 active:scale-95"
          >
            FINISH SET
          </button>
        )}

        {/* Camera tip */}
        <div className="bg-card border border-line rounded-xl p-4 flex gap-3">
          <div className="shrink-0 mt-0.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f5c400" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4m0 4h.01" />
            </svg>
          </div>
          <div>
            <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-1">
              Camera Position
            </p>
            <p className="text-grey text-xs leading-relaxed">{curEx.tip}</p>
          </div>
        </div>

        {/* Set history */}
        {sessionSets.length > 0 && (
          <div className="bg-card border border-line rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-line">
              <p className="font-mono text-xs text-grey2 uppercase tracking-widest">
                Set History
              </p>
            </div>
            <div className="divide-y divide-line">
              {sessionSets.map((set, i) => (
                <div key={i} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-grey2 w-8">#{i + 1}</span>
                    <span className="text-sm text-wht">{set.exercise}</span>
                  </div>
                  <span className="font-heading text-xl text-yellow">
                    {set.reps}{" "}
                    <span className="font-mono text-xs text-grey2 font-normal">reps</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t border-yellow/20 bg-yellow/5 flex items-center justify-between">
              <span className="font-mono text-xs text-grey2">
                {sessionSets.length} SETS
              </span>
              <span className="font-heading text-xl text-yellow">
                {totalReps}{" "}
                <span className="font-mono text-xs text-grey2 font-normal">total reps</span>
              </span>
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>
    </main>
  );
}