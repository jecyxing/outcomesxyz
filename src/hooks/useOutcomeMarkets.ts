import { useEffect, useState } from "react";
import {
  fetchOutcomeMarkets,
  type OutcomeMarket,
} from "@/lib/hyperliquid";
import { USE_MOCK_FALLBACK } from "@/config";

/** 接口不可用时的演示数据（仅用于调 UI，USE_MOCK_FALLBACK 控制）。
 *  description 格式模仿真实链上 spec，保证 slug 生成走真实代码路径 */
const MOCK_MARKETS: OutcomeMarket[] = [
  {
    outcome: 1,
    name: "template:btc-daily",
    description:
      "class:priceBinary|underlying:BTC|expiry:20260918-0600|targetPrice:120000",
    sideSpecs: [
      { name: "Yes", token: 100001 },
      { name: "No", token: 100002 },
    ],
    quoteToken: "USDC",
  },
  {
    outcome: 2,
    name: "No change",
    description: "choice:No change",
    sideSpecs: [
      { name: "Yes", token: 100003 },
      { name: "No", token: 100004 },
    ],
    quoteToken: "USDC",
    questionName: "Fed September decision",
    questionDescription: "expiry:20260917",
    questionNamedOutcomes: [2],
  },
  {
    outcome: 3,
    name: "template:hype-touch",
    description:
      "class:priceBinary|underlying:HYPE|expiry:20261001-0600|targetPrice:100",
    sideSpecs: [
      { name: "Yes", token: 100005 },
      { name: "No", token: 100006 },
    ],
    quoteToken: "USDC",
  },
];

// ─── 模块级共享缓存 ───────────────────────────────────────────────
// 列表页和内页共用一份 outcomeMeta，避免每个页面重复请求
let cached: OutcomeMarket[] | null = null;
let cachedIsMock = false;
let inflight: Promise<OutcomeMarket[]> | null = null;

function load(): Promise<OutcomeMarket[]> {
  if (cached) return Promise.resolve(cached);
  if (inflight) return inflight;
  inflight = fetchOutcomeMarkets()
    .then((data) => {
      cached = data;
      cachedIsMock = false;
      return data;
    })
    .catch((e) => {
      if (USE_MOCK_FALLBACK) {
        cached = MOCK_MARKETS;
        cachedIsMock = true;
        return MOCK_MARKETS;
      }
      throw e;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useOutcomeMarkets() {
  const [markets, setMarkets] = useState<OutcomeMarket[]>(cached ?? []);
  const [loading, setLoading] = useState(cached === null);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(cachedIsMock);

  useEffect(() => {
    let cancelled = false;
    load()
      .then((data) => {
        if (cancelled) return;
        setMarkets(data);
        setIsMock(cachedIsMock);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "加载市场失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { markets, loading, error, isMock };
}

/** 按 outcome id 查单个市场（内页用） */
export function findMarket(
  markets: OutcomeMarket[],
  outcomeId: number,
): OutcomeMarket | undefined {
  return markets.find((m) => m.outcome === outcomeId);
}
