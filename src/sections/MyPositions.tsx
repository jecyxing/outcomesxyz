import { useState } from "react";
import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  placeOutcomeOrder,
  cancelOutcomeOrders,
  outcomeAssetId,
  type OutcomePosition,
  type OutcomeOpenOrder,
} from "@/lib/hyperliquid";
import { displayTitle } from "@/lib/outcomeSlug";
import { marketSlugs, type PriceMap } from "@/hooks/useOutcomePrices";
import type { WalletClient } from "viem";

interface MyPositionsProps {
  positions: OutcomePosition[];
  openOrders: OutcomeOpenOrder[];
  prices: PriceMap;
  loading: boolean;
  error: string | null;
  walletClient: WalletClient | null;
  approved: boolean;
  onRefresh: () => void;
}

function midOf(prices: PriceMap, p: OutcomePosition): number | null {
  const slug = marketSlugs(p.market)[p.sideIndex];
  return slug ? (prices[slug]?.mid ?? null) : null;
}

export default function MyPositions({
  positions,
  openOrders,
  prices,
  loading,
  error,
  walletClient,
  approved,
  onRefresh,
}: MyPositionsProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** 一键平仓：以当前买一的 97% 挂 IOC 卖单（尽量立即成交），附带 builder code */
  const handleClose = async (p: OutcomePosition) => {
    if (!walletClient) return;
    const key = `${p.market.outcome}-${p.sideIndex}`;
    setBusy(key);
    setNotice(null);
    try {
      const available = p.size - p.held;
      if (available <= 0) {
        setNotice("该持仓已全部被挂单锁定，请先撤销挂单");
        return;
      }
      const slug = marketSlugs(p.market)[p.sideIndex];
      const bid = slug ? (prices[slug]?.bid ?? null) : null;
      // 无盘口数据时用中间价 95%，再兜底 0.01
      const mid = slug ? (prices[slug]?.mid ?? null) : null;
      const px = Math.max(0.01, (bid ?? (mid !== null ? mid * 0.95 : 0.01)) * 0.97);
      await placeOutcomeOrder(walletClient, {
        assetId: outcomeAssetId(p.market.outcome, p.sideIndex),
        isBuy: false,
        price: px.toFixed(3),
        size: available.toString(),
        tif: "Ioc",
      });
      setNotice("✅ 平仓卖单已提交（IOC）");
      onRefresh();
    } catch (e) {
      setNotice(`❌ ${e instanceof Error ? e.message : "平仓失败"}`);
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async (o: OutcomeOpenOrder) => {
    if (!walletClient) return;
    setBusy(`oid-${o.oid}`);
    setNotice(null);
    try {
      await cancelOutcomeOrders(walletClient, [
        { market: o.market, sideIndex: o.sideIndex, oid: o.oid },
      ]);
      setNotice("✅ 已撤单");
      onRefresh();
    } catch (e) {
      setNotice(`❌ ${e instanceof Error ? e.message : "撤单失败"}`);
    } finally {
      setBusy(null);
    }
  };

  const totalValue = positions.reduce((sum, p) => {
    const mid = midOf(prices, p);
    return sum + (mid !== null ? p.size * mid : 0);
  }, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            我的持仓
            <span className="ml-2 text-sm font-normal text-muted-foreground tabular-nums">
              估值 {totalValue.toFixed(2)} USDC
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
          >
            {loading ? "刷新中…" : "刷新"}
          </Button>
        </div>
        {notice && <p className="text-xs">{notice}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="positions">
          <TabsList className="mb-3">
            <TabsTrigger value="positions">
              持仓（{positions.length}）
            </TabsTrigger>
            <TabsTrigger value="orders">挂单（{openOrders.length}）</TabsTrigger>
          </TabsList>

          <TabsContent value="positions">
            {positions.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                暂无 outcome 持仓
              </p>
            ) : (
              <div className="space-y-2">
                {positions.map((p) => {
                  const mid = midOf(prices, p);
                  const value = mid !== null ? p.size * mid : null;
                  const pnl = value !== null ? value - p.entryNtl : null;
                  const key = `${p.market.outcome}-${p.sideIndex}`;
                  return (
                    <div
                      key={key}
                      className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <Link
                        to={`/market/${p.market.outcome}`}
                        className="min-w-0 flex-1 truncate font-medium hover:text-emerald-400"
                      >
                        {displayTitle(p.market)}
                      </Link>
                      <Badge
                        variant="outline"
                        className={
                          p.sideIndex === 0
                            ? "border-emerald-500/50 text-emerald-400"
                            : "border-rose-500/50 text-rose-400"
                        }
                      >
                        {p.market.sideSpecs[p.sideIndex]?.name}
                      </Badge>
                      <span className="tabular-nums text-muted-foreground">
                        {p.size.toFixed(1)} 张
                      </span>
                      <span className="tabular-nums">
                        {value !== null ? `${value.toFixed(2)} U` : "—"}
                      </span>
                      <span
                        className={`tabular-nums ${
                          pnl === null
                            ? ""
                            : pnl >= 0
                              ? "text-emerald-400"
                              : "text-rose-400"
                        }`}
                      >
                        {pnl !== null
                          ? `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}`
                          : "—"}
                      </span>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy !== null || !approved}
                        title={approved ? "" : "请先完成 builder fee 授权"}
                        onClick={() => handleClose(p)}
                      >
                        {busy === key ? "提交中…" : "卖出平仓"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders">
            {openOrders.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                暂无挂单
              </p>
            ) : (
              <div className="space-y-2">
                {openOrders.map((o) => (
                  <div
                    key={o.oid}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <Link
                      to={`/market/${o.market.outcome}`}
                      className="min-w-0 flex-1 truncate font-medium hover:text-emerald-400"
                    >
                      {displayTitle(o.market)}
                    </Link>
                    <Badge
                      variant="outline"
                      className={
                        o.side === "B"
                          ? "border-emerald-500/50 text-emerald-400"
                          : "border-rose-500/50 text-rose-400"
                      }
                    >
                      {o.side === "B" ? "买" : "卖"}{" "}
                      {o.market.sideSpecs[o.sideIndex]?.name}
                    </Badge>
                    <span className="tabular-nums text-muted-foreground">
                      {(o.limitPx * 100).toFixed(1)}¢ × {o.sz.toFixed(1)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => handleCancel(o)}
                    >
                      {busy === `oid-${o.oid}` ? "撤单中…" : "撤单"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
