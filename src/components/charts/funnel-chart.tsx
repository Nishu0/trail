"use client";
import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export type FunnelStep = { label: string; value: number };

/**
 * Stepped funnel: one column per stage with the count on top, a percentage
 * pill in the middle and the label at the bottom. Each band slopes from its
 * own size to the next stage's, with a lighter halo around it. Hovering a
 * column brings it forward and dims the rest. Neutral greys, no theme colour.
 */
export function FunnelChart({
  steps,
  height = 224,
  format = (n) => n.toLocaleString("en-IN"),
}: {
  steps: FunnelStep[];
  height?: number;
  format?: (n: number) => string;
}) {
  const id = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const n = steps.length;
  const max = Math.max(1, ...steps.map((s) => s.value));
  const first = steps[0]?.value ?? 0;
  // inner band fills up to 73% of the height; a zero still shows a thin band.
  const half = (v: number) => Math.max(2.5, (v / max) * 36.5);
  const halo = (h: number) => h * 1.22 + 0.8;

  return (
    <div
      className="relative overflow-hidden rounded-lg bg-[#fafafa] select-none"
      style={{ height }}
      onMouseLeave={() => setHover(null)}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 size-full"
        viewBox={`0 0 ${n * 100} 100`}
        preserveAspectRatio="none"
      >
        <defs>
          {steps.map((_, i) => (
            <linearGradient
              key={i}
              id={`band-${id}-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={i * 100}
              x2={(i + 1) * 100}
              y1="0"
              y2="0"
            >
              <stop
                offset="0%"
                stopColor={hover === i ? "#a1a1aa" : "#d4d4d8"}
              />
              <stop
                offset="100%"
                stopColor={hover === i ? "#71717a" : "#b9b9c0"}
              />
            </linearGradient>
          ))}
        </defs>
        {steps.map((s, i) => {
          const x0 = i * 100;
          const x1 = x0 + 100;
          const l = half(s.value);
          const r = half(steps[i + 1]?.value ?? s.value);
          const dim = hover !== null && hover !== i;
          return (
            <g
              key={s.label}
              style={{ opacity: dim ? 0.55 : 1, transition: "opacity 150ms" }}
            >
              <polygon
                points={`${x0},${50 - halo(l)} ${x1},${50 - halo(r)} ${x1},${50 + halo(r)} ${x0},${50 + halo(l)}`}
                fill="#ececee"
              />
              <polygon
                points={`${x0},${50 - l} ${x1},${50 - r} ${x1},${50 + r} ${x0},${50 + l}`}
                fill={`url(#band-${id}-${i})`}
              />
            </g>
          );
        })}
      </svg>
      <div
        className="relative grid h-full"
        style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
      >
        {steps.map((s, i) => {
          const pct = first ? Math.round((s.value / first) * 100) : 0;
          const on = hover === i;
          const dim = hover !== null && !on;
          return (
            <div
              key={s.label}
              onMouseEnter={() => setHover(i)}
              className={cn(
                "flex flex-col items-center justify-between py-3.5 transition-opacity",
                i > 0 && "border-l border-[#e7e7e9]",
              )}
            >
              <span
                className={cn(
                  "text-[17px] font-semibold tabular-nums tracking-tight",
                  dim && "text-muted-foreground",
                )}
              >
                {format(s.value)}
              </span>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[12px] font-semibold tabular-nums transition-colors",
                  dim
                    ? "bg-[#e4e4e7] text-muted-foreground"
                    : "bg-white text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12)]",
                )}
              >
                {pct}%
              </span>
              <span
                className={cn(
                  "text-[12.5px] text-muted-foreground",
                  on && "text-foreground",
                )}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
