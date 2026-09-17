import type { SideBook } from "@/hooks/useMarketDetail";

interface OrderbookPanelProps {
  book: SideBook | null;
  sideName: string;
}

/** 盘口深度：卖单倒序在上，买单在下，带深度条 */
export default function OrderbookPanel({ book, sideName }: OrderbookPanelProps) {
  if (!book || (book.bids.length === 0 && book.asks.length === 0)) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        等待盘口数据…
      </div>
    );
  }

  const maxSz = Math.max(
    ...book.bids.map((b) => b.sz),
    ...book.asks.map((a) => a.sz),
    1,
  );
  const asks = [...book.asks].slice(0, 8).reverse();
  const bids = book.bids.slice(0, 8);

  const Row = ({
    px,
    sz,
    type,
  }: {
    px: number;
    sz: number;
    type: "bid" | "ask";
  }) => (
    <div className="relative flex justify-between px-2 py-0.5 text-xs tabular-nums">
      <div
        className={`absolute inset-y-0 right-0 ${
          type === "bid" ? "bg-emerald-500/10" : "bg-rose-500/10"
        }`}
        style={{ width: `${(sz / maxSz) * 100}%` }}
      />
      <span className={type === "bid" ? "text-emerald-400" : "text-rose-400"}>
        {(px * 100).toFixed(1)}¢
      </span>
      <span className="text-muted-foreground">{sz.toFixed(1)}</span>
    </div>
  );

  const spread =
    book.bids[0] && book.asks[0]
      ? ((book.asks[0].px - book.bids[0].px) * 100).toFixed(1)
      : null;

  return (
    <div>
      <div className="flex justify-between border-b border-border px-2 py-1 text-xs text-muted-foreground">
        <span>{sideName} 价格</span>
        <span>数量</span>
      </div>
      <div className="py-1">
        {asks.map((l, i) => (
          <Row key={`a${i}`} px={l.px} sz={l.sz} type="ask" />
        ))}
      </div>
      <div className="border-y border-border px-2 py-1 text-center text-xs text-muted-foreground">
        价差 {spread ?? "—"}¢
      </div>
      <div className="py-1">
        {bids.map((l, i) => (
          <Row key={`b${i}`} px={l.px} sz={l.sz} type="bid" />
        ))}
      </div>
    </div>
  );
}
