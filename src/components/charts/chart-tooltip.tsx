"use client";
import { cn } from "@/lib/utils";

export type TooltipRow = {
  label: string;
  value: string | number;
  color: string;
};

/** Dark floating card shared by every chart: a title, a rule, then rows. */
export function ChartTooltipCard({
  title,
  rows,
  swatch = "dot",
  className,
}: {
  title: string;
  rows: TooltipRow[];
  swatch?: "dot" | "square";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-36 overflow-hidden rounded-xl border border-white/10 bg-[#111113] text-[12.5px] text-white shadow-xl",
        className,
      )}
    >
      <div className="border-b border-white/10 px-3 py-2 font-medium">
        {title}
      </div>
      <div className="grid gap-1.5 px-3 py-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <i
              className={cn(
                "size-2 shrink-0",
                swatch === "dot" ? "rounded-full" : "rounded-[2px]",
              )}
              style={{ background: r.color }}
            />
            <span className="text-white/70">{r.label}</span>
            <span className="ml-auto pl-4 font-medium tabular-nums">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Neutral greys used when a chart has no theme colour of its own. */
export const GREYS = ["#52525b", "#a1a1aa", "#d4d4d8", "#71717a", "#e4e4e7"];
