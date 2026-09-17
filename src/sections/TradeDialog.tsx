import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  placeOutcomeOrder,
  outcomeAssetId,
  type OutcomeMarket,
} from "@/lib/hyperliquid";
import { BUILDER_FEE_TENTHS_BPS } from "@/config";
import type { WalletClient } from "viem";

interface TradeDialogProps {
  market: OutcomeMarket | null;
  sideIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletClient: WalletClient | null;
  approved: boolean;
  onNeedConnect: () => void;
  /** 当前中间价（有实时行情时用于预填限价） */
  suggestedPrice?: number | null;
}

export default function TradeDialog({
  market,
  sideIndex,
  open,
  onOpenChange,
  walletClient,
  approved,
  onNeedConnect,
  suggestedPrice,
}: TradeDialogProps) {
  const [price, setPrice] = useState("0.50");
  const [size, setSize] = useState("10");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // 打开弹窗时用实时中间价预填限价
  useEffect(() => {
    if (open && suggestedPrice !== null && suggestedPrice !== undefined) {
      setPrice(suggestedPrice.toFixed(3));
    }
  }, [open, suggestedPrice]);

  const side = market?.sideSpecs[sideIndex];
  const feePct = BUILDER_FEE_TENTHS_BPS / 1000; // tenths-of-bps → %

  const notional = useMemo(() => {
    const p = parseFloat(price);
    const s = parseFloat(size);
    return Number.isFinite(p) && Number.isFinite(s) ? p * s : 0;
  }, [price, size]);

  if (!market || !side) return null;

  const canTrade = walletClient && approved;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{market.questionName ?? market.name}</DialogTitle>
          <DialogDescription>
            买入 {side.name} · 以 {market.quoteToken} 报价 · 价格 0~1
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="price">价格（每张合约）</Label>
            <Input
              id="price"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="size">数量（张）</Label>
            <Input
              id="size"
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
              <span>{notional.toFixed(2)} {market.quoteToken}</span>
            </div>
            <div className="flex justify-between">
              <span>builder fee（{feePct.toFixed(2)}%）</span>
              <span>{(notional * (feePct / 100)).toFixed(4)} {market.quoteToken}</span>
            </div>
            <div className="mt-1 text-xs">
              最大亏损 = 买入成本；合约到期按 0 或 1 结算
            </div>
          </div>

          {result && <p className="text-sm">{result}</p>}

          {!walletClient ? (
            <Button onClick={onNeedConnect}>先连接钱包</Button>
          ) : !approved ? (
            <Button disabled variant="secondary">
              请先在页面上方完成 builder fee 授权
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!canTrade || pending}>
              {pending ? "签名并提交中…" : `买入 ${side.name}`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
