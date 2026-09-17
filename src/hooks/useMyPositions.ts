/**
 * 用户持仓 + 挂单 hook：连接钱包后加载，15 秒轮询 + 支持手动刷新
 */
import { useCallback, useEffect, useState } from "react";
import {
  fetchOutcomePositions,
  fetchOutcomeOpenOrders,
  type OutcomeMarket,
  type OutcomePosition,
  type OutcomeOpenOrder,
} from "@/lib/hyperliquid";

export function useMyPositions(
  address: `0x${string}` | null,
  markets: OutcomeMarket[],
  enabled: boolean,
) {
  const [positions, setPositions] = useState<OutcomePosition[]>([]);
  const [openOrders, setOpenOrders] = useState<OutcomeOpenOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address || !enabled || markets.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const [pos, ord] = await Promise.all([
        fetchOutcomePositions(address, markets),
        fetchOutcomeOpenOrders(address, markets),
      ]);
      setPositions(pos);
      setOpenOrders(ord);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载持仓失败");
    } finally {
      setLoading(false);
    }
  }, [address, markets, enabled]);

  useEffect(() => {
    setPositions([]);
    setOpenOrders([]);
    refresh();
    if (!address || !enabled) return;
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [refresh, address, enabled]);

  return { positions, openOrders, loading, error, refresh };
}
