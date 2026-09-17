/**
 * 市场分类器（启发式）
 *
 * HIP-4 的 outcomeMeta 没有官方分类字段，这里根据
 * 标题 / description spec / question 名做关键词归类。
 * 新市场类型出现时，往对应关键词列表里加词即可。
 */
import type { OutcomeMarket } from "@/lib/hyperliquid";
import { displayTitle } from "@/lib/outcomeSlug";

export type Category = "all" | "crypto" | "macro" | "sports" | "other";

export const CATEGORY_LABELS: Record<Category, string> = {
  all: "全部",
  crypto: "加密货币",
  macro: "宏观",
  sports: "体育",
  other: "其他",
};

const CRYPTO_KEYWORDS = [
  "btc", "bitcoin", "eth", "ethereum", "sol", "solana", "hype",
  "hyperliquid", "xrp", "doge", "bnb", "crypto",
];

const MACRO_KEYWORDS = [
  "fed", "fomc", "cpi", "inflation", "rate", "interest",
  "非农", "payroll", "gdp", "treasury", " Powell", "powell",
  "tariff", "recession",
];

const SPORTS_KEYWORDS = [
  "nba", "nfl", "mlb", "nhl", "ufc", "f1", "world cup", "worldcup",
  "champions league", "premier league", "laliga", "serie a",
  "playoffs", "finals", "super bowl", "olympics", "tennis", "golf",
  "match", "game ", " vs ", "winner",
];

function haystack(market: OutcomeMarket): string {
  return [
    displayTitle(market),
    market.name,
    market.description,
    market.questionName ?? "",
    market.questionDescription ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k.toLowerCase()));
}

export function categorize(market: OutcomeMarket): Exclude<Category, "all"> {
  const text = haystack(market);
  // 顺序即优先级：体育 > 宏观 > 加密（避免 "game" 之类泛词抢占）
  if (matchesAny(text, SPORTS_KEYWORDS)) return "sports";
  if (matchesAny(text, MACRO_KEYWORDS)) return "macro";
  if (matchesAny(text, CRYPTO_KEYWORDS)) return "crypto";
  return "other";
}

/** 搜索 + 分类过滤 */
export function filterMarkets(
  markets: OutcomeMarket[],
  category: Category,
  query: string,
): OutcomeMarket[] {
  const q = query.trim().toLowerCase();
  return markets.filter((m) => {
    if (category !== "all" && categorize(m) !== category) return false;
    if (q && !haystack(m).includes(q)) return false;
    return true;
  });
}
