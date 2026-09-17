import { Link } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { OutcomeMarket } from "@/lib/hyperliquid";
import { displayTitle } from "@/lib/outcomeSlug";
import { marketSlugs, type PriceMap } from "@/hooks/useOutcomePrices";

interface MarketCardProps {
  market: OutcomeMarket;
  prices: PriceMap;
  onTrade: (market: OutcomeMarket, sideIndex: number) => void;
}

/** 把 "k:v|k:v" 渲染成可读标签（隐藏 class 字段） */
function parseDescription(desc: string): [string, string][] {
  return desc
    .split("|")
    .map((kv) => {
      const idx = kv.indexOf(":");
      return [kv.slice(0, idx), kv.slice(idx + 1)] as [string, string];
    })
    .filter(([k, v]) => k.length > 0 && v !== undefined && k !== "class");
}

function cents(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${(v * 100).toFixed(1)}¢`;
}

export default function MarketCard({
  market,
  prices,
  onTrade,
}: MarketCardProps) {
  const title = displayTitle(market);
  const fields = parseDescription(market.description);
  const slugs = marketSlugs(market);
  const yesMid = slugs[0] ? prices[slugs[0]]?.mid : null;
  const noMid = slugs[1] ? prices[slugs[1]]?.mid : null;

  return (
    <Card className="flex flex-col transition-colors hover:border-emerald-500/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-base leading-snug">
          <Link
            to={`/market/${market.outcome}`}
            className="hover:text-emerald-400 hover:underline"
          >
            {title}
          </Link>
        </CardTitle>
        {fields.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {fields.map(([k, v]) => (
              <Badge key={k} variant="outline" className="text-xs font-normal">
                {k}: {v}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="mt-auto pt-0">
        <div className="grid grid-cols-2 gap-2">
          {market.sideSpecs.slice(0, 2).map((side, i) => {
            const mid = i === 0 ? yesMid : noMid;
            return (
              <Button
                key={side.name}
                variant={i === 0 ? "default" : "secondary"}
                className={
                  i === 0
                    ? "flex-col h-auto py-2 bg-emerald-600 hover:bg-emerald-500"
                    : "flex-col h-auto py-2 bg-rose-600/80 hover:bg-rose-500 text-white"
                }
                onClick={() => onTrade(market, i)}
              >
                <span>{side.name}</span>
                <span className="text-xs font-normal opacity-80 tabular-nums">
                  {cents(mid)}
                </span>
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          #{market.outcome} · 报价 {market.quoteToken}
          {market.deployer && " · builder 市场"}
        </p>
      </CardContent>
    </Card>
  );
}
