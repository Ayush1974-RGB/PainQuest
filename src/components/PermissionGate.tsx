"use client";
import type { SensorPermissions } from "@/types";

export default function PermissionGate({ permissions, onRequest, error }: {
  permissions: SensorPermissions; onRequest: () => void; error: string | null;
}) {
  const isIdle = permissions.motion === "idle" && permissions.orientation === "idle";
  const isRequesting = permissions.motion === "requesting" || permissions.orientation === "requesting";

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center gap-6">
      <div className="relative animate-float">
        <div className="w-28 h-28 rounded-3xl bg-panel border border-border2 flex items-center justify-center text-5xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-cyan/10 to-accent-purple/10" />
          <span className="relative z-10">{isRequesting ? "⏳" : "📡"}</span>
        </div>
        {!isRequesting && (
          <div className="absolute -inset-2 rounded-3xl border border-accent-cyan/20 animate-pulse" />
        )}
      </div>

      <div className="space-y-2 max-w-xs">
        <h2 className="text-xl font-bold text-txt font-display">
          {isRequesting ? "Requesting Access…" : "Enable Motion Sensors"}
        </h2>
        <p className="text-sm text-txt-dim leading-relaxed">
          {isRequesting
            ? "Approve the permission prompt on your device to start streaming."
            : "PainQuest needs access to your gyroscope and accelerometer to stream live motion telemetry."}
        </p>
      </div>

      {error && (
        <div className="w-full max-w-xs bg-accent-red/10 border border-accent-red/30 rounded-xl px-4 py-3 text-sm text-accent-red text-left">
          <p className="font-semibold mb-1">⚠ Access Denied</p>
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {(isIdle || error) && (
        <button onClick={onRequest} disabled={isRequesting}
          className="relative px-8 py-3.5 rounded-xl font-bold text-sm tracking-wide bg-accent-cyan text-void hover:bg-white transition-all duration-150 active:scale-95 transform disabled:opacity-50 glow-cyan overflow-hidden group">
          <span className="relative z-10">{error ? "Try Again" : "Enable Sensors"}</span>
          <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
        </button>
      )}

      <div className="max-w-xs bg-panel border border-border rounded-xl p-4 text-left space-y-2">
        <p className="text-xs font-bold text-txt-dim uppercase tracking-widest">iOS Note</p>
        <p className="text-xs text-muted leading-relaxed">
          Tap <span className="text-txt font-semibold">Enable Sensors</span> then choose{" "}
          <span className="text-accent-cyan font-semibold">Allow</span> in the system dialog.
          Requires HTTPS — use the Cloudflare tunnel URL on iPhone.
        </p>
      </div>
    </div>
  );
}
