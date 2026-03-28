"use client";

import { BASESCAN_TX_URL } from "@/lib/web3/config";
import { ExternalLink, ShieldCheck } from "lucide-react";

interface ProofBadgeProps {
  txHash: string;
  analyzedAt: string;
}

function shortenHash(hash: string): string {
  if (!hash || hash.length < 10) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

export function ProofBadge({ txHash, analyzedAt }: ProofBadgeProps) {
  if (!txHash) return null;

  return (
    <div className="flex flex-col gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
          Verified by OpenGradient TEE
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span>On-chain proof:</span>
        <a
          href={BASESCAN_TX_URL(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-blue-600 hover:underline"
        >
          {shortenHash(txHash)}
          <ExternalLink className="h-3 w-3" />
        </a>
        <span>·</span>
        <span>Base Sepolia</span>
        <span>·</span>
        <span>INDIVIDUAL_FULL</span>
      </div>

      <p className="text-xs text-muted-foreground">
        This verdict was cryptographically recorded on-chain on{" "}
        {new Date(analyzedAt).toLocaleDateString()}. The input and output hashes
        are immutable — this result cannot be retroactively altered.
      </p>
    </div>
  );
}
