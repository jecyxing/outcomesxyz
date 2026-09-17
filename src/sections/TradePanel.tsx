import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  placeOutcomeOrder,
  outcomeAssetId,
  approveBuilderFee,
  type OutcomeMarket,
} from "@/lib/hyperliquid";
import { BUILDER_FEE_TENTHS_BPS, BUILDER_MAX_FEE_RATE } from "@/config";
import type { WalletClient } from "viem";

interface TradePanelProps {
  market: OutcomeMarket;
  mids: Record<number, number | null>;
  walletClient: WalletClient | null;
  approved: boolean;
  onApproved: () => void;
  onNeedConnect: () => void;
}

/** 内页右侧交易面板（Polymarket 风格：Yes/No 切换 + 价格 + 数量） */
export default function TradePanel({
  market,
  mids,
  walletClient,
  approved,
  onApproved,
  onNeedConnect,
}: TradePanelProps) {
  const [sideIndex, setSideIndex] = useState(0);
  const [price, setPrice] = useState("");
  const [size, setSize] = useState("10");
  const [pending, setPending] = useState(false);
  const [approving, setApproving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const side = market.sideSpecs[sideIndex];
  const mid = mids[sideIndex] ?? null;
  const feePct = BUILDER_FEE_TENTHS_BPS / 1000;

  // 切换 side 或中间价更新时预填价格（用户已手动改过则不覆盖）
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && mid !== null) setPrice(mid.toFixed(3));
  }, [mid, touched, sideIndex]);

  const notional = useMemo(() => {
    const p = parseFloat(price);
    const s = parseFloat(size);
    return Number.isFinite(p) && Number.isFinite(s) ? p * s : 0;
  }, [price, size]);

  const handleApprove = async () => {
    if (!walletClient) return;
    setApproving(true);
    setResult(null);
    try {
      await approveBuilderFee(walletClient);
      onApproved();
    } catch (e) {
      setResult(`❌ ${e instanceof Error ? e.message : "授权失败"}`);
    } finally {
      setApproving(false);
    }
  };

  const handleSubmit = async () => {
    if (!walletClient) return;
    setPending(true);
    setResult(null);
    try {
      await placeOutcomeOrder(walletClient, {
        assetId: outcomeAssetId(market.outcome, sideIndex),
        isBuy: true,
        price,
        size,
      });
      setResult("✅ 订单已提交");
    } catch (e) {
      setResult(`❌ ${e instanceof Error ? e.message : "下单失败"}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="sticky top-20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">交易</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Yes / No 切换 */}
        <div className="grid grid-cols-2 gap-2">
          {market.sideSpecs.slice(0, 2).map((s, i) => (
            <Button
              key={s.name}
              variant={sideIndex === i ? "default" : "outline"}
              className={
                sideIndex === i
                  ? i === 0
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-rose-600 hover:bg-rose-500 text-white"
                  : ""
              }
              onClick={() => {
                setSideIndex(i);
                setTouched(false);
              }}
            >
              {s.name}{" "}
              {mids[i] !== null && mids[i] !== undefined
                ? `${((mids[i] ?? 0) * 100).toFixed(1)}¢`
                : ""}
            </Button>
          ))}
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="tp-price">价格</Label>
            {mid !== null && (
              <span className="text-xs text-muted-foreground">
                中间价 {(mid * 100).toFixed(1)}¢
              </span>
            )}
          </div>
          <Input
            id="tp-price"
            type="number"
            min="0"
            max="1"
            step="0.001"
            value={price}
            onChange={(e) => {
              setPrice(e.target.value);
              setTouched(true);
            }}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="tp-size">数量（张）</Label>
          <Input
            id="tp-size"
            type="number"
            min="0"
            step="1"
            value={size}
            onChange={(e) => setSize(e.target.value)}
          />
        </div>

        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
          <div className="flex justify-between">
            <span>名义价值</span>
            <span>
              {notional.toFixed(2)} {market.quoteToken}
            </span>
          </div>
          <div className="flex justify-between">
            <span>builder fee（{feePct.toFixed(2)}%）</span>
            <span>
              {(notional * (feePct / 100)).toFixed(4)} {market.quoteToken}
            </span>
          </div>
          <div className="mt-1 text-xs">
            最大亏损 = 买入成本 · 到期按 0 或 1 结算
          </div>
        </div>

        {result && <p className="text-sm">{result}</p>}

        {!walletClient ? (
          <Button className="w-full" onClick={onNeedConnect}>
            连接钱包
          </Button>
        ) : !approved ? (
          <Button
            className="w-full"
            variant="secondary"
            onClick={handleApprove}
            disabled={approving}
          >
            {approving
              ? "等待签名…"
              : `授权 builder fee（最高 ${BUILDER_MAX_FEE_RATE}）`}
          </Button>
        ) : (
          <Button
            className={`w-full ${
              sideIndex === 0
                ? "bg-emerald-600 hover:bg-emerald-500"
                : "bg-rose-600 hover:bg-rose-500 text-white"
            }`}
            onClick={handleSubmit}
            disabled={pending || !price || !size}
          >
            {pending ? "签名并提交中…" : `买入 ${side?.name ?? ""}`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
