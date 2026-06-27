"use client";
import type { Vector3 } from "@/types";

type Color = "yellow" | "white" | "grey";

const COLOR: Record<Color, { bar: string; text: string; label: string }> = {
  yellow: { bar: "bg-yellow", text: "text-yellow", label: "text-yellow/70" },
  white:  { bar: "bg-wht",    text: "text-wht",    label: "text-grey"      },
  grey:   { bar: "bg-grey",   text: "text-grey",   label: "text-grey2"     },
};

function AxisRow({
  label, value, unit, maxValue = 20, color,
}: {
  label: string; value: number | null; unit: string; maxValue?: number; color: Color;
}) {
  const c    = COLOR[color];
  const pct  = value !== null ? Math.min((Math.abs(value) / maxValue) * 100, 100) : 0;
  const sign = value !== null && value >= 0 ? "+" : "";
  const disp = value !== null ? `${sign}${value.toFixed(3)}` : "——";

  return (
    <div className="flex items-center gap-3 py-1">
      <span className={`w-4 font-mono text-xs font-bold shrink-0 ${c.label}`}>
        {label}
      </span>
      <div className="flex-1 h-0.5 bg-line rounded-full overflow-hidden">
        <div
          className={`h-full ${c.bar} rounded-full axis-bar-fill`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`w-28 text-right font-mono text-xs tabular-nums shrink-0 ${c.text}`}>
        {disp} <span className="text-grey2">{unit}</span>
      </span>
    </div>
  );
}

export function VectorPanel({
  title, data, unit, maxValue, color, tag,
}: {
  title: string; data: Vector3; unit: string;
  maxValue?: number; color: Color; tag: string;
}) {
  const mag = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
  return (
    <div className="bg-card border border-line rounded-xl p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-mono text-xs text-grey2 uppercase tracking-widest">{tag}</p>
          <p className="font-heading text-xl text-wht tracking-wide mt-0.5">{title}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-xs text-grey2">magnitude</p>
          <p className={`font-mono text-sm font-semibold tabular-nums ${COLOR[color].text}`}>
            {mag.toFixed(2)}{" "}
            <span className="text-grey2 text-xs">{unit}</span>
          </p>
        </div>
      </div>
      <div className="space-y-0.5">
        <AxisRow label="X" value={data.x} unit={unit} maxValue={maxValue} color={color} />
        <AxisRow label="Y" value={data.y} unit={unit} maxValue={maxValue} color={color} />
        <AxisRow label="Z" value={data.z} unit={unit} maxValue={maxValue} color={color} />
      </div>
    </div>
  );
}

export function OrientationPanel({
  alpha, beta, gamma, absolute,
}: {
  alpha: number | null; beta: number | null;
  gamma: number | null; absolute: boolean;
}) {
  return (
    <div className="bg-card border border-line rounded-xl p-4">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-mono text-xs text-grey2 uppercase tracking-widest">sensor 03</p>
          <p className="font-heading text-xl text-wht tracking-wide mt-0.5">Orientation</p>
        </div>
        <span
          className={`font-mono text-xs px-2 py-1 rounded border ${
            absolute
              ? "border-success/40 text-success bg-success/5"
              : "border-line2 text-grey2"
          }`}
        >
          {absolute ? "ABSOLUTE" : "RELATIVE"}
        </span>
      </div>
      <div className="space-y-0.5">
        <AxisRow label="α" value={alpha} unit="°" maxValue={360} color="yellow" />
        <AxisRow label="β" value={beta}  unit="°" maxValue={180} color="yellow" />
        <AxisRow label="γ" value={gamma} unit="°" maxValue={90}  color="yellow" />
      </div>
      <div className="mt-3 pt-3 border-t border-line grid grid-cols-3 text-center">
        <span className="font-mono text-xs text-grey2">YAW</span>
        <span className="font-mono text-xs text-grey2">PITCH</span>
        <span className="font-mono text-xs text-grey2">ROLL</span>
      </div>
    </div>
  );
}