"use client";

import { RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

export function RadialGaugeChart({
  label,
  value,
  color = "var(--chart-1)",
}: {
  label: string;
  /** 0-100 */
  value: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const data = [{ name: label, value: clamped, fill: color }];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <ResponsiveContainer width={140} height={140}>
          <RadialBarChart
            data={data}
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            barSize={10}
          >
            <defs>
              <filter id={`gaugeGlow-${label}`} x="-60%" y="-60%" width="220%" height="220%">
                <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor={color} floodOpacity="0.6" />
              </filter>
            </defs>
            <RadialBar
              dataKey="value"
              cornerRadius={999}
              background={{ fill: "var(--muted)" }}
              filter={`url(#gaugeGlow-${label})`}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold tabular-nums">{clamped.toFixed(0)}%</span>
        </div>
      </div>
      <span className="text-center text-xs font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
