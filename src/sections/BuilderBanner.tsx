import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { approveBuilderFee } from "@/lib/hyperliquid";
import { BUILDER_MAX_FEE_RATE } from "@/config";
import type { WalletClient } from "viem";

interface BuilderBannerProps {
  walletClient: WalletClient | null;
  approved: boolean;
  onApproved: () => void;
}

/**
 * Builder Code 授权横幅：
 * 用户首次交易前，需要主钱包签名 ApproveBuilderFee，
 * 授权 outcomes.xyz 在你的订单上收取最高 BUILDER_MAX_FEE_RATE 的 builder fee。
 */
export default function BuilderBanner({
  walletClient,
  approved,
  onApproved,
}: BuilderBannerProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!walletClient || approved) return null;

  const handleApprove = async () => {
    setPending(true);
    setError(null);
    try {
      await approveBuilderFee(walletClient);
      onApproved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "授权失败");
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <p className="font-medium">需要一次性授权才能开始交易</p>
          <p className="text-muted-foreground">
            签名 ApproveBuilderFee，允许 outcomes.xyz 在你的成交订单上收取最高{" "}
            {BUILDER_MAX_FEE_RATE} 的 builder fee（链上执行，可随时在
            Hyperliquid 撤销）。
          </p>
          {error && <p className="mt-1 text-destructive">{error}</p>}
        </div>
        <Button onClick={handleApprove} disabled={pending} className="shrink-0">
          {pending ? "等待签名…" : "签名授权"}
        </Button>
      </CardContent>
    </Card>
  );
}
