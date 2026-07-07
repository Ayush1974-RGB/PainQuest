"use client";

import { useRef, useState, useCallback } from "react";
import { calculateAngle } from "./usePoseDetection";
import type { PoseResult, Keypoint } from "./usePoseDetection";
import type { ExerciseType } from "./useExerciseAnalyzer";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VideoStatus =
  | "idle"
  | "loading_model"
  | "ready"       // model loaded, waiting for video
  | "playing"     // video is playing + being analyzed live
  | "paused"
  | "done"
  | "error";

export interface LiveFrame {
  time: number;
  angle: number;
  phase: "up" | "down" | "neutral";
  formErrors: string[];
  confidence: number;
  repCounted: boolean;  // did this frame trigger a rep?
}

export interface VideoSummary {
  goodReps: number;        // reps with no form errors during that rep
  badReps: number;         // reps where form errors were detected
  totalReps: number;
  avgConfidence: number;
  durationSeconds: number;
  formErrorCounts: Record<string, number>;  // error → how many times seen
  improvements: string[];  // top 3 things to fix
}

// ─── Thresholds per exercise ──────────────────────────────────────────────────

type ThresholdMap = Record<ExerciseType, { down: number; up: number; countOn: "up" | "down" }>;

const THRESHOLDS: ThresholdMap = {
  bicep_curl:     { down: 150, up: 60,  countOn: "up"   },
  squat:          { down: 100, up: 160, countOn: "up"   },
  pushup:         { down: 80,  up: 150, countOn: "up"   },
  shoulder_press: { down: 160, up: 80,  countOn: "down" },
  jumping_jack:   { down: 70,  up: 20,  countOn: "down" },
};

// ─── Angle extraction ─────────────────────────────────────────────────────────

function getAngle(
  pose: PoseResult,
  exercise: ExerciseType
): { angle: number; confidence: number } {
  const kp = (name: string): Keypoint | undefined =>
    pose.keypoints.find(k => k.name === name && (k.score ?? 0) > 0.2);

  const trio = (a: string, b: string, c: string) => {
    const A = kp(a); const B = kp(b); const C = kp(c);
    if (A && B && C)
      return { angle: calculateAngle(A, B, C), confidence: Math.min(A.score, B.score, C.score) };
    return null;
  };

  switch (exercise) {
    case "bicep_curl":
    case "pushup":
    case "shoulder_press": {
      const r = trio("right_shoulder", "right_elbow", "right_wrist");
      const l = trio("left_shoulder",  "left_elbow",  "left_wrist");
      if (r && l) return r.confidence >= l.confidence ? r : l;
      return r ?? l ?? { angle: 0, confidence: 0 };
    }
    case "squat": {
      const r = trio("right_hip", "right_knee", "right_ankle");
      const l = trio("left_hip",  "left_knee",  "left_ankle");
      if (r && l) return r.confidence >= l.confidence ? r : l;
      return r ?? l ?? { angle: 0, confidence: 0 };
    }
    case "jumping_jack": {
      const lSh = kp("left_shoulder"); const rSh = kp("right_shoulder");
      const lWr = kp("left_wrist");   const rWr = kp("right_wrist");
      if (lSh && rSh && lWr && rWr) {
        const sw   = Math.abs(lSh.x - rSh.x) || 1;
        const ws   = Math.abs(lWr.x - rWr.x);
        const conf = Math.min(lSh.score, rSh.score, lWr.score, rWr.score);
        return { angle: (Math.min(ws / sw, 2) / 2) * 90, confidence: conf };
      }
      return { angle: 0, confidence: 0 };
    }
    default: return { angle: 0, confidence: 0 };
  }
}

// ─── Form error detection ─────────────────────────────────────────────────────

function detectFormErrors(
  pose: PoseResult,
  exercise: ExerciseType,
  phase: "up" | "down" | "neutral"
): string[] {
  const errors: string[] = [];
  const kp = (name: string): Keypoint | undefined =>
    pose.keypoints.find(k => k.name === name && (k.score ?? 0) > 0.25);

  switch (exercise) {
    case "bicep_curl": {
      const rSh = kp("right_shoulder"); const rEl = kp("right_elbow"); const rWr = kp("right_wrist");
      const lSh = kp("left_shoulder");  const lEl = kp("left_elbow");
      if (rSh && rEl) {
        const drift = Math.abs(rEl.x - rSh.x);
        const ref   = Math.abs((lSh?.x ?? rSh.x) - rSh.x) || 100;
        if (drift > ref * 0.35) errors.push("Elbow drifting — keep it pinned to your side");
      }
      if (lSh && lEl) {
        const drift = Math.abs(lEl.x - lSh.x);
        const ref   = Math.abs((kp("right_shoulder")?.x ?? lSh.x) - lSh.x) || 100;
        if (drift > ref * 0.35) errors.push("Left elbow drifting — keep it pinned");
      }
      if (phase === "down" && rSh && rEl && rWr && calculateAngle(rSh, rEl, rWr) < 140)
        errors.push("Not fully extending at the bottom — lower all the way");
      break;
    }
    case "squat": {
      const lHip  = kp("left_hip");   const lKnee = kp("left_knee");
      const rKnee = kp("right_knee"); const lAnk  = kp("left_ankle");
      const rAnk  = kp("right_ankle"); const lSh  = kp("left_shoulder");
      if (lKnee && rKnee && lAnk && rAnk && phase === "down") {
        if (Math.abs(lKnee.x - rKnee.x) < Math.abs(lAnk.x - rAnk.x) * 0.75)
          errors.push("Knees caving in — push knees out over toes");
      }
      if (phase === "down" && lHip && lKnee && lAnk && calculateAngle(lHip, lKnee, lAnk) > 115)
        errors.push("Not deep enough — try to break parallel");
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
      const lWr = kp("left_wrist");   const rWr = kp("right_wrist");
      const lSh = kp("left_shoulder"); const rSh = kp("right_shoulder");
      const lAnk = kp("left_ankle");  const rAnk = kp("right_ankle");
      const lHip = kp("left_hip");    const rHip = kp("right_hip");
      if (phase === "up") {
        if (lWr && lSh && lWr.y > lSh.y + 20) errors.push("Left arm not high enough — raise fully overhead");
        if (rWr && rSh && rWr.y > rSh.y + 20) errors.push("Right arm not high enough — raise fully overhead");
        if (lAnk && rAnk && lHip && rHip &&
            Math.abs(lAnk.x - rAnk.x) < Math.abs(lHip.x - rHip.x) * 1.2)
          errors.push("Legs not spreading wide enough");
      }
      break;
    }
  }
  return errors;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVideoAnalysis() {
  const [status,     setStatus]     = useState<VideoStatus>("idle");
  const [error,      setError]      = useState<string | null>(null);
  const [liveFrames, setLiveFrames] = useState<LiveFrame[]>([]);
  const [goodReps,   setGoodReps]   = useState(0);
  const [badReps,    setBadReps]    = useState(0);
  const [summary,    setSummary]    = useState<VideoSummary | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration,    setDuration]    = useState(0);
  const [liveAngle,   setLiveAngle]   = useState(0);
  const [livePhase,   setLivePhase]   = useState<"up"|"down"|"neutral">("neutral");
  const [liveErrors,  setLiveErrors]  = useState<string[]>([]);
  const [liveConf,    setLiveConf]    = useState(0);

  const detectorRef    = useRef<any>(null);
  const videoRef       = useRef<HTMLVideoElement | null>(null);
  const canvasRef      = useRef<HTMLCanvasElement | null>(null);
  const rafRef         = useRef<number | null>(null);
  const exerciseRef    = useRef<ExerciseType>("bicep_curl");
  const framesRef      = useRef<LiveFrame[]>([]);

  // Rep counting state (in refs to stay fresh inside RAF)
  const hasBeenDownRef = useRef(false);
  const lastRepTimeRef = useRef(-999);
  const currentRepHasErrorRef = useRef(false);
  const goodRepsRef    = useRef(0);
  const badRepsRef     = useRef(0);
  const errorCountsRef = useRef<Record<string, number>>({});

  // ── Load MoveNet model ────────────────────────────────────────────────
  const loadModel = useCallback(async (): Promise<boolean> => {
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
      setStatus("ready");
      return true;
    } catch (e: any) {
      setError(e?.message ?? "Failed to load pose model");
      setStatus("error");
      return false;
    }
  }, []);

  // ── RAF analysis loop (runs every video frame while playing) ──────────
  const analyzeFrame = useCallback(async () => {
    const video    = videoRef.current;
    const canvas   = canvasRef.current;
    const detector = detectorRef.current;
    const exercise = exerciseRef.current;

    if (!video || !canvas || !detector || video.paused || video.ended) {
      if (video?.ended) {
        buildSummary(video.duration);
        setStatus("done");
      }
      return;
    }

    // Draw current video frame onto canvas for pose detection
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Update current time display
    setCurrentTime(video.currentTime);

    // Run pose detection
    let pose: PoseResult | null = null;
    try {
      const poses = await detector.estimatePoses(canvas);
      if (poses.length > 0) {
        pose = {
          score: poses[0].score ?? 0,
          keypoints: poses[0].keypoints.map((kp: any) => ({
            x: kp.x, y: kp.y, score: kp.score ?? 0, name: kp.name ?? "",
          })),
        };
      }
    } catch { /* skip frame */ }

    if (pose && pose.score > 0.1) {
      const { angle, confidence } = getAngle(pose, exercise);
      const thresh = THRESHOLDS[exercise];

      // Phase detection
      let phase: "up" | "down" | "neutral";
      if (exercise === "jumping_jack" || exercise === "shoulder_press") {
        phase = angle >= thresh.down ? "up" : angle <= thresh.up ? "down" : "neutral";
      } else {
        phase = angle <= thresh.up ? "up" : angle >= thresh.down ? "down" : "neutral";
      }

      // Form errors (only check on active phases)
      const formErrors = phase !== "neutral"
        ? detectFormErrors(pose, exercise, phase)
        : [];

      // Track if current rep has any errors
      if (formErrors.length > 0) {
        currentRepHasErrorRef.current = true;
        formErrors.forEach(e => {
          errorCountsRef.current[e] = (errorCountsRef.current[e] ?? 0) + 1;
        });
      }

      // Rep counting state machine
      const loadPhase    = thresh.countOn === "up" ? "down" : "up";
      const triggerPhase = thresh.countOn;
      let repCounted = false;

      if (phase === loadPhase) hasBeenDownRef.current = true;

      if (phase === triggerPhase && hasBeenDownRef.current) {
        const now = video.currentTime;
        if (now - lastRepTimeRef.current > 0.8) {
          // Decide if this rep was good or bad
          if (currentRepHasErrorRef.current) {
            badRepsRef.current += 1;
            setBadReps(badRepsRef.current);
          } else {
            goodRepsRef.current += 1;
            setGoodReps(goodRepsRef.current);
          }
          hasBeenDownRef.current = false;
          currentRepHasErrorRef.current = false;
          lastRepTimeRef.current = now;
          repCounted = true;
        }
      }

      // Update live display state
      setLiveAngle(Math.round(angle));
      setLivePhase(phase);
      setLiveErrors(formErrors);
      setLiveConf(confidence);

      // Store frame
      const frame: LiveFrame = {
        time: video.currentTime, angle: Math.round(angle),
        phase, formErrors, confidence, repCounted,
      };
      framesRef.current.push(frame);

      // Update frames state every 10 frames to avoid too many re-renders
      if (framesRef.current.length % 10 === 0) {
        setLiveFrames([...framesRef.current]);
      }
    }

    // Schedule next frame
    rafRef.current = requestAnimationFrame(() => { analyzeFrame(); });
  }, []);

  // ── Build end summary ─────────────────────────────────────────────────
  function buildSummary(dur: number) {
    const frames   = framesRef.current;
    const errCounts = errorCountsRef.current;
    const totalConf = frames.reduce((s, f) => s + f.confidence, 0);

    // Top improvements = errors sorted by frequency
    const improvements = Object.entries(errCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([msg]) => msg);

    if (improvements.length === 0) improvements.push("Great form throughout! Keep it up.");

    const s: VideoSummary = {
      goodReps:        goodRepsRef.current,
      badReps:         badRepsRef.current,
      totalReps:       goodRepsRef.current + badRepsRef.current,
      avgConfidence:   frames.length > 0 ? totalConf / frames.length : 0,
      durationSeconds: dur,
      formErrorCounts: errCounts,
      improvements,
    };
    setSummary(s);
    setLiveFrames([...framesRef.current]);
  }

  // ── Attach video + start analysis ─────────────────────────────────────
  const attachVideo = useCallback(async (
    videoEl: HTMLVideoElement,
    exercise: ExerciseType
  ) => {
    // Reset state
    framesRef.current         = [];
    hasBeenDownRef.current    = false;
    lastRepTimeRef.current    = -999;
    currentRepHasErrorRef.current = false;
    goodRepsRef.current       = 0;
    badRepsRef.current        = 0;
    errorCountsRef.current    = {};

    setGoodReps(0);
    setBadReps(0);
    setSummary(null);
    setLiveFrames([]);
    setLiveAngle(0);
    setLivePhase("neutral");
    setLiveErrors([]);
    setLiveConf(0);
    setCurrentTime(0);
    setError(null);

    exerciseRef.current = exercise;
    videoRef.current    = videoEl;

    const ok = await loadModel();
    if (!ok) return;

    setDuration(videoEl.duration || 0);
    setStatus("playing");

    // Create hidden canvas for frame capture
    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }

    // Start RAF loop
    rafRef.current = requestAnimationFrame(() => { analyzeFrame(); });
  }, [loadModel, analyzeFrame]);

  const onVideoPause = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setStatus("paused");
  }, []);

  const onVideoResume = useCallback(() => {
    setStatus("playing");
    rafRef.current = requestAnimationFrame(() => { analyzeFrame(); });
  }, [analyzeFrame]);

  const onVideoEnded = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const video = videoRef.current;
    buildSummary(video?.duration ?? 0);
    setStatus("done");
  }, []);

  const reset = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    videoRef.current  = null;
    framesRef.current = [];
    hasBeenDownRef.current        = false;
    currentRepHasErrorRef.current = false;
    goodRepsRef.current = 0;
    badRepsRef.current  = 0;
    errorCountsRef.current = {};
    setStatus("idle");
    setGoodReps(0);
    setBadReps(0);
    setSummary(null);
    setLiveFrames([]);
    setLiveAngle(0);
    setLivePhase("neutral");
    setLiveErrors([]);
    setLiveConf(0);
    setCurrentTime(0);
    setDuration(0);
    setError(null);
  }, []);

  return {
    // state
    status, error, summary,
    goodReps, badReps,
    liveFrames, liveAngle, livePhase, liveErrors, liveConf,
    currentTime, duration,
    // actions
    attachVideo, onVideoPause, onVideoResume, onVideoEnded, reset,
  };
}