"use client";
import type { ConnectionStatus } from "@/hooks/useSocketStream";

const CONFIG: Record<ConnectionStatus, { label: string; dot: string; text: string; bg: string }> = {
  connected:    { label: "LIVE",       dot: "bg-accent-green animate-pulse", text: "text-accent-green", bg: "bg-accent-green/10 border-accent-green/30" },
  connecting:   { label: "CONNECTING", dot: "bg-accent-amber animate-pulse", text: "text-accent-amber", bg: "bg-accent-amber/10 border-accent-amber/30" },
  disconnected: { label: "OFFLINE",    dot: "bg-muted",                      text: "text-muted",        bg: "bg-muted/10 border-muted/30" },
  error:        { label: "ERROR",      dot: "bg-accent-red animate-pulse",   text: "text-accent-red",   bg: "bg-accent-red/10 border-accent-red/30" },
};

export default function StatusBadge({ status }: { status: ConnectionStatus }) {
  const { label, dot, text, bg } = CONFIG[status];
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      <span className={`text-xs font-bold tracking-widest font-mono ${text}`}>{label}</span>
    </div>
  );
}
