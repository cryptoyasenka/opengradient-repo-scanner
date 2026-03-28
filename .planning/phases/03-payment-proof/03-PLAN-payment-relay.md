---
id: "03-2"
title: "x402 Payment Relay: server-side @x402/fetch wrapping /api/analyze"
wave: 2
depends_on:
  - "03-1"
files_modified:
  - src/app/api/analyze/route.ts
  - src/lib/opengradient.ts
autonomous: true
requirements_addressed:
  - PAY-02
  - PAY-03
  - PROOF-01
  - UI-05

must_haves:
  truths:
    - "POST /api/analyze calls OpenGradient via @x402/fetch with X-SETTLEMENT-TYPE: individual"
    - "The route uses APP_WALLET_PRIVATE_KEY from env to sign the x402 payment server-side"
    - "The X-PAYMENT-RESPONSE header value is extracted and returned in the API response JSON"
    - "The route returns { verdict, score, categories, top_findings, reasoning, txHash } on success"
    - "The route throws a clear error if APP_WALLET_PRIVATE_KEY is missing from env"
    - "maxDuration = 30 is set on the route to handle slow TEE inference"
  artifacts:
    - path: "src/app/api/analyze/route.ts"
      provides: "POST handler using @x402/fetch to call OpenGradient with INDIVIDUAL_FULL settlement"
      contains: "X-SETTLEMENT-TYPE"
    - path: "src/lib/opengradient.ts"
      provides: "createX402Fetch() factory + callOpenGradient() that returns verdict + txHash"
      contains: "wrapFetch"
  key_links:
    - from: "src/app/api/analyze/route.ts"
      to: "src/lib/opengradient.ts"
      via: "callOpenGradient import"
      pattern: "import.*callOpenGradient.*from.*opengradient"
    - from: "src/lib/opengradient.ts"
      to: "https://llm.opengradient.ai/v1/chat/completions"
      via: "@x402/fetch wrapFetch"
      pattern: "wrapFetch"
---

<objective>
Update the `/api/analyze` route to use `@x402/fetch` with a server-side app wallet for payment. The route accepts repo data already fetched by the client, calls OpenGradient with `X-SETTLEMENT-TYPE: individual`, and returns the AI verdict plus the transaction hash from the `X-PAYMENT-RESPONSE` header.

Purpose: This is the core payment integration. The app wallet (not the user's wallet) signs and pays for each inference. The user's wallet is shown in the UI via RainbowKit (Plan 03-1) as a trust/identity signal, but the actual x402 payment is handled server-side.
Output: A working `/api/analyze` POST route that calls OpenGradient under x402 and returns a verified verdict with txHash.
</objective>

<execution_context>
@C:/Users/Yana/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Yana/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/research/STACK.md
@.planning/research/ARCHITECTURE.md
@.planning/research/PITFALLS.md
@.planning/research/FEATURES.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create opengradient.ts server library with @x402/fetch</name>

  <read_first>
    - .planning/research/STACK.md (complete @x402/fetch wrapFetch pattern with privateKeyToAccount, ExactEvmScheme, baseSepolia chain definition)
    - .planning/research/FEATURES.md (AI prompt structure, output schema, recommended model openai/gpt-4o)
    - src/lib/web3/config.ts (OPG_TOKEN_ADDRESS constant — do not duplicate)
  </read_first>

  <files>
    src/lib/opengradient.ts
  </files>

  <action>
Create `src/lib/opengradient.ts` as a server-only module. This file MUST start with `import "server-only"` to prevent accidental client bundle inclusion.

```typescript
import "server-only";
import { wrapFetch } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Base Sepolia chain definition (inline — viem/chains/baseSepolia may not export correctly in all versions)
const baseSepolia = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.base.org"] } },
} as const;

const OPENGRADIENT_URL = "https://llm.opengradient.ai/v1/chat/completions";
const MODEL = "openai/gpt-4o";

// AI verdict output schema (must match FEATURES.md spec)
export interface AnalysisResult {
  overall_score: number;
  verdict: "Safe" | "Risky" | "Dangerous";
  categories: Record<string, { risk_level: string; findings: string }>;
  top_findings: string[];
  reasoning: string;
}

export interface AnalysisResponse {
  result: AnalysisResult;
  txHash: string | null;
  rawPaymentResponse: string | null;
}

function buildSystemPrompt(): string {
  return `You are a supply chain security analyst specializing in malicious GitHub repositories.
Analyze the following repository data for security risks.

ANALYZE THESE SPECIFIC SIGNAL CATEGORIES IN ORDER:
1. ACCOUNT CREDIBILITY: Owner account age, number of repos, followers
2. REPOSITORY CREDIBILITY: Repo age, stars, license, description quality
3. PACKAGE MANIFEST RISKS: postinstall hooks, suspicious scripts, typosquatting names
4. CODE BEHAVIOR RISKS: base64 decode+exec, network calls in install scripts, obfuscation
5. COMMIT INTEGRITY: Commit frequency, author consistency, suspicious timing patterns
6. README RED FLAGS: External payment links, piracy claims, unrealistic promises
7. GITHUB ACTIONS RISKS: External fetches, base64 commands, mutable action tags, secret logging

For each category, provide:
- findings: specific evidence found (or "none found")
- risk_level: none | low | medium | high | critical

Then provide:
- overall_score: integer 0-100 (0=completely safe, 100=confirmed malicious)
- verdict: "Safe" | "Risky" | "Dangerous"
- top_findings: array of 3-5 most important findings, each as one sentence
- reasoning: 2-3 sentence explanation of the verdict

SCORING GUIDE:
- 0-30: Safe — typical open source project, no red flags
- 31-65: Risky — some concerning signals, use with caution, investigate further
- 66-100: Dangerous — clear malicious indicators, do not install

Respond ONLY with valid JSON matching this schema. No markdown, no explanation outside JSON.`;
}

export async function callOpenGradient(
  repoDataBundle: unknown
): Promise<AnalysisResponse> {
  const privateKey = process.env.APP_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "APP_WALLET_PRIVATE_KEY is not set. Add it to .env.local with a funded Base Sepolia wallet."
    );
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  const x402Fetch = wrapFetch(fetch, {
    schemes: [
      {
        network: "eip155:84532",
        client: new ExactEvmScheme(walletClient),
      },
    ],
  });

  const response = await x402Fetch(OPENGRADIENT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SETTLEMENT-TYPE": "individual",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        {
          role: "user",
          content: `Analyze this repository:\n\n${JSON.stringify(repoDataBundle, null, 2)}`,
        },
      ],
      max_tokens: 1200,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `OpenGradient returned ${response.status}: ${errorBody.slice(0, 200)}`
    );
  }

  // Extract on-chain proof from response header
  const rawPaymentResponse = response.headers.get("X-PAYMENT-RESPONSE");
  let txHash: string | null = null;

  if (rawPaymentResponse) {
    try {
      // X-PAYMENT-RESPONSE is base64-encoded JSON with { txHash, ... }
      const decoded = JSON.parse(
        Buffer.from(rawPaymentResponse, "base64").toString("utf-8")
      );
      txHash = decoded.txHash ?? decoded.transaction_hash ?? null;
    } catch {
      // Header exists but couldn't parse — log and continue without txHash
      console.warn("Could not parse X-PAYMENT-RESPONSE header:", rawPaymentResponse.slice(0, 100));
    }
  }

  const body = await response.json();
  const rawContent = body?.choices?.[0]?.message?.content ?? "";

  let result: AnalysisResult;
  try {
    result = JSON.parse(rawContent);
  } catch {
    throw new Error(
      `OpenGradient returned non-JSON content: ${rawContent.slice(0, 300)}`
    );
  }

  return { result, txHash, rawPaymentResponse };
}
```
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>

  <acceptance_criteria>
    - `src/lib/opengradient.ts` exists and starts with `import "server-only"`
    - File contains `wrapFetch` from `@x402/fetch`
    - File contains `ExactEvmScheme` from `@x402/evm/exact/client`
    - File contains `"X-SETTLEMENT-TYPE": "individual"`
    - File contains `X-PAYMENT-RESPONSE` header extraction
    - File exports `callOpenGradient` function
    - File exports `AnalysisResult` and `AnalysisResponse` interfaces
    - `npx tsc --noEmit` reports no errors in this file
  </acceptance_criteria>

  <done>opengradient.ts server library created with full @x402/fetch payment flow and on-chain proof extraction.</done>
</task>

<task type="auto">
  <name>Task 2: Update /api/analyze route to use callOpenGradient</name>

  <read_first>
    - src/app/api/analyze/route.ts (current state from Phase 2 — read carefully before modifying)
    - src/lib/opengradient.ts (just created — callOpenGradient signature and AnalysisResponse type)
    - .planning/research/ARCHITECTURE.md (maxDuration = 30, dynamic = force-dynamic pattern; env var warning pattern)
    - .planning/research/PITFALLS.md (Pitfall 3: payment-before-service race; Pitfall 11: 10s timeout)
  </read_first>

  <files>
    src/app/api/analyze/route.ts
  </files>

  <action>
Read the existing `src/app/api/analyze/route.ts` fully before editing. The Phase 2 route calls OpenGradient directly without payment. Replace that call with `callOpenGradient`.

The updated route must:
1. Keep all existing request parsing and validation logic
2. Keep the GitHub repo data assembly (or import from existing lib — do not duplicate)
3. Replace the direct OpenGradient fetch with `callOpenGradient(repoDataBundle)`
4. Return `txHash` from the response in the JSON body

Add these route-level config exports at the top of the file (below imports, before the handler):

```typescript
export const maxDuration = 30; // seconds — Vercel Fluid Compute (handles slow TEE inference)
export const dynamic = "force-dynamic"; // never cache POST responses
```

The route handler should follow this structure:

```typescript
import { callOpenGradient } from "@/lib/opengradient";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Env check at top of handler (not module scope — Next.js 15 env bug mitigation)
  if (!process.env.APP_WALLET_PRIVATE_KEY) {
    return Response.json(
      { error: "Server misconfiguration: APP_WALLET_PRIVATE_KEY not set" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const { repo } = body; // repo = "owner/repo" string

    if (!repo || typeof repo !== "string") {
      return Response.json({ error: "repo field is required" }, { status: 400 });
    }

    // --- KEEP EXISTING GITHUB DATA FETCHING LOGIC HERE ---
    // (copy/preserve from Phase 2 route — do not change this section)
    const repoDataBundle = /* existing github fetch result */ {};

    // --- REPLACE: call OpenGradient with x402 payment ---
    const { result, txHash, rawPaymentResponse } = await callOpenGradient(repoDataBundle);

    return Response.json({
      verdict: result.verdict,
      score: result.overall_score,
      categories: result.categories,
      top_findings: result.top_findings,
      reasoning: result.reasoning,
      txHash,          // null if settlement header not present
      rawPaymentResponse, // null if not present
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[/api/analyze] Error:", message);

    // Distinguish payment failure from analysis failure
    if (message.includes("402") || message.includes("payment")) {
      return Response.json(
        { error: "Payment failed. Check APP_WALLET_PRIVATE_KEY has sufficient OPG balance.", code: "PAYMENT_FAILED" },
        { status: 402 }
      );
    }

    return Response.json(
      { error: message, code: "ANALYSIS_FAILED" },
      { status: 500 }
    );
  }
}
```

If `src/app/api/analyze/route.ts` does not exist yet (Phase 2 not run), create the full file combining the GitHub fetch logic from Phase 2 plan specs with the above payment wrapper. Reference `.planning/phases/02-ai-analysis/` plan files if available.
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>

  <acceptance_criteria>
    - `src/app/api/analyze/route.ts` contains `export const maxDuration = 30`
    - `src/app/api/analyze/route.ts` contains `export const dynamic = "force-dynamic"`
    - `src/app/api/analyze/route.ts` contains `import.*callOpenGradient.*from.*opengradient`
    - `src/app/api/analyze/route.ts` contains `APP_WALLET_PRIVATE_KEY` env check
    - `src/app/api/analyze/route.ts` returns `txHash` in the response JSON
    - `src/app/api/analyze/route.ts` has a 402 payment error case returning `code: "PAYMENT_FAILED"`
    - `npx tsc --noEmit` exits with no errors
    - `npm run build` exits 0
  </acceptance_criteria>

  <done>/api/analyze route updated to use @x402/fetch relay. Returns verdict + txHash from on-chain settlement. maxDuration = 30 prevents Vercel timeout. PAYMENT_FAILED error code enables client-side error handling in Plan 03-4.</done>
</task>

</tasks>

<verification>
After both tasks:
1. `npx tsc --noEmit` exits 0
2. `npm run build` exits 0
3. `grep "X-SETTLEMENT-TYPE" src/lib/opengradient.ts` returns `"individual"`
4. `grep "maxDuration" src/app/api/analyze/route.ts` returns `export const maxDuration = 30`
5. `grep "server-only" src/lib/opengradient.ts` returns match (prevents client bundle inclusion)
</verification>

<success_criteria>
- opengradient.ts: server-only module with wrapFetch, ExactEvmScheme, and X-SETTLEMENT-TYPE: individual
- opengradient.ts: extracts txHash from X-PAYMENT-RESPONSE header
- /api/analyze route: uses callOpenGradient, returns txHash in response
- /api/analyze route: maxDuration = 30, force-dynamic, env check, payment error code
- TypeScript compiles cleanly across both files
</success_criteria>

<output>
After completion, create `.planning/phases/03-payment-proof/03-2-SUMMARY.md` with:
- Confirmation that @x402/fetch pattern from STACK.md was followed
- Actual X-PAYMENT-RESPONSE header structure observed (if testable)
- Any @x402 package import path corrections needed (e.g., if ExactEvmScheme path differs)
- TypeScript compiler output confirming no errors
- Any deviations from planned implementation
</output>
