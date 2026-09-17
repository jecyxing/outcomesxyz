/**
 * outcomes.xyz — 全局配置
 *
 * 优先读取环境变量（Vite 的 VITE_* 系列，见 .env.example），
 * 未设置时回落到文件内的默认值。部署到 Vercel 时在项目
 * Environment Variables 里配置即可，不用改代码。
 *
 * builder 地址需满足 Hyperliquid 官方要求：
 *   1. perps 账户价值 >= 100 USDC
 *   2. 账户抽象模式为 standard
 */

const env = import.meta.env;

// ─── Builder Code ────────────────────────────────────────────────
/** 你的 builder 地址（收费用）。默认是占位地址，部署前必须通过
 *  VITE_BUILDER_ADDRESS 或修改此处替换！ */
export const BUILDER_ADDRESS = (env.VITE_BUILDER_ADDRESS ??
  "0x0000000000000000000000000000000000000001") as `0x${string}`;

/**
 * 向用户收取的 builder fee，单位：十分之一个基点（tenths of bps）。
 *   10 = 1 bps = 0.01% ｜ 100 = 0.1% ｜ 1000 = 1%（outcome 订单上限）
 * HIP-4 outcome 订单继承现货规则：买、卖双侧都可收费，以报价代币（USDC）计。
 */
export const BUILDER_FEE_TENTHS_BPS = Number(
  env.VITE_BUILDER_FEE_TENTHS_BPS ?? 100,
); // 默认 0.1%

/**
 * 请求用户授权的最高费率（ApproveBuilderFee）。
 * 必须 >= 你实际下单时使用的费率，建议留一点上调空间。
 */
export const BUILDER_MAX_FEE_RATE =
  env.VITE_BUILDER_MAX_FEE_RATE ?? "0.1%";

// ─── 网络 ────────────────────────────────────────────────────────
/** true = 测试网（api.hyperliquid-testnet.xyz），false = 主网 */
export const IS_TESTNET = env.VITE_IS_TESTNET === "true";

// ─── UI ──────────────────────────────────────────────────────────
/** outcomeMeta 接口失败时（如网络/地区限制）是否展示演示数据，方便调 UI。
 *  生产环境建议设为 false（接口失败时显示错误而不是假数据） */
export const USE_MOCK_FALLBACK = env.VITE_USE_MOCK_FALLBACK !== "false";

/** 最多为前 N 个市场订阅实时 orderbook（每个市场 2 条 WebSocket 订阅） */
export const MAX_LIVE_MARKETS = 24;

export const SITE_NAME = "outcomes.xyz";
