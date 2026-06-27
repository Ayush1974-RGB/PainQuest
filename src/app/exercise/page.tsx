"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useCamera } from "@/hooks/useCamera";
import { usePoseDetection } from "@/hooks/usePoseDetection";
import { useExerciseAnalyzer, type ExerciseType } from "@/hooks/useExerciseAnalyzer";

const EXERCISES: { id: ExerciseType; label: string; icon: string; muscle: string; tip: string }[] = [
  { id: "bicep_curl",     label: "Bicep Curl",      icon: "💪", muscle: "Biceps",        tip: "Face the camera sideways. Keep elbow tucked." },
  { id: "squat",          label: "Squat",            icon: "🏋️", muscle: "Quads/Glutes",  tip: "Face camera sideways. Feet shoulder-width apart." },
  { id: "pushup",         label: "Push-Up",          icon: "⬆️", muscle: "Chest/Triceps", tip: "Camera on the side. Keep body straight as a plank." },
  { id: "shoulder_press", label: "Shoulder Press",   icon: "🙌", muscle: "Shoulders",     tip: "Face camera. Press directly overhead." },
  { id: "jumping_jack",   label: "Jumping Jack",     icon: "⭐", muscle: "Full Body",     tip: "Face the camera. Arms and legs out wide." },
];

const PHASE_COLOR = {
  up:      "text-accent-green",
  down:    "text-accent-cyan",
  neutral: "text-txt-dim",
};

const FEEDBACK_STYLE = {
  good: "bg-accent-green/10 border-accent-green/30 text-accent-green",
  warn: "bg-accent-amber/10 border-accent-amber/30 text-accent-amber",
  info: "bg-accent-cyan/10  border-accent-cyan/30  text-accent-cyan",
};

export default function ExercisePage() {
  const [selectedExercise, setSelectedExercise] = useState<ExerciseType>("bicep_curl");
  const [isActive, setIsActive] = useState(false);
  const [repFlash, setRepFlash] = useState(false);
  const [sessionReps, setSessionReps] = useState<number[]>([]);
  const prevRepsRef = useRef(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { status: camStatus, error: camError, start: startCam, stop: stopCam } = useCamera(videoRef);
  const { status: poseStatus, pose, error: poseError, canvasRef } = usePoseDetection(videoRef, isActive);
  const { state: exercise, analyze, reset } = useExerciseAnalyzer(selectedExercise);

  // Run analyzer on every pose update
  useEffect(() => {
    if (pose && isActive) analyze(pose);
  }, [pose, analyze, isActive]);

  // Flash on new rep
  useEffect(() => {
    if (exercise.reps > prevRepsRef.current) {
      prevRepsRef.current = exercise.reps;
      setRepFlash(true);
      setTimeout(() => setRepFlash(false), 400);
    }
  }, [exercise.reps]);

  const handleStart = useCallback(async () => {
    reset();
    prevRepsRef.current = 0;
    await startCam();
    setIsActive(true);
  }, [startCam, reset]);

  const handleStop = useCallback(() => {
    setIsActive(false);
    stopCam();
    if (exercise.reps > 0) setSessionReps(s => [...s, exercise.reps]);
  }, [stopCam, exercise.reps]);

  const handleExerciseChange = useCallback((id: ExerciseType) => {
    if (isActive) handleStop();
    setSelectedExercise(id);
    setSessionReps([]);
    reset();
    prevRepsRef.current = 0;
  }, [isActive, handleStop, reset]);

  const currentEx = EXERCISES.find(e => e.id === selectedExercise)!;
  const totalReps = sessionReps.reduce((a, b) => a + b, 0) + (isActive ? exercise.reps : 0);

  return (
    <main className="min-h-screen bg-void bg-grid flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 glass border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-muted hover:text-txt transition-colors text-sm">←</Link>
          <div className="w-px h-4 bg-border2" />
          <div className="flex items-center gap-2">
            <span className="text-accent-green text-base">🏋️</span>
            <span className="font-bold text-sm tracking-tight text-txt font-display">
              Pain<span className="text-accent-cyan">Quest</span>
            </span>
          </div>
          <span className="text-xs text-muted font-mono">/ exercise</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full border font-mono font-bold ${
            poseStatus === "ready" ? "border-accent-green/30 text-accent-green bg-accent-green/10" :
            poseStatus === "loading" ? "border-accent-amber/30 text-accent-amber bg-accent-amber/10 animate-pulse" :
            "border-border2 text-muted"}`}>
            {poseStatus === "loading" ? "AI LOADING…" : poseStatus === "ready" ? "AI READY" : "AI"}
          </span>
        </div>
      </header>

      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-4 space-y-4">

        {/* Exercise selector */}
        <div className="space-y-2">
          <p className="text-xs text-muted font-mono uppercase tracking-widest">Select Exercise</p>
          <div className="grid grid-cols-5 gap-2">
            {EXERCISES.map(ex => (
              <button key={ex.id} onClick={() => handleExerciseChange(ex.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-200 active:scale-95 ${
                  selectedExercise === ex.id
                    ? "border-accent-green/50 bg-accent-green/10 glow-green"
                    : "border-border2 bg-panel hover:border-border2"}`}>
                <span className="text-xl">{ex.icon}</span>
                <span className={`text-xs font-mono leading-tight text-center ${
                  selectedExercise === ex.id ? "text-accent-green" : "text-muted"}`}>
                  {ex.label.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Camera / Video feed */}
        <div className="relative bg-panel border border-border2 rounded-2xl overflow-hidden aspect-[4/3]">
          {/* Video element */}
          <video ref={videoRef} autoPlay playsInline muted
            className="w-full h-full object-cover scale-x-[-1]"
            style={{ display: camStatus === "active" ? "block" : "none" }} />

          {/* Skeleton canvas overlay */}
          <canvas ref={canvasRef}
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1] pointer-events-none"
            style={{ display: camStatus === "active" ? "block" : "none" }} />

          {/* Idle state */}
          {camStatus !== "active" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
              <div className="w-20 h-20 rounded-2xl bg-panel2 border border-border2 flex items-center justify-center text-4xl animate-float">
                {currentEx.icon}
              </div>
              <div className="text-center space-y-1">
                <p className="text-txt font-semibold">{currentEx.label}</p>
                <p className="text-xs text-muted">{currentEx.tip}</p>
              </div>
              {(camError || poseError) && (
                <div className="bg-accent-red/10 border border-accent-red/30 rounded-xl p-3 text-xs text-accent-red text-center max-w-xs">
                  {camError ?? poseError}
                </div>
              )}
            </div>
          )}

          {/* Live overlay badges */}
          {camStatus === "active" && (
            <>
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 backdrop-blur rounded-full px-3 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />
                <span className="text-xs font-bold text-white font-mono">LIVE</span>
              </div>
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur rounded-full px-3 py-1.5">
                <span className="text-xs font-bold text-accent-cyan font-mono">
                  {Math.round(exercise.confidence * 100)}% confidence
                </span>
              </div>
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur rounded-xl px-3 py-2">
                <p className="text-xs text-txt-dim font-mono">Joint Angle</p>
                <p className="text-xl font-bold font-mono text-accent-amber tabular-nums">
                  {exercise.angle}°
                </p>
              </div>
            </>
          )}
        </div>

        {/* Rep counter + phase */}
        <div className="grid grid-cols-3 gap-3">
          <div className={`col-span-2 bg-panel border border-border2 rounded-2xl p-4 flex items-center justify-between transition-all duration-200 ${repFlash ? "border-accent-green/60 glow-green" : ""}`}>
            <div>
              <p className="text-xs text-muted font-mono uppercase tracking-widest mb-1">Reps</p>
              <p className={`text-5xl font-black font-mono tabular-nums text-glow-green transition-all duration-150 ${repFlash ? "text-accent-green scale-110" : "text-txt"}`}>
                {exercise.reps}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted font-mono uppercase tracking-widest mb-1">Phase</p>
              <p className={`text-lg font-bold font-mono uppercase ${PHASE_COLOR[exercise.phase]}`}>
                {exercise.phase}
              </p>
            </div>
          </div>

          <div className="bg-panel border border-border2 rounded-2xl p-4 flex flex-col justify-between">
            <p className="text-xs text-muted font-mono uppercase tracking-widest">Session</p>
            <div>
              <p className="text-3xl font-black font-mono text-accent-purple tabular-nums">{totalReps}</p>
              <p className="text-xs text-muted mt-1">{sessionReps.length} sets</p>
            </div>
          </div>
        </div>

        {/* Feedback */}
        <div className={`border rounded-xl px-4 py-3 flex items-center gap-3 transition-all duration-300 ${FEEDBACK_STYLE[exercise.feedbackType]}`}>
          <span className="text-xl shrink-0">
            {exercise.feedbackType === "good" ? "✅" : exercise.feedbackType === "warn" ? "⚠️" : "💡"}
          </span>
          <p className="text-sm font-medium leading-snug">{exercise.feedback}</p>
        </div>

        {/* Start / Stop */}
        {!isActive ? (
          <button onClick={handleStart}
            className="w-full py-4 rounded-2xl font-bold text-base bg-accent-green text-void hover:bg-white transition-all duration-200 active:scale-95 glow-green relative overflow-hidden group">
            <span className="relative z-10">▶ Start {currentEx.label}</span>
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
          </button>
        ) : (
          <button onClick={handleStop}
            className="w-full py-4 rounded-2xl font-bold text-base bg-accent-red/20 text-accent-red border border-accent-red/40 hover:bg-accent-red/30 transition-all duration-200 active:scale-95">
            ⏹ Stop & Save Set
          </button>
        )}

        {/* Set history */}
        {sessionReps.length > 0 && (
          <div className="bg-panel border border-border2 rounded-2xl p-4 space-y-3">
            <p className="text-xs text-muted font-mono uppercase tracking-widest">Set History</p>
            <div className="flex flex-wrap gap-2">
              {sessionReps.map((reps, i) => (
                <div key={i} className="flex items-center gap-2 bg-panel2 border border-border2 rounded-xl px-3 py-2">
                  <span className="text-xs text-muted font-mono">Set {i + 1}</span>
                  <span className="text-sm font-bold text-accent-purple font-mono">{reps} reps</span>
                </div>
              ))}
            </div>
            <div className="pt-1 border-t border-border flex justify-between text-sm">
              <span className="text-muted font-mono">Total</span>
              <span className="font-bold text-accent-green font-mono">
                {sessionReps.reduce((a, b) => a + b, 0)} reps · {sessionReps.length} sets
              </span>
            </div>
          </div>
        )}

        {/* Tip */}
        <div className="bg-panel2 border border-border rounded-xl p-4 flex gap-3">
          <span className="text-xl shrink-0">📌</span>
          <div>
            <p className="text-xs font-bold text-txt-dim uppercase tracking-widest mb-1">Camera Tip</p>
            <p className="text-xs text-muted leading-relaxed">{currentEx.tip}</p>
          </div>
        </div>

        <Link href="/dashboard"
          className="flex items-center justify-center gap-2 w-full text-sm text-txt-dim hover:text-accent-cyan transition-colors py-2 font-mono">
          ← Back to Sensor Dashboard
        </Link>

      </div>
    </main>
  );
}
