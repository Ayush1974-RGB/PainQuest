"use client";

import { useRef, useState, useCallback } from "react";
import type { PoseResult, Keypoint } from "./usePoseDetection";
import { calculateAngle } from "./usePoseDetection";

export type ExerciseType =
  | "bicep_curl"
  | "squat"
  | "pushup"
  | "jumping_jack"
  | "shoulder_press";

export interface ExerciseState {
  reps: number;
  phase: "up" | "down" | "neutral";
  angle: number;
  feedback: string;
  feedbackType: "good" | "warn" | "info";
  confidence: number;
  formErrors: string[]; // ← NEW: specific form mistakes detected
}

const THRESHOLDS: Record
  ExerciseType,
  { down: number; up: number; countOn: "up" | "down" }
> = {
  bicep_curl:     { down: 150, up: 60,  countOn: "up"   },
  squat:          { down: 100, up: 160, countOn: "up"   },
  pushup:         { down: 80,  up: 150, countOn: "up"   },
  shoulder_press: { down: 160, up: 80,  countOn: "down" },
  jumping_jack:   { down: 70,  up: 20,  countOn: "down" },
};

const FEEDBACK: Record<ExerciseType, { up: string; down: string; mid: string }> = {
  bicep_curl:     { up: "Great curl! Lower slowly.",       down: "Full extension — curl up!",        mid: "Keep curling upward."           },
  squat:          { up: "Stand tall — now squat deep.",    down: "Great depth! Drive through heels.", mid: "Go lower for full range."       },
  pushup:         { up: "Arms locked — lower your chest.", down: "Chest down! Push back up.",         mid: "Keep body straight, core tight." },
  shoulder_press: { up: "Fully extended overhead!",        down: "Press explosively upward.",         mid: "Drive all the way up."          },
  jumping_jack:   { up: "Arms wide! Now bring them down.", down: "Jump out — spread arms wide.",      mid: "Full arm extension outward."    },
};

// ─── Form error detection ─────────────────────────────────────────────────────
// Returns a list of form mistakes detected in the current frame.

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
      const rSh = kp("right_shoulder"); const lSh = kp("left_shoulder");
      const rEl = kp("right_elbow");   const lEl = kp("left_elbow");
      const rWr = kp("right_wrist");   const lWr = kp("left_wrist");

      // Elbow should not drift forward (elbow x should stay near shoulder x)
      if (rSh && rEl) {
        const drift = Math.abs(rEl.x - rSh.x);
        const refWidth = Math.abs((kp("left_shoulder")?.x ?? rSh.x) - rSh.x) || 100;
        if (drift > refWidth * 0.35) errors.push("Elbow drifting — keep it pinned to your side");
      }
      if (lSh && lEl) {
        const drift = Math.abs(lEl.x - lSh.x);
        const refWidth = Math.abs((kp("right_shoulder")?.x ?? lSh.x) - lSh.x) || 100;
        if (drift > refWidth * 0.35) errors.push("Left elbow drifting — keep it pinned");
      }
      // Check full extension at bottom
      if (phase === "down") {
        if (rSh && rEl && rWr) {
          const angle = calculateAngle(rSh, rEl, rWr);
          if (angle < 140) errors.push("Not fully extending at the bottom — lower all the way");
        }
      }
      break;
    }

    case "squat": {
      const lHip  = kp("left_hip");   const rHip  = kp("right_hip");
      const lKnee = kp("left_knee");  const rKnee = kp("right_knee");
      const lAnk  = kp("left_ankle"); const rAnk  = kp("right_ankle");
      const lSh   = kp("left_shoulder"); const rSh = kp("right_shoulder");

      // Knees caving inward (knee x closer to center than ankle x)
      if (lKnee && lAnk && rKnee && rAnk) {
        const kneeWidth = Math.abs(lKnee.x - rKnee.x);
        const ankleWidth = Math.abs(lAnk.x - rAnk.x);
        if (phase === "down" && kneeWidth < ankleWidth * 0.75)
          errors.push("Knees caving in — push knees out over toes");
      }
      // Not deep enough (knee angle > 115 at bottom)
      if (phase === "down" && lHip && lKnee && lAnk) {
        const angle = calculateAngle(lHip, lKnee, lAnk);
        if (angle > 115) errors.push("Not deep enough — try to break parallel");
      }
      // Forward lean (shoulders ahead of hips)
      if (lSh && lHip && phase === "down") {
        if (lSh.x > lHip.x + 30) errors.push("Leaning too far forward — keep chest up");
      }
      break;
    }

    case "pushup": {
      const lSh  = kp("left_shoulder");  const rSh  = kp("right_shoulder");
      const lHip = kp("left_hip");       const rHip = kp("right_hip");
      const lAnk = kp("left_ankle");     const rAnk = kp("right_ankle");
      const lEl  = kp("left_elbow");     const rEl  = kp("right_elbow");
      const lWr  = kp("left_wrist");     const rWr  = kp("right_wrist");

      // Hips sagging (hip y higher than shoulder y and ankle y — body not straight)
      if (lSh && lHip && lAnk) {
        const bodyLine = lSh.y + (lAnk.y - lSh.y) * 0.5;
        if (lHip.y > bodyLine + 30) errors.push("Hips sagging — engage your core and keep body straight");
      }
      // Hips piking up
      if (lSh && lHip && lAnk) {
        const bodyLine = lSh.y + (lAnk.y - lSh.y) * 0.5;
        if (lHip.y < bodyLine - 40) errors.push("Hips too high — lower them to form a straight line");
      }
      // Not reaching full depth
      if (phase === "down" && rSh && rEl && rWr) {
        const angle = calculateAngle(rSh, rEl, rWr);
        if (angle > 100) errors.push("Not going low enough — chest should nearly touch the ground");
      }
      break;
    }

    case "shoulder_press": {
      const lSh = kp("left_shoulder"); const rSh = kp("right_shoulder");
      const lEl = kp("left_elbow");   const rEl = kp("right_elbow");
      const lWr = kp("left_wrist");   const rWr = kp("right_wrist");

      // Elbows flaring too wide (elbow x much further than wrist x at start)
      if (rSh && rEl && rWr) {
        if (phase === "down" && rEl.x > rWr.x + 40)
          errors.push("Elbows flaring out — keep them at 45° to your body");
      }
      // Not locking out at top
      if (phase === "up" && rSh && rEl && rWr) {
        const angle = calculateAngle(rSh, rEl, rWr);
        if (angle < 155) errors.push("Not locking out — fully extend arms overhead");
      }
      // Wrists not stacked over elbows
      if (rEl && rWr && phase === "down") {
        if (Math.abs(rWr.x - rEl.x) > 40)
          errors.push("Wrists not stacked over elbows — straighten your wrist");
      }
      break;
    }

    case "jumping_jack": {
      const lWr = kp("left_wrist");  const rWr = kp("right_wrist");
      const lSh = kp("left_shoulder"); const rSh = kp("right_shoulder");
      const lAnk = kp("left_ankle"); const rAnk = kp("right_ankle");
      const lHip = kp("left_hip");   const rHip = kp("right_hip");

      // Arms not reaching high enough on up phase
      if (phase === "up" && lWr && rWr && lSh && rSh) {
        if (lWr.y > lSh.y + 20) errors.push("Arms not high enough — raise them fully overhead");
        if (rWr.y > rSh.y + 20) errors.push("Right arm not high enough — raise fully overhead");
      }
      // Legs not spreading wide enough
      if (phase === "up" && lAnk && rAnk && lHip && rHip) {
        const hipWidth  = Math.abs(lHip.x - rHip.x);
        const ankleWidth = Math.abs(lAnk.x - rAnk.x);
        if (ankleWidth < hipWidth * 1.2)
          errors.push("Legs not spreading wide enough — jump feet further apart");
      }
      break;
    }
  }

  return errors;
}

// ─── Keypoint + angle helpers ─────────────────────────────────────────────────

function getKP(pose: PoseResult, name: string): Keypoint | undefined {
  return pose.keypoints.find(k => k.name === name && (k.score ?? 0) > 0.25);
}

function getAngle(
  pose: PoseResult,
  exercise: ExerciseType
): { angle: number; confidence: number } {
  const tryLeft = (a: string, b: string, c: string) => {
    const A = getKP(pose, `left_${a}`);
    const B = getKP(pose, `left_${b}`);
    const C = getKP(pose, `left_${c}`);
    if (A && B && C)
      return {
        angle: calculateAngle(A, B, C),
        confidence: Math.min(A.score, B.score, C.score),
      };
    return null;
  };
  const tryRight = (a: string, b: string, c: string) => {
    const A = getKP(pose, `right_${a}`);
    const B = getKP(pose, `right_${b}`);
    const C = getKP(pose, `right_${c}`);
    if (A && B && C)
      return {
        angle: calculateAngle(A, B, C),
        confidence: Math.min(A.score, B.score, C.score),
      };
    return null;
  };

  switch (exercise) {
    case "bicep_curl":
    case "pushup":
    case "shoulder_press": {
      const r = tryRight("shoulder", "elbow", "wrist");
      const l = tryLeft("shoulder", "elbow", "wrist");
      if (r && l) return r.confidence >= l.confidence ? r : l;
      return r ?? l ?? { angle: 0, confidence: 0 };
    }
    case "squat": {
      const r = tryRight("hip", "knee", "ankle");
      const l = tryLeft("hip", "knee", "ankle");
      if (r && l) return r.confidence >= l.confidence ? r : l;
      return r ?? l ?? { angle: 0, confidence: 0 };
    }
    case "jumping_jack": {
      const lSh = getKP(pose, "left_shoulder");
      const rSh = getKP(pose, "right_shoulder");
      const lWr = getKP(pose, "left_wrist");
      const rWr = getKP(pose, "right_wrist");
      if (lSh && rSh && lWr && rWr) {
        const shoulderWidth = Math.abs(lSh.x - rSh.x) || 1;
        const wristSpread = Math.abs(lWr.x - rWr.x);
        const ratio = Math.min(wristSpread / shoulderWidth, 2);
        const angle = (ratio / 2) * 90;
        const conf = Math.min(lSh.score, rSh.score, lWr.score, rWr.score);
        return { angle, confidence: conf };
      }
      return { angle: 0, confidence: 0 };
    }
    default:
      return { angle: 0, confidence: 0 };
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useExerciseAnalyzer(exercise: ExerciseType) {
  const repsRef        = useRef(0);
  const phaseRef       = useRef<"up" | "down" | "neutral">("neutral");
  const hasBeenDownRef = useRef(false);
  const lastRepTime    = useRef(0);

  const [state, setState] = useState<ExerciseState>({
    reps: 0, phase: "neutral", angle: 0,
    feedback: "Get into position to start.",
    feedbackType: "info", confidence: 0,
    formErrors: [],
  });

  const analyze = useCallback(
    (pose: PoseResult) => {
      const { angle, confidence } = getAngle(pose, exercise);
      const thresh = THRESHOLDS[exercise];
      const fb = FEEDBACK[exercise];

      if (confidence < 0.25) {
        setState(s => ({
          ...s, confidence,
          feedback: "Move into frame — can't see you clearly.",
          feedbackType: "warn", formErrors: [],
        }));
        return;
      }

      // Phase detection
      let phase: "up" | "down" | "neutral";
      if (exercise === "jumping_jack" || exercise === "shoulder_press") {
        phase =
          angle >= thresh.down ? "up" :
          angle <= thresh.up   ? "down" : "neutral";
      } else {
        phase =
          angle <= thresh.up   ? "up" :
          angle >= thresh.down ? "down" : "neutral";
      }

      // Rep counting state machine with debounce
      const loadPhase    = thresh.countOn === "up" ? "down" : "up";
      const triggerPhase = thresh.countOn;
      if (phase === loadPhase) hasBeenDownRef.current = true;
      if (phase === triggerPhase && hasBeenDownRef.current) {
        const now = Date.now();
        if (now - lastRepTime.current > 500) {
          repsRef.current += 1;
          hasBeenDownRef.current = false;
          lastRepTime.current = now;
        }
      }
      phaseRef.current = phase;

      // Form error detection — only on active movement phases
      const formErrors =
        phase !== "neutral" ? detectFormErrors(pose, exercise, phase) : [];

      const feedback =
        phase === "up"   ? fb.up :
        phase === "down" ? fb.down : fb.mid;
      const feedbackType =
        formErrors.length > 0 ? "warn" :
        phase === "up" || phase === "down" ? "good" : "info";

      setState({
        reps: repsRef.current,
        phase,
        angle: Math.round(angle),
        feedback: formErrors.length > 0 ? formErrors[0] : feedback,
        feedbackType,
        confidence,
        formErrors,
      });
    },
    [exercise]
  );

  const reset = useCallback(() => {
    repsRef.current = 0;
    phaseRef.current = "neutral";
    hasBeenDownRef.current = false;
    lastRepTime.current = 0;
    setState({
      reps: 0, phase: "neutral", angle: 0,
      feedback: "Get into position to start.",
      feedbackType: "info", confidence: 0, formErrors: [],
    });
  }, []);

  return { state, analyze, reset };
}