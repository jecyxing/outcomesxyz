import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router";
import Header from "@/sections/Header";
import PriceLineChart from "@/sections/PriceLineChart";
import OrderbookPanel from "@/sections/OrderbookPanel";
import TradesPanel from "@/sections/TradesPanel";
import TradePanel from "@/sections/TradePanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useWallet } from "@/hooks/useWallet";
import { useOutcomeMarkets, findMarket } from "@/hooks/useOutcomeMarkets";
import {
  useMarketDetail,
  usePriceHistory,
  type HistoryRange,
} from "@/hooks/useMarketDetail";
import { fetchMaxBuilderFee } from "@/lib/hyperliquid";
import { displayTitle } from "@/lib/outcomeSlug";
import { categorize, CATEGORY_LABELS } from "@/lib/categories";
import { BUILDER_FEE_TENTHS_BPS } from "@/config";

/** 从 description spec 提取可读字段 */
function specFields(desc: string): [string, string][] {
  return desc
    .split("|")
    .map((kv) => {
      const idx = kv.indexOf(":");
      return [kv.slice(0, idx), kv.slice(idx + 1)] as [string, string];
    })
    .filter(([k, v]) => k && v && k !== "class");
}

export default function MarketDetail() {
  const { outcomeId } = useParams();
  const id = Number(outcomeId);
  const { address, walletClient, connecting, error, connect, disconnect } =
    useWallet();
  const { markets, loading, isMock } = useOutcomeMarkets();
  const market = Number.isFinite(id) ? findMarket(markets, id) : undefined;

  const { books, trades, mids, live } = useMarketDetail(market ?? null, isMock);
  const [range, setRange] = useState<HistoryRange>("24H");
  const { points, loading: histLoading, unavailable } = usePriceHistory(
    market ?? null,
    isMock,
    range,
  );

  const [approved, setApproved] = useState(false);
  useEffect(() => {
    if (!address) {
      setApproved(false);
      return;
    }
    fetchMaxBuilderFee(address).then((f) =>
      setApproved(f >= BUILDER_FEE_TENTHS_BPS),
    );
  }, [address]);

  const yesMid = mids[0] ?? null;
  const noMid = mids[1] ?? null;

  // 区间涨跌（相对历史第一个点）
  const change = useMemo(() => {
    if (points.length < 2 || yesMid === null) return null;
    return (yesMid - points[0].p) * 100;
  }, [points, yesMid]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        address={address}
        connecting={connecting}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Link
          to="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← 返回市场列表
        </Link>

        {loading ? (
          <div className="mt-6 space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !market ? (
          <p className="mt-12 text-center text-muted-foreground">
            市场不存在或已结算（#{outcomeId}）
          </p>
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-3">
            {/* ── 左列：标题 + 大价格 + 走势图 + 盘口/成交 ── */}
            <div className="space-y-6 lg:col-span-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold leading-tight">
                    {displayTitle(market)}
                  </h1>
                  <Badge variant="secondary">
                    {CATEGORY_LABELS[categorize(market)]}
                  </Badge>
                  {live && (
                    <span className="flex items-center gap-1 text-xs text-emerald-400">
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      实时
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {specFields(market.description).map(([k, v]) => (
                    <Badge
                      key={k}
                      variant="outline"
                      className="text-xs font-normal"
                    >
                      {k}: {v}
                    </Badge>
                  ))}
                  <Badge variant="outline" className="text-xs font-normal">
                    报价 {market.quoteToken}
                  </Badge>
                </div>
              </div>

              {/* Polymarket 风格大价格 */}
              <div className="flex items-end gap-4">
                <div>
                  <div className="text-5xl font-bold tabular-nums text-emerald-400">
                    {yesMid !== null ? `${(yesMid * 100).toFixed(1)}%` : "—"}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Yes 概率
                    {noMid !== null &&
                      ` · No ${(noMid * 100).toFixed(1)}%`}
                  </div>
                </div>
                {change !== null && (
                  <span
                    className={`pb-1 text-sm tabular-nums ${
                      change >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%（
                    {range}）
                  </span>
                )}
              </div>

              {/* 走势图 */}
              <Card>
                <CardContent className="pt-4">
                  <Tabs
                    value={range}
                    onValueChange={(v) => setRange(v as HistoryRange)}
                  >
                    <TabsList className="mb-2">
                      <TabsTrigger value="24H">24H</TabsTrigger>
                      <TabsTrigger value="7D">7D</TabsTrigger>
                      <TabsTrigger value="ALL">全部</TabsTrigger>
                    </TabsList>
                  </Tabs>
                  {histLoading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : unavailable ? (
                    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                      该市场暂无历史 K 线数据（新市场或接口不支持）
                    </div>
                  ) : (
                    <PriceLineChart points={points} currentMid={yesMid} />
                  )}
                </CardContent>
              </Card>

              {/* 盘口 / 成交 */}
              <Card>
                <CardContent className="pt-4">
                  <Tabs defaultValue="book">
                    <TabsList className="mb-2">
                      <TabsTrigger value="book">盘口（Yes）</TabsTrigger>
                      <TabsTrigger value="trades">最新成交</TabsTrigger>
                      <TabsTrigger value="rules">结算规则</TabsTrigger>
                    </TabsList>
                    <TabsContent value="book">
                      <OrderbookPanel
                        book={books[0] ?? null}
                        sideName={market.sideSpecs[0]?.name ?? "Yes"}
                      />
                    </TabsContent>
                    <TabsContent value="trades">
                      <TradesPanel trades={trades} />
                    </TabsContent>
                    <TabsContent value="rules">
                      <div className="space-y-2 px-1 py-2 text-sm text-muted-foreground">
                        <p>
                          <span className="text-foreground">链上描述：</span>
                          {market.description || "—"}
                        </p>
                        {market.questionDescription && (
                          <p>
                            <span className="text-foreground">问题描述：</span>
                            {market.questionDescription}
                          </p>
                        )}
                        <p>
                          本市场为全额抵押 outcome 合约，到期按结算源结果以 0 或
                          1（或比例值）结算。结算依据以部署者定义的规则为准，
                          下单前请确认你理解结算口径。
                        </p>
                        {market.deployer && (
                          <p className="break-all">
                            <span className="text-foreground">部署者：</span>
                            {market.deployer}
                          </p>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </div>

            {/* ── 右列：交易面板 ── */}
            <div>
              {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
              <TradePanel
                market={market}
                mids={mids}
                walletClient={walletClient}
                approved={approved}
                onApproved={() => setApproved(true)}
                onNeedConnect={connect}
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full text-muted-foreground"
                asChild
              >
                <a
                  href={`https://app.hyperliquid.xyz/trade`}
                  target="_blank"
                  rel="noreferrer"
                >
                  在 Hyperliquid 查看 ↗
                </a>
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
