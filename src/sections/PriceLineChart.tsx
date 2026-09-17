import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { PricePoint } from "@/hooks/useMarketDetail";

interface PriceLineChartProps {
  points: PricePoint[];
  /** 当前中间价，用于画参考线 */
  currentMid?: number | null;
}

function fmtTime(t: number): string {
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Polymarket 风格的概率走势线状图（0~100%） */
export default function PriceLineChart({
  points,
  currentMid,
}: PriceLineChartProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        暂无历史价格数据
      </div>
    );
  }

  const data = points.map((p) => ({ t: p.t, pct: p.p * 100 }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <XAxis
            dataKey="t"
            tickFormatter={fmtTime}
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            opacity={0.4}
            minTickGap={60}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            opacity={0.4}
          />
          <Tooltip
            formatter={(value) => [`${Number(value).toFixed(1)}%`, "Yes 概率"]}
            labelFormatter={(label) => fmtTime(Number(label))}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          {currentMid !== null && currentMid !== undefined && (
            <ReferenceLine
              y={currentMid * 100}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 4"
              opacity={0.5}
            />
          )}
          <Line
            type="monotone"
            dataKey="pct"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
