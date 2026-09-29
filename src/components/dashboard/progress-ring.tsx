"use client";

import { RadialBar, RadialBarChart, PolarAngleAxis } from "recharts";

export function ProgressRing({ percent, label }: { percent: number; label: string }) {
  const data = [{ value: Math.min(100, Math.max(0, percent)) }];

  return (
    <div className="relative flex items-center justify-center">
      <RadialBarChart
        width={160}
        height={160}
        cx="50%"
        cy="50%"
        innerRadius={58}
        outerRadius={78}
        barSize={14}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
        <RadialBar
          background={{ fill: "var(--muted)" }}
          dataKey="value"
          cornerRadius={999}
          fill="var(--primary)"
        />
      </RadialBarChart>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-semibold tabular-nums">{Math.round(percent)}%</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
