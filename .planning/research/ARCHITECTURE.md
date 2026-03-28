# Architecture Patterns

**Domain:** Single-page Web3 AI analysis tool (GitHub Security Checker)
**Researched:** 2026-03-28
**Overall confidence:** HIGH for Next.js patterns, MEDIUM for x402 flow specifics

---

## Recommended Architecture

### Overview

A single Next.js App Router application deployed to Vercel. The browser handles wallet interactions and drives the UX state machine. Next.js Route Handlers act as a secure proxy/BFF (Backend-for-Frontend) layer for all external API calls. No separate backend. No database. Results are shareable via URL parameters.

```
Browser (React)
  │
  ├─ Wallet (wagmi + viem)          ← x402 payment signing
  │
  ├─ nuqs (URL state)               ← shareable result links
  │
  └─ Next.js Route Handlers (Vercel)
       ├─ /api/analyze              ← orchestrates the full flow
       │     ├─ GitHub API calls    ← fetches repo data
       │     └─ OpenGradient API    ← x402-gated LLM inference
       └─ /api/proof/[txHash]       ← optional: resolve on-chain proof
```

---

## Decision 1: GitHub API — Server-Side (Route Handler), Not Client-Side

**Recommendation: Server-side only (Next.js Route Handler).**

### Why not client-side

- GitHub unauthenticated API is rate-limited at **60 requests/hour per IP**. Client-side calls spend this limit from each user's browser IP — fine for one user, but if you share a link and 10 people load it simultaneously, no GitHub tokens are burned on your server.
- Leaking GitHub Personal Access Token (PAT) in browser code is a critical security risk. If you ever add a PAT to increase rate limits, it must stay server-side.
- CORS is not an issue for GitHub's public API directly, but routing via a Route Handler gives you a free caching layer and hides implementation details.
- Client bundle is smaller: no GitHub SDK shipped to the browser.

### Why server-side wins

- Secret isolation: `GITHUB_TOKEN` (if added later) stays in `process.env`, never in the bundle.
- Easy caching: Route Handlers can cache GitHub responses with `revalidate` to avoid repeated fetches for the same repo. Especially relevant when sharing results.
- Single responsibility: the browser sends one request to `/api/analyze?repo=...` and gets everything back.

### What to fetch via GitHub public API (no auth required)

```
GET /repos/{owner}/{repo}            → stars, forks, last push, open issues, license
GET /repos/{owner}/{repo}/readme     → README content (base64 encoded)
GET /repos/{owner}/{repo}/contents/package.json  → dependencies
GET /repos/{owner}/{repo}/commits?per_page=5     → recent commit authors/messages
GET /repos/{owner}/{repo}/contributors?per_page=5 → contributor count
```

All five calls can run in parallel with `Promise.all` inside the Route Handler.

**Rate limit note:** Unauthenticated limit is 60 req/hour per server IP. On Vercel serverless, IP may rotate between requests. Add `GITHUB_TOKEN` to Vercel env vars from day one (it's free to create) to get 5,000 req/hour. Set it up even before you need it.

---

## Decision 2: OpenGradient API — Server-Side with Client-Signed Payment

**Recommendation: Hybrid — client signs the payment, server executes the inference call.**

This is the architecturally correct split because:
- The user's wallet private key must never leave the browser
- The OpenGradient API key / configuration must never reach the browser
- The x402 payment header is a signed payload the client produces

### x402 Payment Flow (Revised for This Architecture)

The x402 protocol works over standard HTTP. The full flow:

```
1. User clicks "Check Repo"
2. Browser → POST /api/analyze { repo, paymentPayload: null }
3. Server probes OpenGradient → receives HTTP 402 with payment requirements
4. Server returns 402 details to browser (amount, recipient, network)
5. Browser prompts user wallet → user signs payment authorization
6. Browser → POST /api/analyze { repo, paymentPayload: <signed> }
7. Server calls OpenGradient with X-PAYMENT header containing signed payload
8. OpenGradient verifies payment, runs inference, returns result + tx hash
9. Server returns verdict + proof to browser
10. Browser encodes result into URL params → shareable link created
```

This pattern keeps the wallet interaction in the browser (where it belongs) while keeping secrets and inference logic on the server.

### Key x402 packages

```bash
npm install @x402/fetch viem wagmi
```

- `@x402/fetch` (Coinbase) — `wrapFetchWithPayment(fetch, walletClient)` wraps native fetch to automatically handle 402 responses. Use this in the browser to construct the signed payment payload.
- `viem` — creates the wallet client used to sign payment authorizations.
- `wagmi` — manages wallet connection state and chain configuration.

**Confidence:** MEDIUM. The Coinbase x402 SDK is well documented for AI-agent use cases where the client has a private key in memory. For human wallets (MetaMask, WalletConnect), the pattern requires intercepting the 402, prompting the user, then forwarding the signed payload. The `wrapFetchWithPayment` utility handles this but requires the wallet client be connected first.

### Base Sepolia Configuration

```typescript
// lib/web3/config.ts
import { baseSepolia } from 'viem/chains'
import { createConfig, http } from 'wagmi'
import { metaMask, walletConnect, coinbaseWallet } from 'wagmi/connectors'

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [
    metaMask(),
    coinbaseWallet({ appName: 'GitHub Security Checker' }),
    walletConnect({ projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID! }),
  ],
  transports: { [baseSepolia.id]: http() },
})
```

OPG token address (Base Sepolia): `0x240b09731D96979f50B2C649C9CE10FcF9C7987F`

---

## Decision 3: Shareable Result URLs — nuqs (URL Search Params)

**Recommendation: nuqs for type-safe URL state. Encode the full verdict payload in URL params. No backend needed.**

### Why URL params beat localStorage for this use case

- **Shareability is the core feature.** "Share this result" requires the data to be in the URL. localStorage is device-local and cannot be shared.
- URL params survive page refresh, browser tabs, and link sharing.
- On-chain proof (tx hash) is already a short string — perfect for URL encoding.
- The verdict (Safe/Risky/Dangerous), reasoning summary, and tx hash fit well under the ~2KB URL limit.

### nuqs is the right tool

nuqs is a type-safe URL state manager that works like `useState` but syncs with the URL query string. It was featured at Next.js Conf 2025 and is used by Vercel, Sentry, and Supabase internally. It's ~5.5kB gzipped.

```bash
npm install nuqs
```

```typescript
// hooks/useResultParams.ts
import { useQueryState, parseAsString, parseAsJson } from 'nuqs'

export function useResultParams() {
  const [repo, setRepo] = useQueryState('repo', parseAsString)
  const [verdict, setVerdict] = useQueryState('verdict', parseAsString)
  const [txHash, setTxHash] = useQueryState('tx', parseAsString)
  const [summary, setSummary] = useQueryState('summary', parseAsString)
  return { repo, verdict, txHash, summary, setRepo, setVerdict, setTxHash, setSummary }
}
```

When the analysis completes, call the setters. The URL becomes:

```
/?repo=owner/repo&verdict=safe&tx=0xabc...&summary=No+malicious+deps+found
```

Anyone loading that URL sees the same result view immediately, with the tx hash linking to the on-chain proof.

**Long reasoning text:** If the AI reasoning is long (>200 chars), store only a truncated summary in the URL and keep the full text in React state (in-memory) for the current session. The tx hash is the canonical proof — the full reasoning is retrievable from OpenGradient's on-chain record if needed.

---

## Component Architecture

### Single Page Layout

This is a single-screen app. No Next.js routing needed beyond the root page. All state transitions happen in-place.

```
app/
  page.tsx               ← single page, all UX states managed here
  layout.tsx             ← Providers (Wagmi, QueryClient, NuqsAdapter)
  api/
    analyze/
      route.ts           ← POST: orchestrates GitHub fetch + OpenGradient inference
    proof/
      [txHash]/
        route.ts         ← GET: resolve on-chain proof for a tx hash (optional)
  components/
    RepoInput.tsx        ← URL input + validation
    WalletButton.tsx     ← connect wallet, show address
    PaymentConfirm.tsx   ← "This check costs 0.05 OPG" confirmation modal
    AnalysisLoader.tsx   ← loading states with progress messages
    VerdictCard.tsx      ← Safe/Risky/Dangerous result card
    ProofBadge.tsx       ← on-chain verification badge with tx hash
    ShareButton.tsx      ← copies shareable URL to clipboard
  lib/
    github.ts            ← GitHub API fetch utilities (server-only)
    opengradient.ts      ← OpenGradient inference call (server-only)
    x402.ts              ← payment payload construction
    web3/
      config.ts          ← wagmi + viem configuration
```

### UX State Machine

The page has five distinct states. Each has a specific UI:

```
IDLE
  → User sees: repo URL input, "Connect Wallet" if not connected
  → Transition: user enters valid URL + wallet connected → CONFIRMING

CONFIRMING
  → User sees: cost confirmation modal (0.05 OPG, wallet address, repo name)
  → Transition: user clicks "Confirm & Pay" → ANALYZING
  → Transition: user cancels → IDLE

ANALYZING
  → User sees: animated loading card with rotating status messages
  → Status messages cycle: "Fetching repo data...", "Running security models...",
    "GPT-4 analyzing dependencies...", "Claude checking patterns...",
    "Waiting for on-chain settlement..."
  → Transition: success → RESULT
  → Transition: error → ERROR

RESULT
  → User sees: VerdictCard + ProofBadge + ShareButton
  → URL has been updated with result params (shareable)
  → Transition: user clicks "Check Another" → IDLE (clears URL params)

ERROR
  → User sees: error message with retry button
  → Categories: payment_failed, github_not_found, analysis_failed, timeout
  → Transition: retry → IDLE
```

---

## UX Patterns: Loading States and Result Display

### Inspired by Perplexity and Single-Purpose AI Tools

Perplexity's core UX principle is "information as fast as possible." Key patterns applicable here:

1. **Progressive disclosure during loading.** Don't just show a spinner. Show what's happening: "Fetching repo metadata", "Analyzing 47 dependencies", "Comparing with 2 models". This reduces perceived wait time and builds trust that real work is happening.

2. **Show the work.** In the result, surface the evidence: "54 stars, 3 contributors, last commit 14 days ago" feeds directly into the verdict. Users trust verdicts more when they can see what was analyzed.

3. **One clear outcome.** The verdict (Safe/Risky/Dangerous) is shown large and prominent. Color-coded. Then supporting details below. Not the other way around.

4. **Inline citations / sources.** For each risk finding, show the specific file or signal that triggered it (e.g., "package.json contains `preinstall` script — common attack vector").

### Loading State Implementation

```tsx
// components/AnalysisLoader.tsx
const STAGES = [
  { id: 'github',    label: 'Fetching repository data',        duration: 1500 },
  { id: 'payment',  label: 'Waiting for payment confirmation', duration: null }, // user-gated
  { id: 'model1',   label: 'GPT-4 analyzing dependencies',     duration: 3000 },
  { id: 'model2',   label: 'Claude reviewing code patterns',   duration: 3000 },
  { id: 'settle',   label: 'Recording proof on-chain',         duration: 2000 },
]
```

Use a timed progress bar that advances through stages. For the payment stage, pause the timer and wait for wallet confirmation.

---

## Proof Badge UI

**Goal:** Communicate "this result is cryptographically verified" without requiring blockchain knowledge.

### Visual Design Pattern

```
┌──────────────────────────────────────────────┐
│  VERIFIED ON-CHAIN                           │
│  ✓ Inference proven via TEE                  │
│  Block: 18,432,991 · Base Sepolia            │
│  Tx: 0x3a4f...b72c  [↗ Basescan]            │
│  Settlement: INDIVIDUAL_FULL                 │
│  Timestamp: 2026-03-28 14:32 UTC             │
└──────────────────────────────────────────────┘
```

Key principles from web3 UX research:
- **Show first/last chars of addresses.** `0x3a4f...b72c` is the convention. Never show the full hash — it's visually overwhelming and users can click through to verify.
- **External link to block explorer.** Always link to Basescan. This is the "show your work" button for skeptics.
- **"Verified" not "Blockchain."** Non-crypto users understand "verified" — they don't understand "on-chain." Use plain language for the badge label, with a `?` tooltip explaining what verification means.
- **Green checkmark icon.** The universal symbol for trust. Don't reinvent this.
- **Compact by default, expandable.** The badge should be small enough not to dominate the verdict card. An expand/collapse for full technical details is the right pattern.

### shadcn/ui Implementation

```tsx
// components/ProofBadge.tsx
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CheckCircle, ExternalLink } from 'lucide-react'

export function ProofBadge({ txHash, blockNumber, timestamp }: ProofBadgeProps) {
  const shortHash = `${txHash.slice(0, 6)}...${txHash.slice(-4)}`
  const basescanUrl = `https://sepolia.basescan.org/tx/${txHash}`

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm dark:border-green-900 dark:bg-green-950">
      <div className="flex items-center gap-2 font-medium text-green-700 dark:text-green-400">
        <CheckCircle className="h-4 w-4" />
        <span>Verified on-chain</span>
        <Tooltip>
          <TooltipTrigger>
            <InfoIcon className="h-3 w-3 opacity-60" />
          </TooltipTrigger>
          <TooltipContent>
            This analysis was run inside a Trusted Execution Environment.
            The input and output are hashed on Base Sepolia — they cannot be modified.
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="mt-1 text-xs text-green-600 dark:text-green-500">
        Block {blockNumber.toLocaleString()} · {timestamp}
      </div>
      <a
        href={basescanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 flex items-center gap-1 text-xs text-green-600 hover:underline"
      >
        Tx: {shortHash} <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  )
}
```

---

## UI Library: shadcn/ui (Definitive Choice)

**Use shadcn/ui. Do not evaluate alternatives for this project.**

### Why

- shadcn/ui is installed by copying component source into your project (`npx shadcn@latest add button`). You own the code. No npm package to pin or upgrade.
- Built on Radix UI primitives — accessibility (ARIA, keyboard navigation) is handled by default.
- Tailwind-native: every component uses Tailwind classes, so customization is just editing classes.
- In 2026 it is the de facto standard for Next.js + Tailwind projects. Used by Vercel, shadcn registry is massive.
- `cn()` utility (clsx + tailwind-merge) prevents class conflicts.

### Installation

```bash
npx shadcn@latest init
# Choose: App Router, TypeScript, Tailwind, default style "New York", base color "Zinc"

# Components needed for this app:
npx shadcn@latest add button input card badge tooltip dialog progress
```

### Verdict Card Colors

Map security verdicts to Tailwind color semantics:

| Verdict   | Background            | Text              | Border             |
|-----------|-----------------------|-------------------|--------------------|
| Safe      | `bg-green-50`         | `text-green-700`  | `border-green-200` |
| Risky     | `bg-yellow-50`        | `text-yellow-700` | `border-yellow-200`|
| Dangerous | `bg-red-50`           | `text-red-700`    | `border-red-200`   |

Use `dark:` variants for dark mode from day one — it's one extra class per element and painful to retrofit.

---

## Vercel Deployment: Gotchas

### Environment Variables — Critical Rules

| Variable | Scope | Prefix | Notes |
|----------|-------|--------|-------|
| `GITHUB_TOKEN` | Server only | None | Never expose. Add even if unauthenticated today. |
| `OPENGRADIENT_API_URL` | Server only | None | `https://llm.opengradient.ai` |
| `NEXT_PUBLIC_WC_PROJECT_ID` | Client + server | `NEXT_PUBLIC_` | WalletConnect project ID |
| `NEXT_PUBLIC_OPG_TOKEN_ADDRESS` | Client + server | `NEXT_PUBLIC_` | OPG contract address |
| `NEXT_PUBLIC_CHAIN_ID` | Client + server | `NEXT_PUBLIC_` | `84532` (Base Sepolia) |

**Known Next.js 15 bug:** Server-only env vars can go missing from `process.env` at runtime in API Routes when environment is not correctly propagated. Mitigation: explicitly access them at the top of each route file (not in module scope), and add a runtime check that throws a clear error if missing.

```typescript
// app/api/analyze/route.ts
export async function POST(req: Request) {
  const githubToken = process.env.GITHUB_TOKEN
  // Not throwing if missing — unauthenticated is OK for now
  // But log a warning so you notice when rate limiting hits
  if (!githubToken) {
    console.warn('GITHUB_TOKEN not set — using unauthenticated GitHub API (60 req/hour)')
  }
  // ...
}
```

### Timeout: The Biggest Gotcha

**Default Vercel free tier serverless timeout: 10 seconds.**

The `/api/analyze` route must complete within 10 seconds because it:
1. Makes 5 parallel GitHub API calls (~500ms each in parallel = ~800ms total)
2. Waits for wallet payment confirmation (user-gated, excluded from server time)
3. Calls OpenGradient with two parallel model inferences (~3–8 seconds)
4. Waits for on-chain settlement

**This is tight.** Two mitigations:

1. **Split the route into two calls.** `/api/fetch-repo` (fast, <2s) runs first. `/api/analyze` runs after payment. This keeps the expensive inference call isolated.

2. **Vercel Fluid Compute.** Enabled by default on Vercel's infrastructure since late 2025. Allows up to 60 seconds on free plans for I/O-bound work. Add `export const maxDuration = 30` to the route file to extend the timeout.

```typescript
// app/api/analyze/route.ts
export const maxDuration = 30  // seconds — requires Fluid Compute
export const dynamic = 'force-dynamic'  // never cache POST responses
```

### Build Configuration

```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    // Not needed — just ensure these are NOT set:
    // serverComponentsExternalPackages: [] — viem/wagmi are browser-only, fine
  },
}
```

Mark server-only modules explicitly to prevent accidental client-side bundling:

```typescript
// lib/github.ts
import 'server-only'  // This import throws at build time if included in client bundle
```

---

## Data Flow: Full Request Lifecycle

```
Step 1: Repo Input & Prefetch (IDLE → CONFIRMING)
  Browser: user types repo URL, clicks "Check"
  → POST /api/fetch-repo { repo: "owner/repo" }
  Server: 5x parallel GitHub API calls (Promise.all)
  → Returns: { stars, forks, readme_excerpt, deps, contributors, last_commit }
  Browser: shows repo summary in confirmation modal

Step 2: Payment (CONFIRMING → ANALYZING)
  Browser: wallet prompt — "Authorize 0.05 OPG payment"
  User signs → paymentPayload constructed via wrapFetchWithPayment / manual x402 signing
  Browser: POST /api/analyze { repo, repoData, paymentPayload }

Step 3: Inference (ANALYZING)
  Server: calls OpenGradient /v1/chat/completions with X-PAYMENT header
  Two models run in parallel (or sequentially if API requires)
  OpenGradient: verifies payment, runs inference in TEE, settles on-chain
  → Returns: verdict, reasoning, txHash, blockNumber, settlement_type

Step 4: Result (RESULT)
  Server returns full verdict payload to browser
  Browser: calls nuqs setters → URL updated with result params
  VerdictCard + ProofBadge rendered
  ShareButton copies current URL to clipboard
```

---

## Scalability Considerations

This is a demo/challenge app. Scalability is not a primary concern, but these are the natural limits:

| Concern | At 100 users | At 10K users | Mitigation |
|---------|--------------|--------------|------------|
| GitHub API rate limit | 60 req/hr unauthenticated — hit immediately | — | Add `GITHUB_TOKEN` — 5K req/hr |
| Vercel cold starts | Noticeable (~300ms) | Less noticeable (warm pool) | Accept for free tier |
| OpenGradient capacity | Unknown — testnet | Unknown | Out of scope for challenge |
| URL state size | Fine (<500 chars) | Fine | Accept |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side GitHub API Calls
**What:** Fetching `api.github.com` directly from the browser.
**Why bad:** Rate limit burns the user's IP allocation. Can't add a PAT without exposing it. CORS issues if headers are added.
**Instead:** All GitHub calls go through `/api/fetch-repo` Route Handler.

### Anti-Pattern 2: Storing Sensitive Data in URL Params
**What:** Putting the full AI reasoning (multi-paragraph text) in URL params.
**Why bad:** URLs can exceed browser limits (~2KB). Some proxies truncate long URLs. Log files record URLs — reasoning text leaks into server logs.
**Instead:** URL params hold only: `repo`, `verdict` (one word), `tx` (hash), `summary` (truncated, ~100 chars). Full reasoning is in React state (in-memory) for the current session; retrievable from on-chain proof for future sessions.

### Anti-Pattern 3: Using `process.env` in Client Components
**What:** Accessing `process.env.SOME_SECRET` inside a React client component.
**Why bad:** Next.js will bundle the value into the client JavaScript — it becomes public.
**Instead:** Any variable accessed in client components must have the `NEXT_PUBLIC_` prefix, and that means it can be public. Secrets stay in Route Handlers.

### Anti-Pattern 4: Monolithic `/api/analyze` Route
**What:** One giant route that does GitHub fetch + payment + inference in sequence.
**Why bad:** Vercel 10s timeout. Worse UX (user waits for GitHub fetch before seeing payment prompt).
**Instead:** Split into `/api/fetch-repo` (fast prefetch) and `/api/analyze` (inference, payment required).

### Anti-Pattern 5: Blocking wallet connect before showing the repo input
**What:** Requiring wallet connection as the first step before anything else.
**Why bad:** Users want to know "does this tool look credible?" before connecting a wallet. Aggressive wallet prompts kill conversion.
**Instead:** Show the repo input first. The "Connect Wallet" prompt appears only when the user clicks "Check". Or use a subtle "Connect wallet to analyze" note at the bottom of the input form.

---

## Sources

- [Next.js Backend for Frontend pattern](https://nextjs.org/docs/app/guides/backend-for-frontend) — official docs on Route Handler as BFF/proxy
- [Next.js Route Handlers vs Server Actions](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) — MEDIUM confidence
- [Client-Side vs Server-Side in Next.js App Router](https://peerlist.io/jagss/articles/mastering-clientside-vs-serverside-requests-in-nextjs-app-ro) — MEDIUM
- [x402 Protocol Overview — DappRadar](https://dappradar.com/blog/x402-protocol-explained-the-revolution-for-seamless-web3-micropayments) — MEDIUM
- [x402 Quickstart for Buyers — Coinbase CDP Docs](https://docs.cdp.coinbase.com/x402/quickstart-for-buyers) — HIGH
- [@x402/fetch on npm](https://www.npmjs.com/package/@x402/fetch) — HIGH
- [coinbase/x402 GitHub repo](https://github.com/coinbase/x402) — HIGH
- [x402-next middleware package on npm](https://www.npmjs.com/package/x402-next) — MEDIUM
- [shadcn/ui Next.js installation](https://ui.shadcn.com/docs/installation/next) — HIGH
- [shadcn/ui best practices 2026 — Medium](https://medium.com/write-a-catalyst/shadcn-ui-best-practices-for-2026-444efd204f44) — MEDIUM
- [nuqs — type-safe URL state](https://nuqs.dev) — HIGH
- [nuqs at Next.js Conf 2025](https://nextjs.org/conf/session/type-safe-url-state-in-nextjs-with-nuqs) — HIGH
- [Vercel Functions timeout limits](https://vercel.com/docs/functions/limitations) — HIGH
- [Vercel Fluid Compute docs](https://vercel.com/docs/limits) — HIGH
- [Next.js 15 env var bug in API Routes — Vercel Community](https://community.vercel.com/t/next-js-15-environment-variables-missing-in-api-routes/28705) — MEDIUM
- [Web3 UX Design Patterns — Coinbound](https://coinbound.io/web3-ux-design-patterns-that-build-trust/) — MEDIUM
- [The UX of AI: Lessons from Perplexity — NN/g](https://www.nngroup.com/articles/perplexity-henry-modisett/) — HIGH
- [wagmi Connect Wallet guide](https://wagmi.sh/react/guides/connect-wallet) — HIGH
- [Storing React state in the URL with Next.js — François Best](https://francoisbest.com/posts/2023/storing-react-state-in-the-url-with-nextjs) — HIGH (nuqs author)
