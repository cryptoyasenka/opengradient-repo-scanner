# Technology Stack

**Project:** GitHub Security Checker
**Researched:** 2026-03-28
**Overall confidence:** MEDIUM-HIGH (core flow verified via official docs; some browser-specific x402 patterns are LOW confidence — only one primary example found)

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x | Full-stack React framework | App Router, API routes, Vercel-native, SSR + client components cleanly separated |
| React | 19.x | UI rendering | Ships with Next.js 15 |
| TypeScript | 5.x | Type safety | Required for reliable wagmi/viem integration |
| Tailwind CSS | v4 | Styling | Bundled with create-next-app; v4 has inline theming, no tailwind.config.ts needed |
| shadcn/ui | latest | Component library | Unstyled Radix primitives + Tailwind; works cleanly with Next.js 15 app router |

### Blockchain / Payments

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| wagmi | v2 | React hooks for wallet state | Industry standard; `useWalletClient`, `useSignTypedData`, SSR-safe |
| viem | v2 | Low-level EVM client | Powers wagmi; used directly to construct EIP-712 typed data for x402 signing |
| @tanstack/react-query | v5 | Async state management | Required peer dep for wagmi v2 |
| RainbowKit | latest | Wallet connection UI | Best-in-class connect button, supports Base Sepolia out of the box |
| @x402/fetch | latest | x402 payment wrapper | Official Coinbase x402 TS package; wraps `fetch` to handle 402 flow automatically |
| @x402/evm | latest | EVM payment scheme | Provides `ExactEvmScheme` — needed to register with `@x402/fetch` for Base Sepolia |
| @x402/core | latest | x402 protocol primitives | Peer dependency of `@x402/fetch` |

### AI Inference

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| OpenGradient x402 Gateway | — | Verifiable LLM inference | `https://llm.opengradient.ai` — OpenAI-compatible HTTP API, TEE-backed, no SDK required |
| OpenGradient Python SDK | — | NOT USED | Python-only; TypeScript SDK still in development as of March 2026 |

### Data Fetching (GitHub)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub REST API | v2022-11-28 | Public repo metadata | No auth required for public repos; `api.github.com` |
| raw.githubusercontent.com | — | Raw file access | Faster for README/package.json than the contents API |

### Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | free tier | Hosting | Zero-config Next.js deploy; edge functions available |

---

## Network & Contract Details

| Parameter | Value | Confidence |
|-----------|-------|------------|
| Chain | Base Sepolia | HIGH — confirmed in API response |
| Chain ID | 84532 | HIGH — confirmed in EIP-712 domain |
| Network ID (x402) | `eip155:84532` | HIGH — confirmed in x402 docs |
| OPG Token Contract | `0x240b09731D96979f50B2C649C9CE10FcF9C7987F` | HIGH — confirmed in API reference response |
| Gateway `payTo` address | `0x339c7de83d1a62edafbaac186382ee76584d294f` | MEDIUM — from API reference sample; verify at runtime from 402 response |
| OPG Faucet | `https://faucet.opengradient.ai/` | HIGH |
| x402 Gateway base URL | `https://llm.opengradient.ai` | HIGH — official docs |

---

## OpenGradient x402 API Reference

### Endpoints

```
POST https://llm.opengradient.ai/v1/chat/completions
POST https://llm.opengradient.ai/v1/completions
```

Both are OpenAI-compatible. The `model` field uses a `provider/model-name` format.

### Request Headers

| Header | Required | Value |
|--------|----------|-------|
| `Content-Type` | Yes | `application/json` |
| `X-PAYMENT` | Conditional | Base64-encoded signed payment payload (added after 402 response) |
| `X-SETTLEMENT-TYPE` | No | `private`, `individual`, or `batch` |

### Settlement Modes (X-SETTLEMENT-TYPE)

| Mode | Header Value | What Happens On-Chain | Best For |
|------|-------------|----------------------|----------|
| PRIVATE | `private` | Payment only — no input/output data | Privacy-sensitive requests |
| INDIVIDUAL_FULL | `individual` | Records full model info, input/output data, timestamp, TEE signature | **Use this** — enables shareable cryptographic proof |
| BATCH_HASHED | `batch` | Merkle tree of hashed inputs/outputs — cheapest | High-volume, cost-sensitive |

**Recommendation for this project:** Use `individual` (INDIVIDUAL_FULL). The whole value proposition is "verifiable, shareable results." The `X-PAYMENT-RESPONSE` header returned on success contains the transaction hash and proof that can be displayed to users.

### Request Body (Chat Completions)

```json
{
  "model": "openai/gpt-4o",
  "messages": [
    { "role": "user", "content": "Analyze this repo..." }
  ],
  "max_tokens": 800,
  "temperature": 0.2
}
```

### Available Models (confirmed from LLM inference docs, March 2026)

Accessed via `provider/model-name` format:

| Provider | Model String |
|----------|-------------|
| OpenAI | `openai/gpt-4o`, `openai/gpt-4.1`, `openai/gpt-5` |
| Anthropic | `anthropic/claude-sonnet-4-5`, `anthropic/claude-haiku-4-5` |
| Google | `google/gemini-2.5-flash`, `google/gemini-2.5-pro` |
| xAI | `x-ai/grok-4` |

**Recommended pair for parallel analysis:** `openai/gpt-4o` + `anthropic/claude-haiku-4-5`
- GPT-4o: strong at structured security reasoning
- Claude Haiku: fast, good at code pattern recognition
- Both return quickly; using Haiku (not Sonnet/Opus) keeps cost low

---

## x402 Payment Flow

The x402 protocol is a 4-step challenge-response over HTTP. `@x402/fetch` automates steps 2-4.

### Manual Flow (for understanding)

```
Step 1: Client sends request without payment
  POST https://llm.opengradient.ai/v1/chat/completions
  { "model": "...", "messages": [...] }

Step 2: Server responds 402 with X-PAYMENT-REQUIRED header
  X-PAYMENT-REQUIRED: base64({ scheme, network, maxAmountRequired, resource, payTo, asset })
  {
    "scheme": "exact",
    "network": "eip155:84532",
    "maxAmountRequired": "1000000",    // in OPG token units (18 decimals)
    "resource": "https://llm.opengradient.ai/v1/chat/completions",
    "payTo": "0x339c7de83d1a62edafbaac186382ee76584d294f",
    "asset": "0x240b09731D96979f50B2C649C9CE10FcF9C7987F"
  }

Step 3: Client signs EIP-712 TransferWithAuthorization
  Domain: { name: "OPG", version: "1", chainId: 84532, verifyingContract: "0x240b..." }
  Types: TransferWithAuthorization { from, to, value, validAfter, validBefore, nonce }
  Value: { from: userAddr, to: payTo, value: maxAmountRequired, validAfter: 0,
           validBefore: Math.floor(Date.now()/1000) + 300, nonce: randomBytes32 }

Step 4: Client resubmits with X-PAYMENT header
  X-PAYMENT: base64({ payload: { signature, authorization } })

Step 5: Server returns 200 with X-PAYMENT-RESPONSE header
  X-PAYMENT-RESPONSE contains: { txHash, block, payer, settlementType }
```

### Automated Flow with @x402/fetch (Server-Side / Node.js)

This is the confirmed pattern from OpenGradient official docs. Works in Node.js (Next.js API routes, server actions).

```typescript
import { wrapFetch } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const baseSepolia = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.base.org"] } },
};

// SERVER-SIDE: use a funded app wallet private key from env
const account = privateKeyToAccount(process.env.APP_WALLET_KEY as `0x${string}`);
const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(),
});

const x402Fetch = wrapFetch(fetch, {
  schemes: [
    { network: "eip155:84532", client: new ExactEvmScheme(walletClient) },
  ],
});

// Make a paid inference request
const response = await x402Fetch(
  "https://llm.opengradient.ai/v1/chat/completions",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SETTLEMENT-TYPE": "individual",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: "Analyze this repo..." }],
      max_tokens: 800,
    }),
  }
);

// Extract proof from response
const paymentResponse = response.headers.get("X-PAYMENT-RESPONSE");
const result = await response.json();
```

### Browser / User-Pays Pattern (LOW confidence — inferred from x402 spec + wagmi)

The documentation shows a private-key pattern above. For a browser dapp where the **user's wallet pays directly**, the approach must be adapted. The `@x402/fetch` wrapper supports a custom wallet client, so wagmi's `useWalletClient` can supply the signer:

```typescript
// In a React component:
import { useWalletClient } from "wagmi";
import { wrapFetch } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm/exact/client";

export function useX402Fetch() {
  const { data: walletClient } = useWalletClient();

  if (!walletClient) return null;

  return wrapFetch(fetch, {
    schemes: [
      { network: "eip155:84532", client: new ExactEvmScheme(walletClient) },
    ],
  });
}
```

**Caution:** `@x402/fetch` may not be designed for browser bundling — it depends on Node.js crypto primitives. The safer pattern is a **hybrid architecture**:

1. Browser calls a Next.js API route with the repo URL
2. API route (server-side) has a funded app wallet and makes the x402 payment
3. Result + proof returned to browser

This is simpler to build and avoids browser crypto compatibility issues. The tradeoff: the user pays the app (or the app funds requests), not the gateway directly.

**Architecture decision needed:** Direct user payment (complex, browser x402) vs. app-wallet relay (simple, server-side x402). For MVP, recommend the relay pattern.

---

## Parallel Multi-Model Calls

OpenGradient's gateway is an HTTP API — parallelism is achieved with `Promise.all`. No special multi-provider endpoint is needed.

```typescript
// In the Next.js API route that handles analysis:

const [gptResult, claudeResult] = await Promise.all([
  x402Fetch("https://llm.opengradient.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SETTLEMENT-TYPE": "individual",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o",
      messages: [{ role: "user", content: buildSecurityPrompt(repoData) }],
      max_tokens: 600,
    }),
  }),
  x402Fetch("https://llm.opengradient.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SETTLEMENT-TYPE": "individual",
    },
    body: JSON.stringify({
      model: "anthropic/claude-haiku-4-5",
      messages: [{ role: "user", content: buildSecurityPrompt(repoData) }],
      max_tokens: 600,
    }),
  }),
]);

// Each response has its own X-PAYMENT-RESPONSE header with individual tx hash
const gptProof = gptResult.headers.get("X-PAYMENT-RESPONSE");
const claudeProof = claudeResult.headers.get("X-PAYMENT-RESPONSE");
```

**Note:** Two separate x402 payments will be triggered — one per model call. The app wallet (or user) needs enough OPG balance for both.

---

## GitHub Public API

### Confirmed Endpoints (no authentication required for public repos)

```
# Repository metadata (stars, description, owner, language, last push)
GET https://api.github.com/repos/{owner}/{repo}

# README content (base64-encoded in response)
GET https://api.github.com/repos/{owner}/{repo}/readme

# Specific file (e.g. package.json)
GET https://api.github.com/repos/{owner}/{repo}/contents/package.json

# Recent commits (last 10)
GET https://api.github.com/repos/{owner}/{repo}/commits?per_page=10

# Contributors
GET https://api.github.com/repos/{owner}/{repo}/contributors?per_page=10
```

### Faster Raw File Access

For known files, skip the contents API and use raw.githubusercontent.com directly — no rate limit headers in response, faster:

```
https://raw.githubusercontent.com/{owner}/{repo}/{branch}/README.md
https://raw.githubusercontent.com/{owner}/{repo}/{branch}/package.json
```

The branch is usually `main` or `master`. Fallback: use the contents API which returns the default branch.

### Rate Limits

| Scenario | Limit | Notes |
|----------|-------|-------|
| Unauthenticated (IP-based) | 60 req/hour | Shared across all users from same server IP — problematic for deployed apps |
| Authenticated (token in header) | 5,000 req/hour | Strongly recommended for production |
| raw.githubusercontent.com | Separate limit, not well-documented | Lower — use sparingly |

**Recommendation:** Add a GitHub Personal Access Token (PAT) as an environment variable. Even a read-only PAT with no scopes raises the limit to 5,000/hour. Add `Authorization: Bearer ${process.env.GITHUB_TOKEN}` header. This is public read-only data — low security risk.

```typescript
const headers: HeadersInit = {
  "Accept": "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};
if (process.env.GITHUB_TOKEN) {
  headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
}
```

### Fetching and Decoding README

The contents API returns base64-encoded content:

```typescript
const response = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/readme`,
  { headers }
);
const data = await response.json();
// data.content is base64 with newlines — clean and decode:
const readme = Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
// Truncate for LLM prompt (first 3000 chars is usually enough)
const readmeSnippet = readme.slice(0, 3000);
```

---

## Installation

### Project Bootstrap

```bash
npx create-next-app@latest github-security-checker \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd github-security-checker
npx shadcn@latest init
```

### Core Dependencies

```bash
# Web3 / payments
npm install wagmi viem @tanstack/react-query @rainbow-me/rainbowkit

# x402 payment protocol
npm install @x402/fetch @x402/evm @x402/core
```

### Dev Dependencies

```bash
npm install -D @types/node
```

### Environment Variables (.env.local)

```bash
# Required: funded wallet private key for server-side x402 payments
APP_WALLET_PRIVATE_KEY=0x...

# Optional but strongly recommended: GitHub PAT (read-only, no scopes needed)
GITHUB_TOKEN=ghp_...

# Required for WalletConnect (get from cloud.walletconnect.com)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=...
```

---

## Next.js App Router Setup for Web3

Key constraint: wagmi uses React context and browser APIs — must be isolated to `"use client"` components.

```typescript
// app/providers.tsx
"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { metaMask, walletConnect } from "wagmi/connectors";
import "@rainbow-me/rainbowkit/styles.css";

const config = createConfig({
  chains: [baseSepolia],
  connectors: [
    metaMask(),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID! }),
  ],
  transports: { [baseSepolia.id]: http() },
  ssr: true, // Required for Next.js SSR compatibility
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

```typescript
// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Wallet UI | RainbowKit | Web3Modal (Reown AppKit) | RainbowKit simpler setup for this scope; both work equally |
| x402 client | `@x402/fetch` | Raw `fetch` with manual EIP-712 | Manual approach is ~100 lines more code with signing bugs risk |
| AI calls | Direct HTTP to gateway | OpenGradient Python SDK | Python SDK not available in TypeScript; Python backend adds infrastructure |
| Styling | Tailwind v4 + shadcn/ui | Tailwind v3 | v4 ships with Next.js 15 by default; no migration needed |
| Settlement | `individual` | `batch` | `batch` saves gas but delays on-chain proof — kills the shareable verdict feature |
| GitHub data | REST API | GraphQL API | REST is simpler for this use case; GraphQL requires more setup for same data |
| Repo hosting | Vercel | Netlify / Fly.io | Vercel is zero-config for Next.js; free tier sufficient |

---

## Sources

- [OpenGradient x402 Upgrade Blog Post](https://www.opengradient.ai/blog/x402-opengradient-upgrade-trustless-verifiable-inference) — MEDIUM confidence (blog, not API reference)
- [OpenGradient Developers Overview](https://docs.opengradient.ai/developers/) — HIGH confidence
- [OpenGradient SDK Docs](https://docs.opengradient.ai/developers/sdk/) — HIGH confidence (TypeScript SDK confirmed "in development")
- [OpenGradient LLM Inference Docs](https://docs.opengradient.ai/developers/sdk/llm.html) — HIGH confidence (settlement modes confirmed)
- [OpenGradient x402 API Reference](https://docs.opengradient.ai/developers/x402/api-reference.html) — HIGH confidence (headers, endpoints, EIP-712 domain confirmed)
- [OpenGradient x402 Examples](https://docs.opengradient.ai/developers/x402/examples) — HIGH confidence (TypeScript wrapFetch example confirmed)
- [OpenGradient GitHub Organization](https://github.com/OpenGradient) — HIGH confidence (repo list confirmed)
- [coinbase/x402 GitHub](https://github.com/coinbase/x402) — HIGH confidence (official protocol repo)
- [@x402/fetch on npm](https://www.npmjs.com/package/@x402/fetch) — HIGH confidence
- [@x402/evm on npm](https://www.npmjs.com/package/@x402/evm) — HIGH confidence
- [x402 Buyer Quickstart (x402.gitbook.io)](https://x402.gitbook.io/x402/getting-started/quickstart-for-buyers) — MEDIUM confidence
- [GitHub REST API — Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) — HIGH confidence
- [GitHub Rate Limit Update May 2025](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/) — HIGH confidence
- [wagmi Getting Started](https://wagmi.sh/react/getting-started) — HIGH confidence
- [RainbowKit Installation](https://rainbowkit.com/en-US/docs/installation) — HIGH confidence
- [shadcn/ui Next.js Installation](https://ui.shadcn.com/docs/installation/next) — HIGH confidence
- [OPG Faucet](https://faucet.opengradient.ai/) — HIGH confidence
