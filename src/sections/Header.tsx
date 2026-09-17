import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SITE_NAME, BUILDER_FEE_TENTHS_BPS, IS_TESTNET } from "@/config";

interface HeaderProps {
  address: `0x${string}` | null;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Header({
  address,
  connecting,
  onConnect,
  onDisconnect,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold tracking-tight">
            outcomes<span className="text-emerald-400">.xyz</span>
          </span>
          <Badge variant="secondary" className="text-xs">
            HIP-4 on Hyperliquid
          </Badge>
          {IS_TESTNET && <Badge variant="destructive">TESTNET</Badge>}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground sm:block">
            builder fee {(BUILDER_FEE_TENTHS_BPS / 10).toFixed(0)} bps
          </span>
          {address ? (
            <Button variant="outline" size="sm" onClick={onDisconnect}>
              {short(address)}
            </Button>
          ) : (
            <Button size="sm" onClick={onConnect} disabled={connecting}>
              {connecting ? "连接中…" : "连接钱包"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export { SITE_NAME };
