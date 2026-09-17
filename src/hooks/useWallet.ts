/**
 * 浏览器钱包连接（EIP-1193，MetaMask / Rabby / OKX 等注入钱包）
 * 用 viem 的 WalletClient，直接传给 @nktkas/hyperliquid 的 ExchangeClient 签名。
 */
import { useCallback, useEffect, useState } from "react";
import { createWalletClient, custom, type WalletClient } from "viem";
import { mainnet } from "viem/chains";

interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

export function useWallet() {
  const [address, setAddress] = useState<`0x${string}` | null>(null);
  const [walletClient, setWalletClient] = useState<WalletClient | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    setError(null);
    if (!window.ethereum) {
      setError("未检测到钱包，请安装 MetaMask / Rabby 等浏览器钱包");
      return;
    }
    setConnecting(true);
    try {
      const client = createWalletClient({
        chain: mainnet,
        transport: custom(window.ethereum!),
      });
      const [addr] = await client.requestAddresses();
      setWalletClient(client);
      setAddress(addr as `0x${string}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接钱包失败");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setWalletClient(null);
  }, []);

  // 监听账户切换
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider?.on) return;
    const handler = (accounts: unknown) => {
      const list = accounts as string[];
      setAddress(list.length > 0 ? (list[0] as `0x${string}`) : null);
    };
    provider.on("accountsChanged", handler);
  }, []);

  return { address, walletClient, connecting, error, connect, disconnect };
}
