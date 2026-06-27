"use client";
import type { Vector3 } from "@/types";

const COLOR = {
  cyan:  { bar: "bg-accent-cyan",   text: "text-accent-cyan",   glow: "shadow-accent-cyan/20" },
  green: { bar: "bg-accent-green",  text: "text-accent-green",  glow: "shadow-accent-green/20" },
  amber: { bar: "bg-accent-amber",  text: "text-accent-amber",  glow: "shadow-accent-amber/20" },
};

function AxisRow({ label, value, unit, maxValue = 20, color }: {
  label: string; value: number | null; unit: string; maxValue?: number; color: keyof typeof COLOR;
}) {
  const c = COLOR[color];
  const pct = value !== null ? Math.min((Math.abs(value) / maxValue) * 100, 100) : 0;
  const formatted = value !== null ? (value >= 0 ? " " : "") + value.toFixed(3) : "——";
  return (
    <div className="flex items-center gap-3">
      <span className={`w-5 text-xs font-bold font-mono ${c.text} shrink-0`}>{label}</span>
      <div className="flex-1 h-1 bg-border2 rounded-full overflow-hidden">
        <div className={`h-full ${c.bar} rounded-full axis-bar-fill`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`w-28 text-right text-xs tabular-nums font-mono ${c.text} font-medium`}>
        {formatted} <span className="text-muted">{unit}</span>
      </span>
    </div>
  );
}

export function VectorPanel({ title, icon, data, unit, maxValue, color, subtitle }: {
  title: string; icon: string; data: Vector3; unit: string;
  maxValue?: number; color: keyof typeof COLOR; subtitle?: string;
}) {
  const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
  return (
    <div className="bg-panel border border-border2 rounded-2xl p-4 space-y-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-bl from-white/2 to-transparent pointer-events-none" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <div>
            <h3 className="text-xs font-bold tracking-widest text-txt-dim uppercase font-mono">{title}</h3>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted font-mono">magnitude</p>
          <p className={`text-sm font-bold font-mono tabular-nums ${COLOR[color].text}`}>
            {magnitude.toFixed(2)}
          </p>
        </div>
      </div>
      <div className="space-y-2.5">
        <AxisRow label="X" value={data.x} unit={unit} maxValue={maxValue} color={color} />
        <AxisRow label="Y" value={data.y} unit={unit} maxValue={maxValue} color={color} />
        <AxisRow label="Z" value={data.z} unit={unit} maxValue={maxValue} color={color} />
      </div>
    </div>
  );
}

export function OrientationPanel({ alpha, beta, gamma, absolute }: {
  alpha: number | null; beta: number | null; gamma: number | null; absolute: boolean;
}) {
  return (
    <div className="bg-panel border border-border2 rounded-2xl p-4 space-y-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-gradient-to-bl from-white/2 to-transparent pointer-events-none" />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧭</span>
          <h3 className="text-xs font-bold tracking-widest text-txt-dim uppercase font-mono">Orientation</h3>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border font-bold font-mono ${
          absolute ? "border-accent-green/30 text-accent-green bg-accent-green/10"
                   : "border-muted/30 text-muted"}`}>
          {absolute ? "ABSOLUTE" : "RELATIVE"}
        </span>
      </div>
      <div className="space-y-2.5">
        <AxisRow label="α" value={alpha} unit="°" maxValue={360} color="amber" />
        <AxisRow label="β" value={beta}  unit="°" maxValue={180} color="amber" />
        <AxisRow label="γ" value={gamma} unit="°" maxValue={90}  color="amber" />
      </div>
      <div className="grid grid-cols-3 text-center text-xs text-muted pt-1 font-mono">
        <span>YAW (Z)</span><span>PITCH (X)</span><span>ROLL (Y)</span>
      </div>
    </div>
  );
}
