# GitHub Security Checker

## What This Is

A web application that allows developers to check the security of any public GitHub repository using AI-powered analysis backed by cryptographic proof via OpenGradient. Users paste a GitHub repo URL, pay a small x402 micropayment (OPG token on Base Sepolia), and receive a verified security verdict — Safe, Risky, or Dangerous — that cannot be tampered with.

## Core Value

Every security verdict is cryptographically verified on-chain: "AI said this repo is safe" can be proven and shared — it cannot be faked or modified.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can input a GitHub repository URL and receive an AI security analysis
- [ ] Analysis covers: README/description, package.json dependencies, suspicious code patterns, repo credibility signals (stars, contributors, last commit)
- [ ] Security verdict displayed as Safe / Risky / Dangerous with reasoning
- [ ] x402 micropayment via OPG token on Base Sepolia required per analysis
- [ ] Verifiable proof badge shown with on-chain settlement details (tx hash, block, settlement type)
- [ ] Shareable result link: anyone can verify the AI analysis was not modified
- [ ] Two AI models (e.g. GPT-4 + Claude) analyze in parallel via OpenGradient multi-provider API

### Out of Scope

- Private repository analysis — requires GitHub auth, adds complexity
- Full code download and deep static analysis — too slow, use AI analysis of visible files
- Automatic dependency vulnerability DB lookup (e.g. Snyk) — v2 feature
- Mobile app — web-first

## Context

- Built for the OpenGradient Claude Code Plugin challenge (March 2026)
- OpenGradient provides: verifiable AI inference via TEE, x402 micropayments, multi-provider model access (GPT-4, Claude, Gemini, Grok)
- x402 gateway: https://llm.opengradient.ai — HTTP API, no Python backend needed
- Base Sepolia testnet, OPG token: 0x240b09731D96979f50B2C649C9CE10FcF9C7987F
- GitHub public API provides repo metadata, README, package.json, recent commits without authentication
- Similar projects in ecosystem: chainlens-ai (smart contracts only), sentimentai (sentiment only) — no general GitHub repo security checker exists
- Target users: developers who find random GitHub libraries and want to know if they're safe before installing

## Constraints

- **Tech Stack**: Next.js + Tailwind CSS + TypeScript — fast to build, easy to deploy
- **Payments**: x402 via wagmi/viem, Base Sepolia testnet only (no mainnet for now)
- **AI**: OpenGradient multi-provider API only — showcases the plugin
- **Deploy**: Vercel free tier
- **Scope**: Keep it simple — one main screen, one action, one result

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use GitHub public API (no auth) | Simplifies implementation, works for public repos | — Pending |
| INDIVIDUAL_FULL settlement mode | Stores input/output hashes on-chain, enabling verification | — Pending |
| Two models in parallel | Showcases multi-provider capability, shows consensus | — Pending |
| x402 ~0.05 OPG per check | Low enough for users to try, demonstrates the payment model | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-28 after initialization*
