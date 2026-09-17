/**
 * 市场内页数据 hooks：
 *   useMarketDetail  — 单个市场的实时盘口（双侧 l2Book）+ 最新成交（trades）
 *   usePriceHistory  — 价格历史线（candleSnapshot 收盘价序列，非 K 线渲染）
 */
import { useEffect, useMemo, useState } from "react";
import * as hl from "@nktkas/hyperliquid";
import { outcomeSideSlug } from "@/lib/outcomeSlug";
import type { OutcomeMarket } from "@/lib/hyperliquid";
import { IS_TESTNET } from "@/config";

// ─── 类型 ────────────────────────────────────────────────────────

export interface BookLevel {
  px: number;
  sz: number;
  n: number;
}

export interface SideBook {
  bids: BookLevel[];
  asks: BookLevel[];
}

export interface Trade {
  side: "B" | "A"; // B = 买方主动（吃卖单），A = 卖方主动
  px: number;
  sz: number;
  time: number;
}

export interface PricePoint {
  t: number;
  p: number; // 0~1
}

// ─── 实时盘口 + 成交 ─────────────────────────────────────────────

export function useMarketDetail(market: OutcomeMarket | null, isMock: boolean) {
  const [books, setBooks] = useState<Record<number, SideBook>>({});
  const [trades, setTrades] = useState<Trade[]>([]);
  const [live, setLive] = useState(false);

  const slugs = useMemo(
    () =>
      market
        ? market.sideSpecs.map((s) => outcomeSideSlug(market, s.name))
        : [],
    [market],
  );

  useEffect(() => {
    if (!market) return;
    setBooks({});
    setTrades([]);

    // ── 演示模式 ──
    if (isMock) {
      const mid = 0.3 + Math.random() * 0.4;
      const genBook = (m: number): SideBook => ({
        bids: Array.from({ length: 8 }, (_, i) => ({
          px: Math.max(0.01, m - 0.005 * (i + 1)),
          sz: 50 + Math.random() * 500,
          n: 1 + Math.floor(Math.random() * 5),
        })),
        asks: Array.from({ length: 8 }, (_, i) => ({
          px: Math.min(0.99, m + 0.005 * (i + 1)),
          sz: 50 + Math.random() * 500,
          n: 1 + Math.floor(Math.random() * 5),
        })),
      });
      setBooks({ 0: genBook(mid), 1: genBook(1 - mid) });
      setTrades(
        Array.from({ length: 20 }, (_, i) => ({
          side: Math.random() > 0.5 ? "B" : "A",
          px: mid + (Math.random() - 0.5) * 0.02,
          sz: 1 + Math.random() * 100,
          time: Date.now() - i * 60000,
        })),
      );
      setLive(true);
      const timer = setInterval(() => {
        setTrades((prev) =>
          [
            {
              side: Math.random() > 0.5 ? ("B" as const) : ("A" as const),
              px: mid + (Math.random() - 0.5) * 0.02,
              sz: 1 + Math.random() * 100,
              time: Date.now(),
            },
            ...prev,
          ].slice(0, 50),
        );
      }, 3000);
      return () => clearInterval(timer);
    }

    // ── 真实模式 ──
    const ws = new hl.WebSocketTransport({ isTestnet: IS_TESTNET });
    const client = new hl.SubscriptionClient({ transport: ws });
    let cancelled = false;
    const pending: Promise<{ unsubscribe: () => Promise<void> }>[] = [];

    (async () => {
      // 双侧盘口
      slugs.forEach((slug, sideIdx) => {
        if (!slug) return;
        const p = client
          .l2Book({ coin: slug, fast: true }, (event) => {
            const map = (lv: { px: string; sz: string; n: number }[]) =>
              lv.map((l) => ({
                px: parseFloat(l.px),
                sz: parseFloat(l.sz),
                n: l.n,
              }));
            setBooks((prev) => ({
              ...prev,
              [sideIdx]: {
                bids: map(event.levels[0]),
                asks: map(event.levels[1]),
              },
            }));
          })
          .then((s) => {
            if (!cancelled) setLive(true);
            return s;
          })
          .catch(() => ({ unsubscribe: async () => {} }));
        pending.push(p);
      });

      // Yes 侧成交流
      const yesSlug = slugs[0];
      if (yesSlug) {
        const p = client
          .trades({ coin: yesSlug }, (event) => {
            const incoming = event
              .map((t) => ({
                side: t.side as "B" | "A",
                px: parseFloat(t.px),
                sz: parseFloat(t.sz),
                time: t.time,
              }))
              .reverse();
            setTrades((prev) => [...incoming, ...prev].slice(0, 100));
          })
          .catch(() => ({ unsubscribe: async () => {} }));
        pending.push(p);
      }
    })();

    return () => {
      cancelled = true;
      setLive(false);
      for (const p of pending) {
        p.then((s) => s.unsubscribe()).catch(() => {});
      }
      (ws as unknown as { close?: () => Promise<void> }).close?.()?.catch?.(
        () => {},
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market?.outcome, isMock]);

  // 中间价（每侧）
  const mids = useMemo(() => {
    const out: Record<number, number | null> = {};
    for (const [k, book] of Object.entries(books)) {
      const bid = book.bids[0]?.px ?? null;
      const ask = book.asks[0]?.px ?? null;
      out[Number(k)] =
        bid !== null && ask !== null ? (bid + ask) / 2 : (bid ?? ask);
    }
    return out;
  }, [books]);

  return { books, trades, mids, live };
}

// ─── 价格历史（线状图数据） ──────────────────────────────────────

export type HistoryRange = "24H" | "7D" | "ALL";

const RANGE_CONFIG: Record<
  HistoryRange,
  { interval: "15m" | "1h" | "4h"; lookbackMs: number }
> = {
  "24H": { interval: "15m", lookbackMs: 24 * 3600 * 1000 },
  "7D": { interval: "1h", lookbackMs: 7 * 24 * 3600 * 1000 },
  ALL: { interval: "4h", lookbackMs: 90 * 24 * 3600 * 1000 },
};

export function usePriceHistory(
  market: OutcomeMarket | null,
  isMock: boolean,
  range: HistoryRange,
) {
  const [points, setPoints] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const yesSlug = useMemo(
    () => (market ? outcomeSideSlug(market, market.sideSpecs[0]?.name ?? "Yes") : null),
    [market],
  );

  useEffect(() => {
    if (!market || !yesSlug) return;
    setLoading(true);
    setUnavailable(false);

    // ── 演示模式：随机游走历史 ──
    if (isMock) {
      const { lookbackMs } = RANGE_CONFIG[range];
      const n = 96;
      const step = lookbackMs / n;
      let v = 0.3 + Math.random() * 0.4;
      const pts: PricePoint[] = [];
      for (let i = n; i >= 0; i--) {
        v = Math.min(0.97, Math.max(0.03, v + (Math.random() - 0.5) * 0.03));
        pts.push({ t: Date.now() - i * step, p: v });
      }
      setPoints(pts);
      setLoading(false);
      return;
    }

    // ── 真实模式：candleSnapshot 收盘价 ──
    let cancelled = false;
    const { interval, lookbackMs } = RANGE_CONFIG[range];
    const transport = new hl.HttpTransport({ isTestnet: IS_TESTNET });
    const info = new hl.InfoClient({ transport });
    info
      .candleSnapshot({
        coin: yesSlug,
        interval,
        startTime: Date.now() - lookbackMs,
        endTime: Date.now(),
      })
      .then((candles) => {
        if (cancelled) return;
        if (!candles || candles.length === 0) {
          setUnavailable(true);
          setPoints([]);
          return;
        }
        setPoints(
          candles.map((c) => ({ t: c.t, p: parseFloat(c.c) })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setUnavailable(true);
          setPoints([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market, yesSlug, isMock, range]);

  return { points, loading, unavailable };
}
