"use client";
import {
  Bar,
  BarChart,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { ChartTooltipCard, GREYS } from "./chart-tooltip";
import type { Series } from "./trend-chart";

type Row = Record<string, string | number>;

export function ChartLegend({ series }: { series: Required<Series>[] }) {
  return (
    <div className="flex flex-wrap gap-3 text-[11.5px] text-muted-foreground">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <i className="size-2 rounded-[2px]" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Thin rounded bars grouped per category, no y axis. Hovering a group shades
 * its column and shows the dark tooltip with square swatches.
 */
export function GroupedBars({
  data,
  xKey,
  series,
  formatTitle = (x) => x,
  height = 200,
}: {
  data: Row[];
  xKey: string;
  series: Series[];
  formatTitle?: (x: string) => string;
  height?: number;
}) {
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? GREYS[i] }));
  return (
    <div className="grid gap-3">
      <ChartLegend series={colored} />
      <div style={{ height }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            barSize={7}
            barGap={4}
            barCategoryGap="22%"
            margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey={xKey}
              tickLine={false}
              axisLine={false}
              fontSize={11}
              tick={{ fill: "#71717a" }}
              tickMargin={8}
            />
            <Tooltip
              isAnimationActive={false}
              cursor={<Rectangle fill="#f4f4f5" radius={10} />}
              content={({ active, label, payload }) =>
                active && payload?.length ? (
                  <ChartTooltipCard
                    title={formatTitle(String(label))}
                    swatch="square"
                    rows={[...colored]
                      .map((s) => ({
                        label: s.label,
                        color: s.color,
                        value: Number(
                          payload.find((p) => p.dataKey === s.key)?.value ?? 0,
                        ),
                      }))
                      .sort((a, b) => b.value - a.value)}
                  />
                ) : null
              }
            />
            {colored.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                radius={[4, 4, 4, 4]}
                isAnimationActive={false}
                // a zero still draws a short stub, like the reference.
                minPointSize={3}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
