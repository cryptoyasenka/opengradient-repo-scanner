---
id: "03-3"
title: "On-chain proof badge + payment error handling"
wave: 3
depends_on: ["03-1", "03-2"]
files_modified:
  - src/components/ProofBadge.tsx
  - src/components/PaymentErrorDisplay.tsx
  - src/app/page.tsx
autonomous: false
requirements_addressed:
  - PROOF-01
  - PROOF-02
  - PROOF-03
  - PAY-04
  - PAY-05

must_haves:
  truths:
    - "After payment succeeds, a transaction hash badge is visible on the result"
    - "Clicking the badge opens the Basescan link in a new tab"
    - "A 'Verified by OpenGradient TEE' badge appears alongside the verdict"
    - "If user is not connected, a 'Connect wallet to analyze' prompt appears"
    - "If OPG balance is insufficient, a faucet link is shown"
    - "If payment transaction fails, a clear error message explains what happened"
  artifacts:
    - path: "src/components/ProofBadge.tsx"
      provides: "On-chain proof display with tx hash + Basescan link + TEE badge"
      exports: ["ProofBadge"]
    - path: "src/components/PaymentErrorDisplay.tsx"
      provides: "Payment-specific error states with recovery actions"
      exports: ["PaymentErrorDisplay"]
---

<objective>
Build the on-chain proof display (ProofBadge) and payment error handling (PaymentErrorDisplay). These complete Phase 3's core value proposition: users see cryptographic proof that the AI verdict is real and unmodified.
</objective>

<execution_context>
@C:/Users/Yana/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Yana/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/research/STACK.md
@.planning/research/ARCHITECTURE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create ProofBadge component</name>

  <read_first>
    - src/lib/web3/config.ts (BASESCAN_TX_URL helper — use this, don't hardcode URL pattern)
    - .planning/research/STACK.md (X-PAYMENT-RESPONSE contains txHash, block, settlementType)
  </read_first>

  <files>src/components/ProofBadge.tsx</files>

  <action>
Create `src/components/ProofBadge.tsx`:

```tsx
"use client";

import { BASESCAN_TX_URL } from "@/lib/web3/config";
import { Badge } from "@/components/ui/badge";
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
    <div className="flex flex-col gap-2 rounded-md border border-blue-200 bg-blue-50 p-3">
      {/* TEE verification badge */}
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-blue-600" />
        <span className="text-sm font-medium text-blue-800">
          Verified by OpenGradient TEE
        </span>
      </div>

      {/* Transaction hash */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
        <span className="text-muted-foreground">·</span>
        <span>Base Sepolia</span>
        <span className="text-muted-foreground">·</span>
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
```
  </action>

  <acceptance_criteria>
    - `src/components/ProofBadge.tsx` exists and exports `ProofBadge`
    - File uses `BASESCAN_TX_URL` from `@/lib/web3/config`
    - File contains "Verified by OpenGradient TEE" text
    - File contains `shortenHash` function
    - File renders `null` when txHash is empty
    - File opens Basescan link with `target="_blank"`
  </acceptance_criteria>

  <done>ProofBadge shows TEE verification badge, shortened tx hash with Basescan link, and explanation text.</done>
</task>

<task type="auto">
  <name>Task 2: Create PaymentErrorDisplay + wire ProofBadge into page</name>

  <read_first>
    - src/app/page.tsx (current state — find where VerdictDisplay is rendered and where errors are shown)
    - src/components/VerdictDisplay.tsx (understand how to add ProofBadge alongside it)
    - .planning/research/PITFALLS.md (Pitfall 3 — delivery failure after payment)
  </read_first>

  <files>src/components/PaymentErrorDisplay.tsx, src/app/page.tsx</files>

  <action>
**Step 1: Create `src/components/PaymentErrorDisplay.tsx`**

```tsx
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
  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-4 space-y-3">
      <p className="font-semibold text-red-800">
        {code === "NOT_CONNECTED" && "Wallet not connected"}
        {code === "INSUFFICIENT_OPG" && "Insufficient OPG balance"}
        {code === "TX_FAILED" && "Payment transaction failed"}
        {code === "PAYMENT_TIMEOUT" && "Payment timed out"}
        {code === "UNKNOWN" && "Payment error"}
      </p>

      <p className="text-sm text-red-700">
        {code === "NOT_CONNECTED" && "Connect your MetaMask wallet to Base Sepolia to pay for analysis."}
        {code === "INSUFFICIENT_OPG" && "You need OPG tokens on Base Sepolia to use this service."}
        {code === "TX_FAILED" && (message ?? "The on-chain transaction failed. Your wallet was not charged.")}
        {code === "PAYMENT_TIMEOUT" && "The payment request timed out. Please try again."}
        {code === "UNKNOWN" && (message ?? "An unexpected payment error occurred.")}
      </p>

      <div className="flex gap-2">
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
```

**Step 2: Add txHash state and ProofBadge to page.tsx**

In `src/app/page.tsx`:
1. Add state: `const [txHash, setTxHash] = useState<string>("")`
2. After successful `/api/analyze` response, extract txHash if present:
   ```typescript
   // The analyze route returns txHash in the response (added in Phase 3's 03-PLAN-payment-relay)
   if (verdict.txHash) setTxHash(verdict.txHash);
   ```
3. In the DONE state JSX, render ProofBadge after VerdictDisplay:
   ```tsx
   {txHash && (
     <ProofBadge txHash={txHash} analyzedAt={verdictResult.analyzedAt} />
   )}
   ```
4. Add imports:
   ```typescript
   import { ProofBadge } from "@/components/ProofBadge";
   import { PaymentErrorDisplay } from "@/components/PaymentErrorDisplay";
   ```

Note: PaymentErrorDisplay is used in Phase 3's payment flow. Wire it to show when the analyze API returns a payment-specific error code (look for `code: "PAYMENT_*"` in the error response).
  </action>

  <acceptance_criteria>
    - `src/components/PaymentErrorDisplay.tsx` exists and exports `PaymentErrorDisplay`
    - File contains `OPG_FAUCET_URL = "https://faucet.opengradient.ai/"`
    - File handles NOT_CONNECTED / INSUFFICIENT_OPG / TX_FAILED codes with distinct messages
    - `src/app/page.tsx` imports `ProofBadge`
    - `src/app/page.tsx` renders `ProofBadge` when txHash is present
    - `npm run build` exits 0
  </acceptance_criteria>

  <human_verification>
    1. Complete a payment flow on Base Sepolia
    2. Confirm ProofBadge appears below the verdict with a clickable tx hash
    3. Confirm Basescan link opens the correct transaction
    4. Test error states: disconnect wallet → NOT_CONNECTED message appears
    5. Test faucet link shows for INSUFFICIENT_OPG
  </human_verification>

  <done>ProofBadge renders on-chain proof. PaymentErrorDisplay handles all payment failure modes with recovery actions.</done>
</task>

</tasks>

<success_criteria>
- ProofBadge shows tx hash, Basescan link, TEE badge, INDIVIDUAL_FULL settlement type
- ProofBadge returns null when no txHash (no visual clutter in Phase 2 testing)
- PaymentErrorDisplay covers all 4 error codes with distinct recovery actions
- OPG faucet link shown for insufficient balance
- npm run build exits 0
</success_criteria>

<output>
After completion, create `.planning/phases/03-payment-proof/03-3-SUMMARY.md`
</output>
