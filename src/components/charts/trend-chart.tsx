"use client";
import { useId, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltipCard, GREYS } from "./chart-tooltip";

type Row = Record<string, string | number>;
export type Series = { key: string; label: string; color?: string };

/**
 * Area chart in the efferd style: straight lines, a fill that fades down and
 * toward both edges, dashed grid, and on hover a cursor line, a haloed dot,
 * a dark tooltip and the hovered date as a pill on the x axis.
 */
export function TrendChart({
  data,
  xKey,
  series,
  formatTick,
  formatTitle,
  formatValue = (v) => String(v),
  height = 220,
}: {
  data: Row[];
  xKey: string;
  series: Series[];
  formatTick: (x: string) => string;
  formatTitle: (x: string) => string;
  formatValue?: (v: number) => string;
  height?: number;
}) {
  const id = useId().replace(/:/g, "");
  const [active, setActive] = useState<number | null>(null);
  const index = useMemo(
    () => new Map(data.map((d, i) => [String(d[xKey]), i])),
    [data, xKey],
  );
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? GREYS[i] }));
  const activeX = active === null ? null : String(data[active]?.[xKey]);
  // ticks this close to the hovered point hide so the pill has room.
  const gap = Math.max(2, Math.round(data.length / 12));

  return (
    <div className="trend-chart w-full" style={{ height }}>
      <style>{`.trend-chart-${id} .recharts-area-area { mask: url(#fade-${id}); }`}</style>
      <ResponsiveContainer className={`trend-chart-${id}`}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 6, left: -12 }}
          onMouseMove={(s) =>
            setActive(
              s.activeTooltipIndex === undefined ||
                s.activeTooltipIndex === null
                ? null
                : Number(s.activeTooltipIndex),
            )
          }
          onMouseLeave={() => setActive(null)}
          style={{ overflow: "visible" }}
        >
          <defs>
            <linearGradient id={`fade-h-${id}`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity={0} />
              <stop offset="12%" stopColor="white" stopOpacity={1} />
              <stop offset="88%" stopColor="white" stopOpacity={1} />
              <stop offset="100%" stopColor="white" stopOpacity={0} />
            </linearGradient>
            <mask id={`fade-${id}`} maskContentUnits="objectBoundingBox">
              <rect width="1" height="1" fill={`url(#fade-h-${id})`} />
            </mask>
            {colored.map((s) => (
              <linearGradient
                key={s.key}
                id={`fill-${id}-${s.key}`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            vertical={false}
            strokeDasharray="4 4"
            stroke="#e4e4e7"
          />
          <XAxis
            dataKey={xKey}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={36}
            height={30}
            tick={(p: {
              x?: number | string;
              y?: number | string;
              payload?: { value?: unknown };
            }) => {
              const x = Number(p.x);
              const y = Number(p.y);
              const value = String(p.payload?.value ?? "");
              const i = index.get(value) ?? -1;
              if (active !== null && Math.abs(i - active) <= gap) return <g />;
              return (
                <text
                  x={x}
                  y={y + 12}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#71717a"
                >
                  {formatTick(value)}
                </text>
              );
            }}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            fontSize={11}
            width={34}
            tick={{ fill: "#71717a" }}
          />
          <Tooltip
            cursor={false}
            isAnimationActive={false}
            offset={16}
            content={({ active: on, label, payload }) =>
              on && payload?.length ? (
                <ChartTooltipCard
                  title={formatTitle(String(label))}
                  rows={colored.map((s) => ({
                    label: s.label,
                    color: s.color,
                    value: formatValue(
                      Number(
                        payload.find((p) => p.dataKey === s.key)?.value ?? 0,
                      ),
                    ),
                  }))}
                />
              ) : null
            }
          />
          {activeX !== null && (
            <ReferenceLine
              x={activeX}
              stroke="#a1a1aa"
              strokeWidth={1}
              label={({
                viewBox,
              }: {
                viewBox?: { x: number; y: number; height: number };
              }) => {
                if (!viewBox) return <g />;
                const text = formatTick(activeX);
                const w = text.length * 6.6 + 18;
                const y = viewBox.y + viewBox.height + 4;
                return (
                  <g>
                    <rect
                      x={viewBox.x - w / 2}
                      y={y}
                      width={w}
                      height={22}
                      rx={11}
                      fill="#18181b"
                    />
                    <text
                      x={viewBox.x}
                      y={y + 15}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={500}
                      fill="#fff"
                    >
                      {text}
                    </text>
                  </g>
                );
              }}
            />
          )}
          {colored.map((s) => (
            <Area
              key={s.key}
              dataKey={s.key}
              type="linear"
              stroke={s.color}
              strokeWidth={1.5}
              fill={`url(#fill-${id}-${s.key})`}
              isAnimationActive={false}
              activeDot={(p: { cx?: number; cy?: number }) => (
                <g>
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r={10}
                    fill={s.color}
                    fillOpacity={0.14}
                  />
                  <circle
                    cx={p.cx}
                    cy={p.cy}
                    r={3.5}
                    fill={s.color}
                    stroke="#fff"
                    strokeWidth={1.5}
                  />
                </g>
              )}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
