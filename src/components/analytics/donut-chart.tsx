"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

export interface DonutPoint {
  label: string;
  value: number;
}

export function DonutChart({ data }: { data: DonutPoint[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0">
        <ResponsiveContainer width={180} height={180}>
          <PieChart>
            <defs>
              {data.map((entry, index) => (
                <filter key={entry.label} id={`donutGlow-${index}`} x="-40%" y="-40%" width="180%" height="180%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor={COLORS[index % COLORS.length]} floodOpacity="0.55" />
                </filter>
              ))}
            </defs>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={3}
              stroke="var(--card)"
              strokeWidth={2}
            >
              {data.map((entry, index) => (
                <Cell
                  key={entry.label}
                  fill={COLORS[index % COLORS.length]}
                  filter={`url(#donutGlow-${index})`}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
                color: "var(--popover-foreground)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{total}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">total</span>
        </div>
      </div>
      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {data.map((entry, index) => {
          const pct = total ? Math.round((entry.value / total) * 100) : 0;
          return (
            <li key={entry.label} className="flex items-center gap-2 text-sm">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: COLORS[index % COLORS.length] }}
              />
              <span className="min-w-0 flex-1 truncate capitalize text-foreground">{entry.label.replace(/_/g, " ")}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {entry.value} · {pct}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
