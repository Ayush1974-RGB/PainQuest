"use client";

import type { ConnectionStatus } from "@/hooks/useSocketStream";

const CONFIG: Record<
  ConnectionStatus,
  { label: string; dot: string; text: string }
> = {
  connected: {
    label: "CONNECTED",
    dot: "bg-success live-dot",
    text: "text-success",
  },
  connecting: {
    label: "CONNECTING",
    dot: "bg-yellow pulse-dot",
    text: "text-yellow",
  },
  disconnected: {
    label: "OFFLINE",
    dot: "bg-grey2",
    text: "text-grey",
  },
  error: {
    label: "ERROR",
    dot: "bg-danger live-dot",
    text: "text-danger",
  },
};

export default function StatusBadge({
  status,
}: {
  status: ConnectionStatus;
}) {
  const { label, dot, text } = CONFIG[status];

  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
      <span
        className={`font-mono text-xs font-semibold tracking-widest ${text}`}
      >
        {label}
      </span>
    </div>
  );
}