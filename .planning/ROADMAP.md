# Roadmap: GitHub Security Checker

**Created:** 2026-03-28
**Milestone:** v1.0 — Working demo for OpenGradient community challenge

## Overview

4 phases. Coarse granularity. Each phase is independently deployable.

```
Phase 1: Foundation     → Next.js app + GitHub API + project skeleton
Phase 2: AI Analysis    → OpenGradient integration + verdict UI
Phase 3: Payment + Proof → x402 payment gate + on-chain verification display
Phase 4: Polish + Deploy → Shareable URLs + Vercel deployment + README
```

---

## Phase 1: Foundation

**Goal:** Working Next.js app that fetches GitHub repo data and displays it cleanly.

**Why first:** Isolates GitHub API integration from AI and payment complexity. Lets us verify data quality before building on top of it.

**Deliverables:**
- Next.js 15 project with TypeScript + Tailwind + shadcn/ui
- GitHub API client: fetches repo metadata, README, package.json, recent commits, contributors, Actions workflows
- Input form: validates GitHub URL, shows loading state, displays raw fetched data
- Error handling: invalid URL, repo not found, rate limit hit
- Optional GITHUB_TOKEN env var for 5,000/hr limit

**Requirements covered:** INPUT-01, INPUT-02, INPUT-03, GEN-03

**Done when:** User can paste any public GitHub repo URL and see structured repo data displayed without errors.

---

## Phase 2: AI Analysis

**Goal:** Integrate OpenGradient API to analyze fetched repo data and display a security verdict.

**Why second:** Builds directly on Phase 1 data. No payment yet — use a test mode with hardcoded payment bypass for development speed.

**Deliverables:**
- OpenGradient API integration (raw HTTP, no TS SDK)
- Structured AI prompt that outputs JSON: `{ verdict, score, findings, summary }`
- Verdict UI: Safe/Risky/Dangerous with color coding (green/yellow/red)
- Expandable findings per category
- Loading states with step progress (Fetching → Analyzing → Done)
- Legal disclaimer on every result
- "Report incorrect verdict" link
- Error handling for OpenGradient API failures

**Requirements covered:** ANAL-01 through ANAL-05, UI-01 through UI-05, GEN-02

**Done when:** Pasting a GitHub repo URL returns a formatted AI security verdict with category findings — without any payment gate.

---

## Phase 3: Payment + Proof

**Goal:** Gate the analysis behind x402 micropayment and display on-chain verification proof.

**Why third:** Payment integration is complex and should be added to a working AI flow, not built simultaneously.

**Deliverables:**
- RainbowKit wallet connection (MetaMask + WalletConnect) on Base Sepolia
- Next.js API route as x402 payment relay (server-side @x402/fetch)
- INDIVIDUAL_FULL settlement mode — on-chain input/output hash recording
- Transaction hash badge: shortened `0x3a4f...b72c` + Basescan link
- "Verified by OpenGradient TEE" badge on results
- Payment error handling: not connected, insufficient OPG, tx failure
- OPG faucet link for users who need testnet tokens

**Requirements covered:** PAY-01 through PAY-05, PROOF-01 through PROOF-03

**Done when:** Full flow works — connect wallet → pay OPG → get verified verdict with on-chain proof badge.

---

## Phase 4: Polish + Deploy

**Goal:** Shareable result URLs, production Vercel deployment, and project README.

**Why last:** URL sharing depends on stable result schema. Deploy only when everything works.

**Deliverables:**
- Shareable result URLs via nuqs (encodes repo, verdict, tx hash, summary in query params)
- Result page: anyone can visit the link and see the verdict without paying
- Vercel deployment with env vars configured
- Project README with: what it does, how to use it, tech stack, screenshots
- Test on multiple repos: safe (popular library), risky (abandoned), dangerous (known malicious)

**Requirements covered:** PROOF-04, GEN-01

**Done when:** App is live on Vercel, shareable links work, README is clear, tested on 3+ repos.

---

## Success Criteria (v1.0)

- [ ] User can analyze any public GitHub repo in under 45 seconds
- [ ] x402 payment works on Base Sepolia with MetaMask
- [ ] On-chain proof badge links to real Basescan transaction
- [ ] Shareable result URL works without wallet connection
- [ ] App is deployed on Vercel and publicly accessible
- [ ] Legal disclaimer present on all verdicts

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Raw HTTP (no TS SDK) | OpenGradient TS SDK not production-ready |
| GitHub API client-side | Distributes rate limit per user IP (not server) |
| x402 via server-side relay | @x402/fetch is Node.js native, not browser-compatible |
| INDIVIDUAL_FULL settlement | Records hashes on-chain for verifiable/shareable verdicts |
| Single model (v1) | Two models = two payments = confusing UX; defer to v2 |
| nuqs for sharing | URL-based state, no database needed for v1 |

---
*Roadmap created: 2026-03-28*
*Last updated: 2026-03-28 after initial creation*
