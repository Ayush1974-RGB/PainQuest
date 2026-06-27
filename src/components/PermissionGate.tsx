"use client";
import type { SensorPermissions } from "@/types";

export default function PermissionGate({
  permissions, onRequest, error,
}: {
  permissions: SensorPermissions; onRequest: () => void; error: string | null;
}) {
  const isRequesting =
    permissions.motion === "requesting" ||
    permissions.orientation === "requesting";
  const isIdle = permissions.motion === "idle";

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-6 text-center gap-6">
      {/* Icon */}
      <div className="relative">
        <div className="w-24 h-24 bg-card border border-line2 rounded-2xl flex items-center justify-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke={isRequesting ? "#f5c400" : "#555"}
            strokeWidth="1.5"
          >
            <path d="M12 22V12m0 0V2m0 10H2m10 0h10" />
            <circle
              cx="12"
              cy="12"
              r="3"
              fill={isRequesting ? "#f5c400" : "none"}
              strokeWidth="1.5"
            />
          </svg>
        </div>
        {isRequesting && (
          <div className="absolute -inset-2 border border-yellow/30 rounded-2xl animate-pulse" />
        )}
      </div>

      <div className="space-y-2 max-w-xs">
        <h2 className="font-heading text-3xl text-wht tracking-wide">
          {isRequesting ? "ALLOW ACCESS" : "SENSOR ACCESS"}
        </h2>
        <p className="text-grey text-sm leading-relaxed">
          {isRequesting
            ? "Tap Allow in the system prompt to start streaming motion data."
            : "PainQuest needs your gyroscope and accelerometer to track movement."}
        </p>
      </div>

      {error && (
        <div className="w-full max-w-xs bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 text-left">
          <p className="text-danger text-xs font-semibold mb-1 font-mono">
            ACCESS DENIED
          </p>
          <p className="text-danger/80 text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {(isIdle || error) && (
        <button
          onClick={onRequest}
          disabled={isRequesting}
          className="btn-yellow w-full max-w-xs py-4 rounded-xl font-heading text-2xl tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {error ? "TRY AGAIN" : "ENABLE SENSORS"}
        </button>
      )}

      <div className="max-w-xs bg-card border border-line rounded-xl p-4 text-left">
        <p className="font-mono text-xs text-grey2 uppercase tracking-widest mb-2">
          iOS users
        </p>
        <p className="text-grey text-xs leading-relaxed">
          Tap{" "}
          <span className="text-wht font-semibold">Enable Sensors</span> then
          choose{" "}
          <span className="text-yellow font-semibold">Allow</span> in the
          system dialog. Requires HTTPS — use your Cloudflare tunnel URL on
          iPhone.
        </p>
      </div>
    </div>
  );
}