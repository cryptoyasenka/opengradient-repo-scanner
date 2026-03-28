# Project Research Summary

**Project:** GitHub Security Checker
**Domain:** AI-powered supply chain security analyzer with TEE-verified inference and x402 micropayments
**Researched:** 2026-03-28
**Confidence:** MEDIUM-HIGH

## Executive Summary

GitHub Security Checker occupies a distinct and currently unoccupied niche: a zero-friction, single-URL security verdict for arbitrary public GitHub repositories, backed by cryptographically verified AI inference. Every existing tool in this space (Socket.dev, Snyk, OpenSSF Scorecard, Dependabot) either requires repo ownership/install access, produces unverifiable AI outputs, or relies on CVE databases that cannot detect novel attacks. This product answers the question no competitor answers: "Is this specific GitHub repo safe to use right now, before I install it?" — and produces a shareable proof that the answer cannot be faked.

The recommended implementation is a single Next.js 15 application deployed to Vercel. All GitHub data fetching and OpenGradient inference happen in Next.js Route Handlers (server-side), with wallet interaction isolated to client components via wagmi and RainbowKit. The x402 payment flow uses an app-wallet relay pattern for MVP: a funded server-side wallet makes payments to the OpenGradient gateway using `@x402/fetch`, while the user experience focuses on connecting a wallet and authorizing the analysis. The `INDIVIDUAL_FULL` settlement mode on OpenGradient is non-negotiable — it is the mechanism that generates the on-chain hash linking the specific AI inputs and outputs, making the verdict verifiably tamper-evident.

The two primary risks are operational, not architectural. First, OpenGradient is a young testnet with undocumented latency, rate limits, and reliability characteristics — the implementation must treat every inference call as potentially slow (45-second timeout) and potentially failing after payment is accepted (non-atomic delivery risk). Second, publicly labeling a repository as "Dangerous" based on AI inference creates genuine legal exposure under US defamation doctrine; all results must be framed as AI-assisted opinion with explicit disclaimers and a "report incorrect verdict" mechanism. Both risks are mitigable and should not change the architecture, but they must be addressed from day one rather than retrofitted.

---

## Key Findings

### Recommended Stack

The stack is tightly constrained by the integration requirements. OpenGradient's TypeScript SDK is still in development as of March 2026 — all inference calls are made via direct HTTP to `https://llm.opengradient.ai` using `@x402/fetch` to handle the payment handshake automatically. The x402 ecosystem (Coinbase's protocol) has first-class TypeScript support via `@x402/fetch`, `@x402/evm`, and `@x402/core`. Wallet interaction uses wagmi v2 with RainbowKit for the connect UI, both of which require `"use client"` isolation in Next.js App Router. Tailwind CSS v4 + shadcn/ui is the default for Next.js 15 and requires no extra configuration.

**Core technologies:**
- **Next.js 15 + React 19**: Full-stack framework — App Router cleanly separates server (API routes) from client (wallet components); Vercel-native zero-config deploy
- **wagmi v2 + viem v2**: Wallet state and EVM signing — industry standard; required for EIP-712 payment authorization
- **RainbowKit**: Wallet connect UI — best-in-class, supports Base Sepolia out of the box
- **@x402/fetch + @x402/evm**: x402 payment automation — wraps `fetch` to handle 402 challenge-response; `ExactEvmScheme` handles EIP-712 signing against the Base Sepolia OPG token
- **OpenGradient LLM Gateway** (`https://llm.opengradient.ai`): TEE-backed AI inference — OpenAI-compatible API; use `individual` settlement mode to generate on-chain proof per request
- **Tailwind CSS v4 + shadcn/ui**: Styling and components — zero-config with Next.js 15; Radix UI accessibility primitives included
- **nuqs**: URL state management — type-safe query params for shareable result links; no database needed for MVP
- **GitHub REST API v2022-11-28**: Repo data — 8 targeted endpoints, no auth required for public repos (add `GITHUB_TOKEN` env var immediately to raise limit from 60 to 5,000 req/hr)

**Key network values (Base Sepolia):**
- Chain ID: `84532` / Network ID: `eip155:84532`
- OPG Token: `0x240b09731D96979f50B2C649C9CE10FcF9C7987F`
- OPG Faucet: `https://faucet.opengradient.ai/`
- Gateway: `https://llm.opengradient.ai`

### Expected Features

The product has a clear MVP core and a clean set of v2 deferred features. The on-chain verification badge is not a differentiator to be added later — it is the reason this product is worth building. It must ship in v1.

**Must have (table stakes):**
- Repo URL input with format validation (handles trailing slashes, `.git` suffixes)
- Safe / Risky / Dangerous verdict with 0-100 risk score (0-30 / 31-65 / 66-100 thresholds)
- Reasoning summary (3-5 bullet top findings from the AI)
- Repo metadata display (stars, forks, last commit, language) — sets context for the verdict
- Animated loading states with progress labels ("Fetching repo data... Running AI models... Recording on-chain...")
- On-chain verification badge (tx hash, block number, settlement mode, link to Basescan) — core differentiator
- Shareable permalink with result encoded in URL params (nuqs) — required for team workflows
- x402 payment gate with pre-flight balance check and faucet link

**Should have (differentiators):**
- Dual-model consensus (GPT-4o + Claude Haiku) — two independent models agreeing on "Dangerous" materially increases credibility
- GitHub Actions workflow analysis — `.github/workflows/*.yml` is a confirmed 2025 attack vector (CVE-2025-30066 / GhostAction affected 23,000+ repos); most scanners ignore it
- Specific named attack pattern detection (typosquatting, postinstall hooks, tag mutation, base64 decode+exec)
- Embeddable verdict badge (SVG at `/badge/{analysisId}`) for repo READMEs

**Defer to v2+:**
- CVE database lookup (OSV/Snyk) — additive, not core to the TEE-verification angle
- GitHub OAuth for private repo access — out of scope; adds auth complexity
- Continuous monitoring and alerts — requires persistent infra beyond MVP scope
- Full codebase clone and static analysis — too slow, too expensive, wrong approach for this product

**AI analysis covers 6 signal groups:** repo metadata, contributor profile, commit history, package manifests (npm/Python), README content, and GitHub Actions workflows — 8 total API requests per analysis.

### Architecture Approach

The architecture is a single Next.js application with a clean server/client split. Next.js Route Handlers act as a Backend-for-Frontend (BFF) layer: all GitHub fetching and OpenGradient inference run server-side, keeping secrets out of the browser bundle. The client handles wallet connection, EIP-712 signing, and UX state. Results are stored in URL search params via nuqs — no database required for the MVP. The full request lifecycle splits into two Route Handlers: `/api/fetch-repo` (fast GitHub prefetch, shown in confirmation modal) and `/api/analyze` (payment-gated inference, returns verdict + proof).

**Major components:**
1. **`app/providers.tsx` (client)** — WagmiProvider, QueryClientProvider, RainbowKitProvider, NuqsAdapter; wraps entire app; `"use client"` only
2. **`app/api/fetch-repo/route.ts` (server)** — parallel GitHub API calls via `Promise.all`; returns structured repo context; no payment required
3. **`app/api/analyze/route.ts` (server)** — receives signed payment payload from client; calls OpenGradient with `X-PAYMENT` header and `X-SETTLEMENT-TYPE: individual`; returns verdict JSON + tx hash; `export const maxDuration = 30`
4. **`components/VerdictCard.tsx` (client)** — color-coded Safe/Risky/Dangerous display with score and top findings
5. **`components/ProofBadge.tsx` (client)** — on-chain verification badge with Basescan link; async settlement state ("Pending" until confirmed)
6. **`lib/github.ts` (server-only)** — GitHub API utilities; `import 'server-only'` to prevent client bundling
7. **`lib/opengradient.ts` (server-only)** — OpenGradient inference call with x402 payment handling

**UX state machine:** IDLE → CONFIRMING → ANALYZING → RESULT (or ERROR) — five distinct states with specific UI for each.

**Key architecture decision:** Use `individual` (INDIVIDUAL_FULL) settlement mode, not `batch`. INDIVIDUAL_FULL stores per-request input/output hash on-chain. BATCH_HASHED delays proof availability and kills the shareable verified verdict feature.

### Critical Pitfalls

1. **x402 payment with no wallet connected** — Gate the "Analyze" button on `useAccount().isConnected`; catch `UserRejectedRequestError` separately and show "Payment cancelled"; pre-flight the wallet state before touching the payment flow

2. **GitHub API rate limit exhaustion** — Add `GITHUB_TOKEN` env var from day one (raises limit from 60 to 5,000 req/hr); check `X-RateLimit-Remaining` in every response; cache per-repo responses with a 10-minute TTL to avoid duplicate calls

3. **Payment-before-service race condition (non-atomic delivery)** — x402 has no escrow; if OpenGradient fails after payment, user has paid for nothing; implement a 45-second timeout, show the tx hash on failure, store pending tx in localStorage for recovery

4. **INDIVIDUAL_FULL settlement latency** — Decouple result display from settlement finality; show AI verdict immediately, update the proof badge asynchronously while polling for confirmation; label badge as "Settlement Pending" until confirmed

5. **Legal exposure from "Dangerous" labels** — Frame all verdicts as AI opinion, not fact; mandate a disclaimer on every result page; add "Report incorrect verdict" link; set `noindex` on shareable result pages; use hedged language ("No obvious red flags detected" rather than "Safe")

6. **Vercel 10-second timeout** — Add `export const maxDuration = 30` to `/api/analyze/route.ts` (Vercel Fluid Compute extends this to 30-60s on free tier); split GitHub prefetch into a separate fast route to keep the inference route lightweight

7. **Token overflow for large repos** — Define hard per-field budgets before calling OpenGradient: README (3,000 chars), package.json (2,000 chars), last 5 commit messages only, first workflow file only; show a truncation notice in the UI

---

## Implications for Roadmap

Based on research, the dependency chain is strict: GitHub data fetching must precede AI analysis; AI analysis must precede proof display; the payment gate belongs between data preview and inference. This suggests a linear phase structure where each phase delivers a runnable vertical slice.

### Phase 1: Repo Data Fetcher + UI Shell

**Rationale:** All downstream features depend on structured GitHub data. This phase is pure HTTP with no blockchain complexity — it unblocks every other phase and is safe to build and test independently.

**Delivers:** Working Next.js app with repo URL input, 8-endpoint GitHub data fetch, structured JSON output, and basic repo metadata display card. UI shell with loading states and shadcn/ui components.

**Addresses:** Repo URL input, repo metadata display, loading state with progress, "Fetching repo data" stage

**Avoids:** Rate limit exhaustion (add `GITHUB_TOKEN` immediately, check `X-RateLimit-Remaining`); client-side GitHub calls (route everything through `/api/fetch-repo`)

**Research flag:** Standard patterns — Next.js route handlers + GitHub REST API is fully documented. No additional research needed.

---

### Phase 2: AI Inference + Verdict Display

**Rationale:** The core product value — an AI-generated security verdict — should be proven end-to-end before payment integration complicates the flow. Use a simple server-side fetch (no x402) to validate the prompt structure and OpenGradient integration.

**Delivers:** Full security analysis pipeline: structured prompt construction from Phase 1 data, OpenGradient inference call, JSON verdict parsing, and VerdictCard display (Safe/Risky/Dangerous, score, top findings, category breakdown).

**Addresses:** Safe/Risky/Dangerous verdict, risk score, reasoning summary, category breakdown, GitHub Actions workflow analysis, named attack pattern detection

**Avoids:** Token overflow (enforce character budgets on all input fields before sending); AI verdict accuracy issues (use the structured 7-category prompt with explicit scoring guide and JSON-only output constraint)

**Research flag:** Needs validation — OpenGradient testnet latency and reliability are undocumented. Test inference latency, error behavior, and JSON parsing robustness before adding payment gating. Validate that `INDIVIDUAL_FULL` proof data structure matches expectations.

---

### Phase 3: x402 Payment Gate

**Rationale:** Payment integration is architecturally isolated to the handshake between the browser and `/api/analyze`. Phase 2 establishes a working inference pipeline; this phase wraps it with the payment requirement without changing the verdict logic.

**Delivers:** Full x402 payment flow — wallet connection (RainbowKit), OPG balance pre-flight check with faucet link, EIP-712 payment authorization, server-side `@x402/fetch` call with signed payload, payment error handling (insufficient balance, user rejection, post-payment delivery failure).

**Addresses:** x402 payment gate, wallet connect UI, payment confirmation modal, balance display

**Avoids:** Wallet-not-connected failure (gate "Analyze" button on wallet state); insufficient OPG (check balance before triggering signature); payment-before-service race condition (implement tx hash display on failure + localStorage recovery)

**Research flag:** Needs validation — the browser-signed / server-relay pattern for x402 is only MEDIUM confidence. The exact mechanics of how `@x402/fetch` on the server consumes a client-provided payment payload needs hands-on testing. STACK.md documents two approaches (server app-wallet vs. client user-wallet relay); confirm the relay approach works before committing.

---

### Phase 4: On-Chain Proof + Shareable Links

**Rationale:** The proof badge and shareable permalink are the product's unique moat. They depend on `X-PAYMENT-RESPONSE` header data from Phase 3. This phase adds the verification UI and URL-state-based sharing — both are purely additive and do not require architecture changes.

**Delivers:** ProofBadge component with async settlement polling, Basescan link, "Settlement Pending" state; nuqs URL encoding of verdict + tx hash for shareable links; ShareButton component; result permalink behavior (loading a shared URL restores the verdict view).

**Addresses:** On-chain verification badge, shareable permalink, proof block display, embeddable badge (stretch)

**Avoids:** INDIVIDUAL_FULL settlement latency (decouple verdict display from settlement confirmation; poll asynchronously); URL length limits (encode only verdict, score, tx hash, and summary truncated to 100 chars in URL — full reasoning stays in React state)

**Research flag:** Standard patterns for nuqs URL state. On-chain polling logic is straightforward but needs a testnet verification run to confirm settlement time and `X-PAYMENT-RESPONSE` data structure.

---

### Phase 5: Polish, Disclaimers, and Production Readiness

**Rationale:** Legal and UX hardening that must ship before public sharing. The legal exposure from persistent "Dangerous" labels is non-optional, and the edge cases (private repos, rate limits, timeout errors) will surface during dog-fooding.

**Delivers:** Legal disclaimers on all result pages, hedged verdict language, "Report incorrect verdict" link, `noindex` on result pages, error states for all failure modes (repo not found, private repo, rate limited, analysis timeout, payment failed), dark mode, dual-model consensus (GPT-4o + Claude Haiku) if not already implemented.

**Addresses:** AI verdict accuracy disclaimers, false positive/negative communication, dual-model consensus, error state coverage

**Avoids:** Defamation exposure (all verdict language framed as AI opinion); Vercel timeout (confirm `maxDuration = 30` and Fluid Compute behavior in production)

**Research flag:** Standard patterns. Legal disclaimer language is straightforward. Dual-model parallel inference with `Promise.all` is documented in STACK.md.

---

### Phase Ordering Rationale

- **Data before inference:** GitHub fetching must be working before the AI prompt can be assembled. Separating phases 1 and 2 also means inference can be iterated without touching the data layer.
- **Inference before payment:** Validating the AI output quality before adding payment friction reduces the risk of discovering a fundamental prompt problem after the payment flow is wired.
- **Payment before proof:** The on-chain tx hash only exists after a real x402 payment succeeds. The proof UI cannot be built without real data from the payment flow.
- **Proof before polish:** The verification badge is the core differentiator. It ships before polish to ensure the product value is demonstrated end-to-end as early as possible.
- **Split API routes (Phases 1 vs 3):** ARCHITECTURE.md and PITFALLS.md both flag the Vercel 10-second timeout. Keeping GitHub prefetch (`/api/fetch-repo`) and inference (`/api/analyze`) in separate routes is required, not optional.

### Research Flags

**Needs deeper research / validation during implementation:**
- **Phase 2 (OpenGradient inference):** Testnet latency, rate limits, error codes, and `X-PAYMENT-RESPONSE` data structure are all undocumented. Test early with real calls.
- **Phase 3 (x402 payment):** The client-signed / server-relay payment pattern is MEDIUM confidence. STACK.md notes `@x402/fetch` may not bundle cleanly in browser environments. Confirm the exact integration pattern with a working spike before implementing the full flow.

**Standard patterns (skip additional research):**
- **Phase 1 (GitHub data fetching):** GitHub REST API is fully documented with confirmed endpoints, rate limit headers, and base64 README decoding.
- **Phase 4 (nuqs URL state):** nuqs is well-documented and actively maintained; URL encoding pattern is straightforward.
- **Phase 5 (polish):** Standard Next.js, Tailwind, and shadcn/ui patterns throughout.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core Next.js / wagmi / viem stack is HIGH confidence. x402 browser-integration pattern is MEDIUM — only one primary example found; server-side relay is safer and better documented |
| Features | HIGH | Security signal groups verified against multiple 2025 threat intelligence sources; attack patterns (CVE-2025-30066, GhostAction, Shai-Hulud) are confirmed real incidents |
| Architecture | HIGH for Next.js patterns; MEDIUM for x402 flow | BFF/Route Handler pattern is fully documented. x402 hybrid payment relay is inferred from x402 spec + wagmi; requires validation |
| Pitfalls | MEDIUM | OpenGradient testnet specifics (latency, rate limits, reliability) are genuinely undocumented; pitfall mitigations are based on first-principles reasoning |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **OpenGradient testnet reliability:** No published SLAs, rate limits, or error response documentation. Build with defensive timeouts (45s) from the start. Run exploratory calls early in Phase 2 to characterize actual latency and error behavior.
- **x402 browser-wallet relay pattern:** STACK.md explicitly marks this as LOW confidence for browser environments due to Node.js crypto dependencies in `@x402/fetch`. The server app-wallet relay (funded `APP_WALLET_PRIVATE_KEY`) is simpler and more reliable. Confirm the chosen approach works before Phase 3 implementation begins.
- **`X-PAYMENT-RESPONSE` data structure:** Confirmed to contain `txHash`, `block`, `payer`, and `settlementType` — but the exact JSON shape for `INDIVIDUAL_FULL` mode needs to be validated against a real testnet response before building the ProofBadge component.
- **OPG token `payTo` address:** STACK.md notes the gateway `payTo` address (`0x339c7de83d1a62edafbaac186382ee76584d294f`) is MEDIUM confidence from a sample API response. Verify at runtime from the 402 response headers rather than hard-coding.

---

## Sources

### Primary (HIGH confidence)
- [OpenGradient Developers Overview](https://docs.opengradient.ai/developers/) — TypeScript SDK status, gateway URL
- [OpenGradient LLM Inference Docs](https://docs.opengradient.ai/developers/sdk/llm.html) — settlement modes, model strings, confirmed endpoints
- [OpenGradient x402 API Reference](https://docs.opengradient.ai/developers/x402/api-reference.html) — EIP-712 domain, headers, OPG token address, chain ID
- [OpenGradient x402 Examples](https://docs.opengradient.ai/developers/x402/examples) — TypeScript `wrapFetch` server-side example
- [coinbase/x402 GitHub](https://github.com/coinbase/x402) — official x402 protocol implementation
- [@x402/fetch npm](https://www.npmjs.com/package/@x402/fetch) — package API
- [@x402/evm npm](https://www.npmjs.com/package/@x402/evm) — `ExactEvmScheme` usage
- [GitHub REST API Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) — confirmed 60/hr unauthenticated, 5,000/hr authenticated
- [wagmi Getting Started](https://wagmi.sh/react/getting-started) — wagmi v2 setup, SSR config
- [RainbowKit Installation](https://rainbowkit.com/en-US/docs/installation) — Base Sepolia support confirmed
- [nuqs documentation](https://nuqs.dev) — type-safe URL state API
- [shadcn/ui Next.js Installation](https://ui.shadcn.com/docs/installation/next) — component setup
- [Vercel Functions timeout limits](https://vercel.com/docs/functions/limitations) — 10s default, Fluid Compute extension
- [tj-actions CVE-2025-30066 — Palo Alto Unit42](https://unit42.paloaltonetworks.com/github-actions-supply-chain-attack/) — GitHub Actions attack vectors confirmed
- [GhostAction Campaign — GitGuardian](https://blog.gitguardian.com/ghostaction-campaign-3-325-secrets-stolen/) — workflow exfiltration patterns
- [Shai-Hulud npm attack — Palo Alto Unit42](https://unit42.paloaltonetworks.com/npm-supply-chain-attack/) — postinstall hook attack confirmed
- [CISA Advisory CVE-2025-30066](https://www.cisa.gov/news-events/alerts/2025/03/18/supply-chain-compromise-third-party-github-action-cve-2025-30066) — confirmed supply chain attack scope

### Secondary (MEDIUM confidence)
- [OpenGradient x402 Upgrade Blog](https://www.opengradient.ai/blog/x402-opengradient-upgrade-trustless-verifiable-inference) — settlement modes, value proposition
- [x402 Quickstart for Buyers — x402.gitbook.io](https://x402.gitbook.io/x402/getting-started/quickstart-for-buyers) — payment flow mechanics
- [x402 Quickstart — Coinbase CDP Docs](https://docs.cdp.coinbase.com/x402/quickstart-for-buyers) — buyer-side payment pattern
- [nuqs at Next.js Conf 2025](https://nextjs.org/conf/session/type-safe-url-state-in-nextjs-with-nuqs) — adoption signal
- [AI Defamation Legal Risks — Bloomberg Law 2025](https://news.bloomberglaw.com/legal-exchange-insights-and-commentary/courts-navigating-ai-defamation-opens-legal-risks-for-companies) — legal exposure framing
- [Next.js 15 env var bug — Vercel Community](https://community.vercel.com/t/next-js-15-environment-variables-missing-in-api-routes/28705) — env var handling in API routes
- [Greptile AI Code Review Benchmarks 2025](https://www.greptile.com/benchmarks) — LLM false positive/negative baseline

### Tertiary (LOW confidence — needs hands-on validation)
- Browser-side x402 with user wallet — inferred from x402 spec + wagmi; no confirmed example found; use server-side relay pattern instead
- OpenGradient inference latency and rate limits — undocumented; treat as unknown until tested

---
*Research completed: 2026-03-28*
*Ready for roadmap: yes*
