import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "@/sections/Header";
import BuilderBanner from "@/sections/BuilderBanner";
import MarketCard from "@/sections/MarketCard";
import TradeDialog from "@/sections/TradeDialog";
import MyPositions from "@/sections/MyPositions";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWallet } from "@/hooks/useWallet";
import { useOutcomeMarkets } from "@/hooks/useOutcomeMarkets";
import { useOutcomePrices, marketSlugs } from "@/hooks/useOutcomePrices";
import { useMyPositions } from "@/hooks/useMyPositions";
import { fetchMaxBuilderFee, type OutcomeMarket } from "@/lib/hyperliquid";
import {
  categorize,
  filterMarkets,
  CATEGORY_LABELS,
  type Category,
} from "@/lib/categories";
import { BUILDER_FEE_TENTHS_BPS } from "@/config";

const PAGE_SIZE = 24;
const CATEGORIES: Category[] = ["all", "crypto", "macro", "sports", "other"];

export default function Home() {
  const { address, walletClient, connecting, error, connect, disconnect } =
    useWallet();
  const { markets, loading, error: marketsError, isMock } = useOutcomeMarkets();

  const [category, setCategory] = useState<Category>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  // 筛选 + 搜索
  const filtered = useMemo(
    () => filterMarkets(markets, category, query),
    [markets, category, query],
  );

  // 每个分类的数量（Tab 上显示）
  const counts = useMemo(() => {
    const c: Record<Category, number> = {
      all: markets.length,
      crypto: 0,
      macro: 0,
      sports: 0,
      other: 0,
    };
    for (const m of markets) c[categorize(m)] += 1;
    return c;
  }, [markets]);

  // 分页
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageMarkets = useMemo(
    () => filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [filtered, safePage],
  );

  // 筛选条件变化时回到第一页
  useEffect(() => setPage(0), [category, query]);

  // 实时价格只订阅当前页的市场，翻页/筛选时自动换订阅
  const { prices, live } = useOutcomePrices(pageMarkets, isMock);

  // 我的持仓 + 挂单（连接钱包后启用，15s 轮询）
  const {
    positions,
    openOrders,
    loading: positionsLoading,
    error: positionsError,
    refresh: refreshPositions,
  } = useMyPositions(address, markets, !isMock);

  const [approved, setApproved] = useState(false);
  const [selected, setSelected] = useState<{
    market: OutcomeMarket;
    sideIndex: number;
  } | null>(null);

  // 连接钱包后查询用户是否已授权 builder fee
  useEffect(() => {
    if (!address) {
      setApproved(false);
      return;
    }
    fetchMaxBuilderFee(address).then((maxFee) => {
      setApproved(maxFee >= BUILDER_FEE_TENTHS_BPS);
    });
  }, [address]);

  const handleTrade = useCallback(
    (market: OutcomeMarket, sideIndex: number) => {
      if (!address) {
        connect();
        return;
      }
      setSelected({ market, sideIndex });
    },
    [address, connect],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        address={address}
        connecting={connecting}
        onConnect={connect}
        onDisconnect={disconnect}
      />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <BuilderBanner
          walletClient={walletClient}
          approved={approved}
          onApproved={() => setApproved(true)}
        />

        {address && (
          <MyPositions
            positions={positions}
            openOrders={openOrders}
            prices={prices}
            loading={positionsLoading}
            error={positionsError}
            walletClient={walletClient}
            approved={approved}
            onRefresh={refreshPositions}
          />
        )}

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              预测市场
              {live && (
                <span className="flex items-center gap-1 text-xs font-normal text-emerald-400">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  实时
                </span>
              )}
            </h1>
            {isMock && (
              <span className="text-xs text-amber-500">
                ⚠ 演示数据（接口不可用），config.ts 可关闭
              </span>
            )}
          </div>

          {/* 分类 + 搜索 */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={category}
              onValueChange={(v) => setCategory(v as Category)}
            >
              <TabsList>
                {CATEGORIES.map((c) => (
                  <TabsTrigger key={c} value={c} className="gap-1">
                    {CATEGORY_LABELS[c]}
                    <span className="text-xs text-muted-foreground">
                      {counts[c]}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Input
              placeholder="搜索市场…（如 BTC、Fed、NBA）"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="sm:max-w-xs"
            />
          </div>

          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : marketsError ? (
            <p className="text-sm text-destructive">{marketsError}</p>
          ) : pageMarkets.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              没有匹配的市场{query && `："${query}"`}
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {pageMarkets.map((m) => (
                  <MarketCard
                    key={m.outcome}
                    market={m}
                    prices={prices}
                    onTrade={handleTrade}
                  />
                ))}
              </div>

              {/* 分页 */}
              {pageCount > 1 && (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage === 0}
                    onClick={() => setPage(safePage - 1)}
                  >
                    上一页
                  </Button>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {safePage + 1} / {pageCount} · 共 {filtered.length} 个市场
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage(safePage + 1)}
                  >
                    下一页
                  </Button>
                </div>
              )}
            </>
          )}
        </section>

        <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
          outcomes.xyz — 基于 Hyperliquid HIP-4 的预测市场前端 ·
          交易即表示接受 builder fee 授权 · 预测市场在部分地区受监管限制
        </footer>
      </main>

      <TradeDialog
        market={selected?.market ?? null}
        sideIndex={selected?.sideIndex ?? 0}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
        walletClient={walletClient}
        approved={approved}
        onNeedConnect={connect}
        suggestedPrice={
          selected
            ? (() => {
                const slug = marketSlugs(selected.market)[selected.sideIndex];
                return slug ? (prices[slug]?.mid ?? null) : null;
              })()
            : null
        }
      />
    </div>
  );
}
