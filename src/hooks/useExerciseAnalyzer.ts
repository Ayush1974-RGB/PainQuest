"use client";

import { useRef, useState, useCallback } from "react";
import type { PoseResult, Keypoint } from "./usePoseDetection";
import { calculateAngle } from "./usePoseDetection";

export type ExerciseType = "bicep_curl" | "squat" | "pushup" | "jumping_jack" | "shoulder_press";

export interface ExerciseState {
  reps: number;
  phase: "up" | "down" | "neutral";
  angle: number;
  feedback: string;
  feedbackType: "good" | "warn" | "info";
  confidence: number;
}

function getKP(pose: PoseResult, name: string): Keypoint | undefined {
  return pose.keypoints.find(k => k.name === name && (k.score ?? 0) > 0.3);
}

function analyzeRepPhase(angle: number, exercise: ExerciseType): { phase: "up"|"down"|"neutral"; feedback: string; feedbackType: "good"|"warn"|"info" } {
  switch (exercise) {
    case "bicep_curl":
      if (angle < 60)  return { phase: "up",   feedback: "Good contraction! Lower slowly.", feedbackType: "good" };
      if (angle > 150) return { phase: "down",  feedback: "Full extension — curl up now.",   feedbackType: "info" };
      return { phase: "neutral", feedback: "Keep curling upward.", feedbackType: "info" };

    case "squat":
      if (angle < 100) return { phase: "down", feedback: "Great depth! Drive through heels.", feedbackType: "good" };
      if (angle > 160) return { phase: "up",   feedback: "Stand tall — now squat down.",      feedbackType: "info" };
      return { phase: "neutral", feedback: "Go lower for full range.", feedbackType: "warn" };

    case "pushup":
      if (angle < 90)  return { phase: "down", feedback: "Chest down! Now push up.",        feedbackType: "good" };
      if (angle > 155) return { phase: "up",   feedback: "Arms locked. Lower your chest.",   feedbackType: "info" };
      return { phase: "neutral", feedback: "Keep your core tight.", feedbackType: "info" };

    case "shoulder_press":
      if (angle > 160) return { phase: "up",   feedback: "Arms extended! Lower with control.", feedbackType: "good" };
      if (angle < 90)  return { phase: "down",  feedback: "Press up explosively.",             feedbackType: "info" };
      return { phase: "neutral", feedback: "Full extension at top.", feedbackType: "warn" };

    default:
      return { phase: "neutral", feedback: "Keep moving!", feedbackType: "info" };
  }
}

export function useExerciseAnalyzer(exercise: ExerciseType) {
  const [state, setState] = useState<ExerciseState>({
    reps: 0, phase: "neutral", angle: 0,
    feedback: "Get into position to start.", feedbackType: "info", confidence: 0,
  });
  const prevPhaseRef = useRef<"up"|"down"|"neutral">("neutral");
  const repCountedRef = useRef(false);

  const analyze = useCallback((pose: PoseResult) => {
    let angle = 0;
    let confidence = 0;

    switch (exercise) {
      case "bicep_curl": {
        const sh = getKP(pose, "right_shoulder");
        const el = getKP(pose, "right_elbow");
        const wr = getKP(pose, "right_wrist");
        if (sh && el && wr) { angle = calculateAngle(sh, el, wr); confidence = Math.min(sh.score, el.score, wr.score); }
        break;
      }
      case "squat": {
        const hip  = getKP(pose, "right_hip");
        const knee = getKP(pose, "right_knee");
        const ank  = getKP(pose, "right_ankle");
        if (hip && knee && ank) { angle = calculateAngle(hip, knee, ank); confidence = Math.min(hip.score, knee.score, ank.score); }
        break;
      }
      case "pushup": {
        const sh = getKP(pose, "right_shoulder");
        const el = getKP(pose, "right_elbow");
        const wr = getKP(pose, "right_wrist");
        if (sh && el && wr) { angle = calculateAngle(sh, el, wr); confidence = Math.min(sh.score, el.score, wr.score); }
        break;
      }
      case "shoulder_press": {
        const sh = getKP(pose, "right_shoulder");
        const el = getKP(pose, "right_elbow");
        const wr = getKP(pose, "right_wrist");
        if (sh && el && wr) { angle = calculateAngle(sh, el, wr); confidence = Math.min(sh.score, el.score, wr.score); }
        break;
      }
      case "jumping_jack": {
        const lsh = getKP(pose, "left_shoulder");
        const rsh = getKP(pose, "right_shoulder");
        const lwr = getKP(pose, "left_wrist");
        const rwr = getKP(pose, "right_wrist");
        if (lsh && rsh && lwr && rwr) {
          const spread = Math.abs(lwr.x - rwr.x) / Math.abs(lsh.x - rsh.x);
          angle = spread * 90;
          confidence = Math.min(lsh.score, rsh.score, lwr.score, rwr.score);
        }
        break;
      }
    }

    if (confidence < 0.3) {
      setState(s => ({ ...s, feedback: "Move into frame — can't see you clearly.", feedbackType: "warn", confidence }));
      return;
    }

    const { phase, feedback, feedbackType } = analyzeRepPhase(angle, exercise);
    const prev = prevPhaseRef.current;

    let newReps = state.reps;
    // Count a rep when completing a full cycle (down → up for most, up → down for squats)
    const completionPairs: Record<ExerciseType, ["up"|"down", "up"|"down"]> = {
      bicep_curl:    ["down", "up"],
      squat:         ["up",   "down"],
      pushup:        ["up",   "down"],
      shoulder_press:["down", "up"],
      jumping_jack:  ["down", "up"],
    };
    const [fromPhase, toPhase] = completionPairs[exercise];
    if (prev === fromPhase && phase === toPhase && !repCountedRef.current) {
      newReps = state.reps + 1;
      repCountedRef.current = true;
    }
    if (phase === fromPhase) repCountedRef.current = false;

    prevPhaseRef.current = phase;
    setState({ reps: newReps, phase, angle: Math.round(angle), feedback, feedbackType, confidence });
  }, [exercise, state.reps]);

  const reset = useCallback(() => {
    setState({ reps: 0, phase: "neutral", angle: 0, feedback: "Get into position to start.", feedbackType: "info", confidence: 0 });
    prevPhaseRef.current = "neutral";
    repCountedRef.current = false;
  }, []);

  return { state, analyze, reset };
}
