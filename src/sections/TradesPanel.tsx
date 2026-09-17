import type { Trade } from "@/hooks/useMarketDetail";

function fmtTime(t: number): string {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

/** 最新成交流（Yes 侧） */
export default function TradesPanel({ trades }: { trades: Trade[] }) {
  if (trades.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        等待成交数据…
      </div>
    );
  }
  return (
    <div>
      <div className="flex justify-between border-b border-border px-2 py-1 text-xs text-muted-foreground">
        <span>价格</span>
        <span>数量</span>
        <span>时间</span>
      </div>
      <div className="max-h-72 overflow-y-auto py-1">
        {trades.map((t, i) => (
          <div
            key={`${t.time}-${i}`}
            className="flex justify-between px-2 py-0.5 text-xs tabular-nums"
          >
            <span className={t.side === "B" ? "text-emerald-400" : "text-rose-400"}>
              {(t.px * 100).toFixed(1)}¢
            </span>
            <span className="text-muted-foreground">{t.sz.toFixed(1)}</span>
            <span className="text-muted-foreground">{fmtTime(t.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
