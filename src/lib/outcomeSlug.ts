/**
 * HIP-4 outcome 市场的 slug / 资产 id 工具。
 *
 * 逻辑移植自 @nktkas/hyperliquid 内部的 SymbolConverter
 * （esm/utils/_symbolConverter.js），用于：
 *   1. 生成 WebSocket 订阅 l2Book 时需要的 coin（即 URL slug）
 *   2. 计算下单用的资产 id：100000000 + 10 * outcomeId + sideIndex
 *
 * 规格文档：https://hyperliquid.gitbook.io/hyperliquid-docs/trading/contract-specifications
 */
import type { OutcomeMarket } from "@/lib/hyperliquid";

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

/** 下单资产 id（SDK 源码确认的公式） */
export function outcomeAssetId(outcomeId: number, sideIndex: number): number {
  return 100000000 + 10 * outcomeId + sideIndex;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseSpec(spec: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of spec.split("|")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    fields[part.slice(0, idx)] = part.slice(idx + 1);
  }
  return fields;
}

function recurringPriceSlug(
  spec: string,
  side: string,
  bucketIndex: number,
): string | null {
  const fields = parseSpec(spec);
  const { class: assetClass, underlying, expiry } = fields;
  if (!assetClass || !underlying || !expiry) return null;
  // expiry "YYYYMMDD-HHMM" → "mon-dd-HHMM"
  const date = `${MONTHS[Number(expiry.slice(4, 6)) - 1]}-${expiry.slice(6, 8)}-${expiry.slice(9, 13)}`;

  if (assetClass === "priceBinary") {
    const target = fields.targetPrice;
    if (!target) return null;
    return `${underlying}-above-${target}-${side}-${date}`.toLowerCase();
  }
  if (assetClass === "priceBucket") {
    const prices = fields.priceThresholds?.split(",");
    if (prices?.length !== 2) return null;
    const range =
      bucketIndex === 0
        ? `below-${prices[0]}`
        : bucketIndex === 1
          ? `${prices[0]}-to-${prices[1]}`
          : `above-${prices[1]}`;
    return `${underlying}-price-range-${date}-${range}-${side}`.toLowerCase();
  }
  return null;
}

/**
 * 生成某个 outcome 某个 side 的订阅 coin（slug）。
 * 与 SDK SymbolConverter 保持一致：
 *   - outcome.description 含 class:priceBinary → 周期性格式
 *   - 所属 question.description 含 class:priceBucket → 区间格式
 *   - 其他 → question/outcome/side 名字 slugify 拼接
 */
export function outcomeSideSlug(
  market: OutcomeMarket,
  sideName: string,
): string | null {
  if (market.description.includes("class:priceBinary")) {
    return recurringPriceSlug(market.description, sideName, 0);
  }
  if (market.questionDescription?.includes("class:priceBucket")) {
    const idx = market.questionNamedOutcomes?.indexOf(market.outcome) ?? -1;
    return recurringPriceSlug(
      market.questionDescription,
      sideName,
      Math.max(idx, 0),
    );
  }
  const parts = [market.questionName, market.name, sideName].filter(
    (p): p is string => p !== undefined,
  );
  const slug = parts.map(slugify).join("-");
  return slug || null;
}

/** 卡片标题：周期性价格市场从 spec 生成可读标题，其他用 question/outcome 名 */
export function displayTitle(market: OutcomeMarket): string {
  if (market.description.includes("class:priceBinary")) {
    const f = parseSpec(market.description);
    if (f.underlying && f.targetPrice) {
      return `${f.underlying} above $${Number(f.targetPrice).toLocaleString()}?`;
    }
  }
  return market.questionName ?? market.name;
}
