/**
 * 实时价格 hook：
 *   - 真实模式：WebSocketTransport + SubscriptionClient 订阅 l2Book（fast 档，
 *     5 档深度每 0.5s 推送），取最优买/卖价算中间价
 *   - 演示模式（接口不可用）：本地随机游走生成价格，走同一条渲染路径
 */
import { useEffect, useState } from "react";
import * as hl from "@nktkas/hyperliquid";
import { outcomeSideSlug } from "@/lib/outcomeSlug";
import type { OutcomeMarket } from "@/lib/hyperliquid";
import { IS_TESTNET, MAX_LIVE_MARKETS } from "@/config";

export interface SidePrice {
  bid: number | null;
  ask: number | null;
  mid: number | null;
}

export type PriceMap = Record<string, SidePrice>;

/** 计算一个市场每个 side 的订阅 slug（side 索引 → slug） */
export function marketSlugs(market: OutcomeMarket): (string | null)[] {
  return market.sideSpecs.map((s) => outcomeSideSlug(market, s.name));
}

export function useOutcomePrices(markets: OutcomeMarket[], isMock: boolean) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [live, setLive] = useState(false);

  useEffect(() => {
    // ── 演示模式：随机游走 ──
    if (isMock) {
      const slugs = markets.flatMap((m) =>
        marketSlugs(m).filter((s): s is string => s !== null),
      );
      const state = new Map<string, number>(
        slugs.map((s) => [s, 0.15 + Math.random() * 0.7]),
      );
      const tick = () => {
        setPrices(() => {
          const next: PriceMap = {};
          for (const [slug, mid] of state) {
            const v = Math.min(
              0.98,
              Math.max(0.02, mid + (Math.random() - 0.5) * 0.02),
            );
            state.set(slug, v);
            next[slug] = { bid: v - 0.005, ask: v + 0.005, mid: v };
          }
          return next;
        });
      };
      tick();
      setLive(true);
      const timer = setInterval(tick, 1500);
      return () => clearInterval(timer);
    }

    // ── 真实模式：WebSocket 订阅 l2Book ──
    const targets: string[] = [];
    for (const m of markets.slice(0, MAX_LIVE_MARKETS)) {
      for (const slug of marketSlugs(m)) {
        if (slug) targets.push(slug);
      }
    }
    if (targets.length === 0) return;

    const ws = new hl.WebSocketTransport({ isTestnet: IS_TESTNET });
    const client = new hl.SubscriptionClient({ transport: ws });
    let cancelled = false;
    const pending: Promise<{ unsubscribe: () => Promise<void> }>[] = [];

    (async () => {
      for (const slug of targets) {
        if (cancelled) break;
        try {
          const sub = client.l2Book({ coin: slug, fast: true }, (event) => {
            const bid = event.levels[0][0]
              ? parseFloat(event.levels[0][0].px)
              : null;
            const ask = event.levels[1][0]
              ? parseFloat(event.levels[1][0].px)
              : null;
            const mid =
              bid !== null && ask !== null ? (bid + ask) / 2 : (bid ?? ask);
            setPrices((prev) => ({ ...prev, [slug]: { bid, ask, mid } }));
          });
          pending.push(sub);
          await sub; // 等订阅建立，避免瞬时打满
          if (!cancelled) setLive(true);
        } catch {
          // 单个市场订阅失败（如已结算）不影响其他市场
        }
      }
    })();

    return () => {
      cancelled = true;
      setLive(false);
      for (const p of pending) {
        p.then((s) => s.unsubscribe()).catch(() => {});
      }
      // WebSocketTransport 关闭（SDK 提供 close，防御性调用）
      (ws as unknown as { close?: () => Promise<void> }).close?.()?.catch?.(
        () => {},
      );
    };
  }, [markets, isMock]);

  return { prices, live };
}
