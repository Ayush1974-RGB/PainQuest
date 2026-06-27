"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface Keypoint {
  x: number; y: number; score: number; name: string;
}

export interface PoseResult {
  keypoints: Keypoint[];
  score: number;
}

export type PoseStatus = "idle" | "loading" | "ready" | "error";

/** Angle (degrees) at joint B formed by points A–B–C */
export function calculateAngle(A: Keypoint, B: Keypoint, C: Keypoint): number {
  const radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
  let angle = Math.abs((radians * 180) / Math.PI);
  if (angle > 180) angle = 360 - angle;
  return angle;
}

export function usePoseDetection(videoRef: React.RefObject<HTMLVideoElement | null>, active: boolean) {
  const [status, setStatus] = useState<PoseStatus>("idle");
  const [pose, setPose] = useState<PoseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const detectorRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const loadModel = useCallback(async () => {
    if (detectorRef.current) return;
    setStatus("loading");
    try {
      const tf = await import("@tensorflow/tfjs");
      await import("@tensorflow/tfjs-backend-webgl");
      await tf.setBackend("webgl");
      await tf.ready();

      const poseDetection = await import("@tensorflow-models/pose-detection");
      detectorRef.current = await poseDetection.createDetector(
        poseDetection.SupportedModels.MoveNet,
        { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
      );
      setStatus("ready");
      setError(null);
    } catch (e: any) {
      setStatus("error");
      setError(e?.message ?? "Failed to load AI model");
    }
  }, []);

  const detect = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !detectorRef.current || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detect);
      return;
    }
    try {
      const poses = await detectorRef.current.estimatePoses(video);
      if (poses.length > 0) {
        const p = poses[0];
        setPose({
          score: p.score ?? 0,
          keypoints: p.keypoints.map((kp: any) => ({
            x: kp.x, y: kp.y,
            score: kp.score ?? 0,
            name: kp.name ?? "",
          })),
        });
        drawSkeleton(video, p.keypoints);
      }
    } catch { /* skip frame */ }
    rafRef.current = requestAnimationFrame(detect);
  }, [videoRef]);

  function drawSkeleton(video: HTMLVideoElement, keypoints: any[]) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width;
    const scaleY = canvas.height;

    // Connections
    const connections = [
      ["left_shoulder","left_elbow"],["left_elbow","left_wrist"],
      ["right_shoulder","right_elbow"],["right_elbow","right_wrist"],
      ["left_shoulder","right_shoulder"],
      ["left_shoulder","left_hip"],["right_shoulder","right_hip"],
      ["left_hip","right_hip"],
      ["left_hip","left_knee"],["left_knee","left_ankle"],
      ["right_hip","right_knee"],["right_knee","right_ankle"],
      ["nose","left_eye"],["nose","right_eye"],
      ["left_eye","left_ear"],["right_eye","right_ear"],
    ];

    const kpMap: Record<string, any> = {};
    keypoints.forEach(kp => { kpMap[kp.name] = kp; });

    // Draw bones
    ctx.strokeStyle = "rgba(0,229,255,0.8)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#00e5ff";
    ctx.shadowBlur = 8;
    connections.forEach(([a, b]) => {
      const kpA = kpMap[a]; const kpB = kpMap[b];
      if (!kpA || !kpB) return;
      if ((kpA.score ?? 0) < 0.3 || (kpB.score ?? 0) < 0.3) return;
      ctx.beginPath();
      ctx.moveTo(kpA.x, kpA.y);
      ctx.lineTo(kpB.x, kpB.y);
      ctx.stroke();
    });

    // Draw joints
    ctx.shadowBlur = 12;
    keypoints.forEach(kp => {
      if ((kp.score ?? 0) < 0.3) return;
      const isImportant = ["left_shoulder","right_shoulder","left_elbow","right_elbow",
        "left_wrist","right_wrist","left_hip","right_hip","left_knee","right_knee",
        "left_ankle","right_ankle"].includes(kp.name);
      ctx.fillStyle = isImportant ? "#00ff88" : "#00e5ff";
      ctx.shadowColor = isImportant ? "#00ff88" : "#00e5ff";
      ctx.beginPath();
      ctx.arc(kp.x, kp.y, isImportant ? 6 : 4, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  useEffect(() => {
    if (active) { loadModel(); }
  }, [active, loadModel]);

  useEffect(() => {
    if (status === "ready" && active) {
      rafRef.current = requestAnimationFrame(detect);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [status, active, detect]);

  return { status, pose, error, canvasRef };
}
