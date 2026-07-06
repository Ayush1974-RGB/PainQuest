"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { PoseResult } from "./usePoseDetection";
import { calculateAngle } from "./usePoseDetection";

export type VideoAnalysisStatus =
  | "idle"
  | "loading_model"
  | "ready"
  | "analyzing"
  | "done"
  | "error";

export interface FrameResult {
  time: number;       // seconds into video
  reps: number;
  angle: number;
  phase: "up" | "down" | "neutral";
  formErrors: string[];
  confidence: number;
}

export interface VideoAnalysisResult {
  totalReps: number;
  totalFrames: number;
  avgConfidence: number;
  formErrorSummary: Record<string, number>; // error message → count
  frames: FrameResult[];
  durationSeconds: number;
}

/**
 * Runs pose detection + exercise analysis on a user-supplied video file.
 * The video is never uploaded anywhere — everything runs in the browser.
 */
export function useVideoAnalysis() {
  const [status,   setStatus]   = useState<VideoAnalysisStatus>("idle");
  const [progress, setProgress] = useState(0);   // 0–100
  const [result,   setResult]   = useState<VideoAnalysisResult | null>(null);
  const [error,    setError]    = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const detectorRef  = useRef<any>(null);
  const videoElRef   = useRef<HTMLVideoElement | null>(null);
  const canvasElRef  = useRef<HTMLCanvasElement | null>(null);
  const abortRef     = useRef(false);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Load the MoveNet model once
  const loadModel = useCallback(async () => {
    if (detectorRef.current) return true;
    setStatus("loading_model");
    try {
      const tf = await import("@tensorflow/tfjs");
      await import("@tensorflow/tfjs-backend-webgl");
      await tf.setBackend("webgl");
      await tf.ready();
      const pd = await import("@tensorflow-models/pose-detection");
      detectorRef.current = await pd.createDetector(
        pd.SupportedModels.MoveNet,
        { modelType: pd.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
      return true;
    } catch (e: any) {
      setError(e?.message ?? "Failed to load pose model");
      setStatus("error");
      return false;
    }
  }, []);

  const analyze = useCallback(
    async (file: File, exercise: import("./useExerciseAnalyzer").ExerciseType) => {
      abortRef.current = false;
      setResult(null);
      setError(null);
      setProgress(0);

      const ok = await loadModel();
      if (!ok) return;

      setStatus("analyzing");

      // Create a hidden video element to scrub through
      const video = document.createElement("video");
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      videoElRef.current = video;

      // Set preview URL
      setPreviewUrl(video.src);

      await new Promise<void>((res, rej) => {
        video.onloadedmetadata = () => res();
        video.onerror = () => rej(new Error("Could not load video file"));
      });

      const duration = video.duration;
      const SAMPLE_INTERVAL = 0.1; // seconds between frames (10 fps analysis)
      const totalSamples = Math.floor(duration / SAMPLE_INTERVAL);

      // ── Per-frame state (mirrors useExerciseAnalyzer logic) ──────────────
      let reps = 0;
      let hasBeenDown = false;
      let lastRepTime = -999;
      let prevPhase: "up" | "down" | "neutral" = "neutral";

      const { THRESHOLDS, detectFormErrorsStandalone } = getAnalyzerHelpers(exercise);

      const frames: FrameResult[] = [];
      let totalConf = 0;
      const errorCounts: Record<string, number> = {};

      const canvas = document.createElement("canvas");
      const ctx    = canvas.getContext("2d")!;
      canvasElRef.current = canvas;

      for (let i = 0; i <= totalSamples; i++) {
        if (abortRef.current) break;

        const t = i * SAMPLE_INTERVAL;
        video.currentTime = t;
        await new Promise<void>(res => { video.onseeked = () => res(); });

        canvas.width  = video.videoWidth  || 640;
        canvas.height = video.videoHeight || 480;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        let pose: PoseResult | null = null;
        try {
          const poses = await detectorRef.current.estimatePoses(canvas);
          if (poses.length > 0) {
            pose = {
              score: poses[0].score ?? 0,
              keypoints: poses[0].keypoints.map((kp: any) => ({
                x: kp.x, y: kp.y,
                score: kp.score ?? 0,
                name: kp.name ?? "",
              })),
            };
          }
        } catch { /* skip */ }

        if (pose && pose.score > 0.1) {
          const { angle, confidence } = getAngleForExercise(pose, exercise);
          totalConf += confidence;

          const thresh = THRESHOLDS;
          let phase: "up" | "down" | "neutral";
          if (exercise === "jumping_jack" || exercise === "shoulder_press") {
            phase = angle >= thresh.down ? "up" : angle <= thresh.up ? "down" : "neutral";
          } else {
            phase = angle <= thresh.up ? "up" : angle >= thresh.down ? "down" : "neutral";
          }

          // Rep counting
          const loadPhase    = thresh.countOn === "up" ? "down" : "up";
          const triggerPhase = thresh.countOn;
          if (phase === loadPhase) hasBeenDown = true;
          if (phase === triggerPhase && hasBeenDown) {
            if (t - lastRepTime > 0.8) {
              reps++;
              hasBeenDown = false;
              lastRepTime = t;
            }
          }
          prevPhase = phase;

          const formErrors = phase !== "neutral"
            ? detectFormErrorsStandalone(pose, phase)
            : [];

          formErrors.forEach(e => {
            errorCounts[e] = (errorCounts[e] ?? 0) + 1;
          });

          frames.push({ time: t, reps, angle: Math.round(angle), phase, formErrors, confidence });
        }

        setProgress(Math.round(((i + 1) / (totalSamples + 1)) * 100));
      }

      URL.revokeObjectURL(video.src);

      const analysisResult: VideoAnalysisResult = {
        totalReps:       reps,
        totalFrames:     frames.length,
        avgConfidence:   frames.length > 0 ? totalConf / frames.length : 0,
        formErrorSummary: errorCounts,
        frames,
        durationSeconds: duration,
      };

      setResult(analysisResult);
      setStatus("done");
      setProgress(100);
    },
    [loadModel]
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setStatus("idle");
    setProgress(0);
    setResult(null);
    setError(null);
    setPreviewUrl(null);
  }, []);

  return { status, progress, result, error, previewUrl, analyze, reset };
}

// ─── Standalone helpers (duplicated from useExerciseAnalyzer to avoid circular deps) ──

import type { ExerciseType } from "./useExerciseAnalyzer";

interface Thresholds { down: number; up: number; countOn: "up" | "down" }

function getAnalyzerHelpers(exercise: ExerciseType): {
  THRESHOLDS: Thresholds;
  detectFormErrorsStandalone: (pose: PoseResult, phase: "up" | "down" | "neutral") => string[];
} {
  const map: Record<ExerciseType, Thresholds> = {
    bicep_curl:     { down: 150, up: 60,  countOn: "up"   },
    squat:          { down: 100, up: 160, countOn: "up"   },
    pushup:         { down: 80,  up: 150, countOn: "up"   },
    shoulder_press: { down: 160, up: 80,  countOn: "down" },
    jumping_jack:   { down: 70,  up: 20,  countOn: "down" },
  };

  function detectFormErrorsStandalone(
    pose: PoseResult,
    phase: "up" | "down" | "neutral"
  ): string[] {
    const errors: string[] = [];
    const kp = (name: string) =>
      pose.keypoints.find(k => k.name === name && (k.score ?? 0) > 0.25);

    switch (exercise) {
      case "bicep_curl": {
        const rSh = kp("right_shoulder"); const rEl = kp("right_elbow"); const rWr = kp("right_wrist");
        if (rSh && rEl) {
          const drift = Math.abs(rEl.x - rSh.x);
          const ref = Math.abs((kp("left_shoulder")?.x ?? rSh.x) - rSh.x) || 100;
          if (drift > ref * 0.35) errors.push("Elbow drifting — keep it pinned to your side");
        }
        if (phase === "down" && rSh && rEl && rWr) {
          const angle = calculateAngle(rSh, rEl, rWr);
          if (angle < 140) errors.push("Not fully extending at the bottom");
        }
        break;
      }
      case "squat": {
        const lKnee = kp("left_knee"); const rKnee = kp("right_knee");
        const lAnk  = kp("left_ankle"); const rAnk  = kp("right_ankle");
        const lHip  = kp("left_hip");  const lSh   = kp("left_shoulder");
        if (lKnee && rKnee && lAnk && rAnk) {
          if (phase === "down" && Math.abs(lKnee.x - rKnee.x) < Math.abs(lAnk.x - rAnk.x) * 0.75)
            errors.push("Knees caving in — push knees out over toes");
        }
        if (phase === "down" && lHip && lKnee && lAnk) {
          if (calculateAngle(lHip, lKnee, lAnk) > 115) errors.push("Not deep enough — try to break parallel");
        }
        if (lSh && lHip && phase === "down" && lSh.x > lHip.x + 30)
          errors.push("Leaning too far forward — keep chest up");
        break;
      }
      case "pushup": {
        const lSh = kp("left_shoulder"); const lHip = kp("left_hip"); const lAnk = kp("left_ankle");
        const rSh = kp("right_shoulder"); const rEl = kp("right_elbow"); const rWr = kp("right_wrist");
        if (lSh && lHip && lAnk) {
          const mid = lSh.y + (lAnk.y - lSh.y) * 0.5;
          if (lHip.y > mid + 30) errors.push("Hips sagging — engage your core");
          if (lHip.y < mid - 40) errors.push("Hips too high — lower them");
        }
        if (phase === "down" && rSh && rEl && rWr && calculateAngle(rSh, rEl, rWr) > 100)
          errors.push("Not going low enough — chest should nearly touch the ground");
        break;
      }
      case "shoulder_press": {
        const rSh = kp("right_shoulder"); const rEl = kp("right_elbow"); const rWr = kp("right_wrist");
        if (phase === "up" && rSh && rEl && rWr && calculateAngle(rSh, rEl, rWr) < 155)
          errors.push("Not locking out — fully extend arms overhead");
        if (phase === "down" && rEl && rWr && Math.abs(rWr.x - rEl.x) > 40)
          errors.push("Wrists not stacked over elbows");
        break;
      }
      case "jumping_jack": {
        const lWr = kp("left_wrist"); const rWr = kp("right_wrist");
        const lSh = kp("left_shoulder"); const rSh = kp("right_shoulder");
        const lAnk = kp("left_ankle"); const rAnk = kp("right_ankle");
        const lHip = kp("left_hip"); const rHip = kp("right_hip");
        if (phase === "up") {
          if (lWr && lSh && lWr.y > lSh.y + 20) errors.push("Arms not high enough — raise them fully");
          if (lAnk && rAnk && lHip && rHip &&
              Math.abs(lAnk.x - rAnk.x) < Math.abs(lHip.x - rHip.x) * 1.2)
            errors.push("Legs not spreading wide enough");
        }
        break;
      }
    }
    return errors;
  }

  return { THRESHOLDS: map[exercise], detectFormErrorsStandalone };
}

function getAngleForExercise(
  pose: PoseResult,
  exercise: ExerciseType
): { angle: number; confidence: number } {
  const kp = (name: string) =>
    pose.keypoints.find(k => k.name === name && (k.score ?? 0) > 0.2);

  const tryPair = (a: string, b: string, c: string) => {
    const A = kp(a); const B = kp(b); const C = kp(c);
    if (A && B && C)
      return { angle: calculateAngle(A, B, C), confidence: Math.min(A.score, B.score, C.score) };
    return null;
  };

  switch (exercise) {
    case "bicep_curl":
    case "pushup":
    case "shoulder_press": {
      const r = tryPair("right_shoulder", "right_elbow", "right_wrist");
      const l = tryPair("left_shoulder",  "left_elbow",  "left_wrist");
      if (r && l) return r.confidence >= l.confidence ? r : l;
      return r ?? l ?? { angle: 0, confidence: 0 };
    }
    case "squat": {
      const r = tryPair("right_hip", "right_knee", "right_ankle");
      const l = tryPair("left_hip",  "left_knee",  "left_ankle");
      if (r && l) return r.confidence >= l.confidence ? r : l;
      return r ?? l ?? { angle: 0, confidence: 0 };
    }
    case "jumping_jack": {
      const lSh = kp("left_shoulder"); const rSh = kp("right_shoulder");
      const lWr = kp("left_wrist");   const rWr = kp("right_wrist");
      if (lSh && rSh && lWr && rWr) {
        const sw = Math.abs(lSh.x - rSh.x) || 1;
        const ws = Math.abs(lWr.x - rWr.x);
        const conf = Math.min(lSh.score, rSh.score, lWr.score, rWr.score);
        return { angle: (Math.min(ws / sw, 2) / 2) * 90, confidence: conf };
      }
      return { angle: 0, confidence: 0 };
    }
    default: return { angle: 0, confidence: 0 };
  }
}