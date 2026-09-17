/**
 * Hyperliquid HIP-4 接入层
 *
 * 依赖 @nktkas/hyperliquid：
 *   - InfoClient:     outcomeMeta / maxBuilderFee / referral（只读）
 *   - ExchangeClient: approveBuilderFee / order（签名，走用户浏览器钱包）
 *
 * 官方文档：
 *   Builder codes      https://hyperliquid.gitbook.io/hyperliquid-docs/trading/builder-codes
 *   HIP-4 deployer api https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/hip-4-deployer-actions
 */
import * as hl from "@nktkas/hyperliquid";
import { outcomeAssetId, outcomeSideSlug } from "@/lib/outcomeSlug";
import {
  BUILDER_ADDRESS,
  BUILDER_FEE_TENTHS_BPS,
  BUILDER_MAX_FEE_RATE,
  IS_TESTNET,
} from "@/config";

// ─── 类型 ────────────────────────────────────────────────────────

export interface OutcomeSide {
  name: string;
  token?: number;
}

export interface OutcomeMarket {
  outcome: number;
  name: string;
  description: string;
  sideSpecs: OutcomeSide[];
  quoteToken: string;
  deployer?: `0x${string}`;
  /** 所属问题名（多 outcome 市场），standalone 市场为空 */
  questionName?: string;
  /** 所属问题的 description（priceBucket 市场生成 slug 要用） */
  questionDescription?: string;
  /** 所属问题的 namedOutcomes 列表（确定 bucket 序号要用） */
  questionNamedOutcomes?: number[];
}

// ─── 客户端 ──────────────────────────────────────────────────────

const transport = new hl.HttpTransport({ isTestnet: IS_TESTNET });

export const infoClient = new hl.InfoClient({ transport });

/** 用浏览器钱包（viem WalletClient）构造 ExchangeClient */
export function makeExchangeClient(wallet: unknown) {
  return new hl.ExchangeClient({
    transport,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wallet: wallet as any,
  });
}

// ─── 行情 ────────────────────────────────────────────────────────

/**
 * 拉取全部 HIP-4 outcome 市场，并把 question 信息挂到子 outcome 上。
 * fallback outcome（多 outcome 问题里的"其他"）不可单独交易，直接过滤。
 */
export async function fetchOutcomeMarkets(): Promise<OutcomeMarket[]> {
  const meta = await infoClient.outcomeMeta();
  const questionByOutcome = new Map<
    number,
    { name: string; description: string; namedOutcomes: number[] }
  >();
  const fallbackOutcomes = new Set<number>();
  for (const q of meta.questions) {
    fallbackOutcomes.add(q.fallbackOutcome);
    for (const id of q.namedOutcomes) {
      questionByOutcome.set(id, {
        name: q.name,
        description: q.description,
        namedOutcomes: q.namedOutcomes,
      });
    }
  }
  return meta.outcomes
    .filter((o) => !fallbackOutcomes.has(o.outcome))
    .map((o) => {
      const q = questionByOutcome.get(o.outcome);
      return {
        ...o,
        questionName: q?.name,
        questionDescription: q?.description,
        questionNamedOutcomes: q?.namedOutcomes,
      };
    });
}

// ─── Builder Code ────────────────────────────────────────────────

/**
 * 查询用户已授权给你的最高 builder fee。
 * 返回单位：十分之一个基点。用户未授权时返回 0。
 */
export async function fetchMaxBuilderFee(user: `0x${string}`): Promise<number> {
  try {
    const fee = await infoClient.maxBuilderFee({
      user,
      builder: BUILDER_ADDRESS,
    });
    return Number(fee);
  } catch {
    return 0;
  }
}

/**
 * 请求用户签名 ApproveBuilderFee（必须主钱包签，agent 钱包不行）。
 * 授权后，你代用户发出的订单才能附带 builder 参数收费。
 */
export async function approveBuilderFee(wallet: unknown) {
  const exchange = makeExchangeClient(wallet);
  return exchange.approveBuilderFee({
    builder: BUILDER_ADDRESS,
    maxFeeRate: BUILDER_MAX_FEE_RATE,
  });
}

// ─── 下单 ────────────────────────────────────────────────────────

export interface PlaceOrderParams {
  /** outcome 资产 id（公式见 @/lib/outcomeSlug） */
  assetId: number;
  isBuy: boolean;
  /** 限价，0~1 之间的小数字符串，如 "0.62" */
  price: string;
  /** 合约数量字符串 */
  size: string;
  /** Gtc = 挂单（默认）；Ioc = 立即成交剩余取消（平仓/市价卖出用） */
  tif?: "Gtc" | "Ioc";
}

/**
 * 下一个限价单，附带 builder code。
 * builder.f 单位是十分之一基点，协议在成交时按 best-effort 收取。
 */
export async function placeOutcomeOrder(
  wallet: unknown,
  { assetId, isBuy, price, size, tif = "Gtc" }: PlaceOrderParams,
) {
  const exchange = makeExchangeClient(wallet);
  return exchange.order({
    orders: [
      {
        a: assetId,
        b: isBuy,
        p: price,
        s: size,
        r: false,
        t: { limit: { tif } },
      },
    ],
    grouping: "na",
    builder: { b: BUILDER_ADDRESS, f: BUILDER_FEE_TENTHS_BPS },
  });
}

// ─── 持仓与挂单 ──────────────────────────────────────────────────

export interface OutcomePosition {
  market: OutcomeMarket;
  sideIndex: number;
  /** 总持仓（张） */
  size: number;
  /** 被挂单锁定的数量 */
  held: number;
  /** 成本名义价值（entryNtl），用于算盈亏 */
  entryNtl: number;
}

export interface OutcomeOpenOrder {
  market: OutcomeMarket;
  sideIndex: number;
  side: "B" | "A";
  limitPx: number;
  sz: number;
  oid: number;
}

/** token id → (market, sideIndex) 索引 */
function buildTokenIndex(markets: OutcomeMarket[]) {
  const byToken = new Map<number, { market: OutcomeMarket; sideIndex: number }>();
  for (const m of markets) {
    m.sideSpecs.forEach((s, i) => {
      if (s.token !== undefined) byToken.set(s.token, { market: m, sideIndex: i });
    });
  }
  return byToken;
}

/**
 * 查询用户的 outcome 持仓。
 * HIP-4 是全额抵押合约，持仓体现为 outcome token 的现货余额，
 * 通过 spotClearinghouseState 的 token id 与市场 sideSpecs 匹配得出。
 */
export async function fetchOutcomePositions(
  user: `0x${string}`,
  markets: OutcomeMarket[],
): Promise<OutcomePosition[]> {
  const state = await infoClient.spotClearinghouseState({ user });
  const byToken = buildTokenIndex(markets);
  const positions: OutcomePosition[] = [];
  for (const b of state.balances) {
    // 余额有两种形态：普通现货带 token 字段；outcome 代币是 { coin: "o<id>" }
    let tokenId: number | undefined;
    if ("token" in b) {
      tokenId = b.token;
    } else {
      const m = /^o(\d+)$/.exec(b.coin);
      if (m) tokenId = Number(m[1]);
    }
    if (tokenId === undefined) continue;
    const hit = byToken.get(tokenId);
    if (!hit) continue;
    const size = parseFloat(b.total);
    if (size <= 0) continue;
    positions.push({
      market: hit.market,
      sideIndex: hit.sideIndex,
      size,
      held: parseFloat(b.hold ?? "0"),
      entryNtl: parseFloat(b.entryNtl ?? "0"),
    });
  }
  return positions;
}

/** 查询用户在 outcome 市场上的挂单（按 slug 匹配，非 outcome 挂单被过滤） */
export async function fetchOutcomeOpenOrders(
  user: `0x${string}`,
  markets: OutcomeMarket[],
): Promise<OutcomeOpenOrder[]> {
  const orders = await infoClient.openOrders({ user });
  // slug → (market, sideIndex)
  const bySlug = new Map<string, { market: OutcomeMarket; sideIndex: number }>();
  for (const m of markets) {
    m.sideSpecs.forEach((s, i) => {
      const slug = outcomeSideSlug(m, s.name);
      if (slug) bySlug.set(slug, { market: m, sideIndex: i });
    });
  }
  const out: OutcomeOpenOrder[] = [];
  for (const o of orders) {
    const hit = bySlug.get(o.coin);
    if (!hit) continue;
    out.push({
      market: hit.market,
      sideIndex: hit.sideIndex,
      side: o.side,
      limitPx: parseFloat(o.limitPx),
      sz: parseFloat(o.sz),
      oid: o.oid,
    });
  }
  return out;
}

/** 批量撤销 outcome 挂单 */
export async function cancelOutcomeOrders(
  wallet: unknown,
  cancels: { market: OutcomeMarket; sideIndex: number; oid: number }[],
) {
  const exchange = makeExchangeClient(wallet);
  return exchange.cancel({
    cancels: cancels.map((c) => ({
      a: outcomeAssetId(c.market.outcome, c.sideIndex),
      o: c.oid,
    })),
  });
}

// 资产 id 公式与 slug 生成已移到 @/lib/outcomeSlug.ts
// （公式来自 SDK SymbolConverter 源码：100000000 + 10 * outcomeId + sideIndex）
export { outcomeAssetId, outcomeSideSlug } from "@/lib/outcomeSlug";
