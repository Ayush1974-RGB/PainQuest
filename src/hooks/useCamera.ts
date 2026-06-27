"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export type CameraStatus = "idle" | "requesting" | "active" | "error";

export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setStatus("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("active");
      setError(null);
    } catch (e: any) {
      setStatus("error");
      setError(e?.message?.includes("Permission")
        ? "Camera permission denied. Allow camera access and try again."
        : `Camera error: ${e?.message ?? "Unknown"}`);
    }
  }, [videoRef]);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
  }, [videoRef]);

  useEffect(() => () => { stop(); }, [stop]);

  return { status, error, start, stop };
}
