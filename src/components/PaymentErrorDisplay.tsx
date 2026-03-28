"use client";

import { Button } from "@/components/ui/button";

type PaymentErrorCode =
  | "NOT_CONNECTED"
  | "INSUFFICIENT_OPG"
  | "TX_FAILED"
  | "PAYMENT_TIMEOUT"
  | "UNKNOWN";

interface PaymentErrorDisplayProps {
  code: PaymentErrorCode;
  message?: string;
  onRetry?: () => void;
}

const OPG_FAUCET_URL = "https://faucet.opengradient.ai/";

export function PaymentErrorDisplay({ code, message, onRetry }: PaymentErrorDisplayProps) {
  const title = {
    NOT_CONNECTED: "Wallet not connected",
    INSUFFICIENT_OPG: "Insufficient OPG balance",
    TX_FAILED: "Payment transaction failed",
    PAYMENT_TIMEOUT: "Payment timed out",
    UNKNOWN: "Payment error",
  }[code];

  const description = {
    NOT_CONNECTED: "Connect your MetaMask wallet to Base Sepolia to pay for analysis.",
    INSUFFICIENT_OPG: "You need OPG tokens on Base Sepolia to use this service.",
    TX_FAILED: message ?? "The on-chain transaction failed. Your wallet was not charged.",
    PAYMENT_TIMEOUT: "The payment request timed out. Please try again.",
    UNKNOWN: message ?? "An unexpected payment error occurred.",
  }[code];

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3 dark:border-red-800 dark:bg-red-950">
      <p className="font-semibold text-red-800 dark:text-red-200">{title}</p>
      <p className="text-sm text-red-700 dark:text-red-300">{description}</p>

      <div className="flex gap-2 flex-wrap items-center">
        {code === "INSUFFICIENT_OPG" && (
          <a
            href={OPG_FAUCET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 underline"
          >
            Get OPG tokens from faucet →
          </a>
        )}
        {onRetry && code !== "NOT_CONNECTED" && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
