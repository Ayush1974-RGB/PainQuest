"use client";

interface DeviceCardProps {
  deviceId: string;
  fps: number;
}

export default function DeviceCard({ deviceId, fps }: DeviceCardProps) {
  const short = deviceId === "ssr-placeholder" ? "——" : deviceId.slice(0, 8);
  const full = deviceId === "ssr-placeholder" ? "Loading…" : deviceId;

  return (
    <div className="bg-panel border border-border rounded-xl p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-muted uppercase tracking-widest mb-1">
            Device ID
          </p>
          <p className="text-accent-cyan font-semibold text-sm break-all leading-relaxed">
            <span className="opacity-100">{short}</span>
            <span className="text-muted">
              {full.length > 8 ? full.slice(8) : ""}
            </span>
          </p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs text-muted uppercase tracking-widest mb-1">
            Stream
          </p>
          <p className="text-accent-green font-semibold tabular-nums">
            {fps}
            <span className="text-muted text-xs font-normal"> fps</span>
          </p>
        </div>
      </div>
    </div>
  );
}
