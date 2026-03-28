# Requirements: GitHub Security Checker

**Defined:** 2026-03-28
**Core Value:** Every security verdict is cryptographically verified on-chain — it cannot be faked or modified.

## v1 Requirements

### Repository Input

- [ ] **INPUT-01**: User can paste a GitHub repository URL (github.com/owner/repo format)
- [ ] **INPUT-02**: URL is validated before any API calls are made
- [ ] **INPUT-03**: App fetches repo metadata, README, package.json, recent commits, contributors, and GitHub Actions workflows via GitHub public API (client-side, no auth required for basic usage)

### Security Analysis

- [ ] **ANAL-01**: AI analyzes repo across 6 signal groups: metadata credibility, contributor profile, commit history, package manifest, README content, GitHub Actions workflows
- [ ] **ANAL-02**: Analysis returns a structured verdict: Safe (0–30) / Risky (31–65) / Dangerous (66–100) with numeric score
- [ ] **ANAL-03**: Verdict includes specific findings per category (not just a score)
- [ ] **ANAL-04**: Analysis is performed via OpenGradient LLM API (llm.opengradient.ai) using GPT-4o or Claude
- [ ] **ANAL-05**: AI prompt is structured to output strict JSON (verdict, score, findings per category, summary)

### Payment

- [ ] **PAY-01**: User must connect a wallet (MetaMask or WalletConnect) on Base Sepolia
- [ ] **PAY-02**: x402 micropayment (~0.05 OPG) is required before analysis runs
- [ ] **PAY-03**: Payment is handled via Next.js API route using @x402/fetch (server-side relay pattern)
- [ ] **PAY-04**: Clear error messages shown for: wallet not connected, insufficient OPG balance, payment failure
- [ ] **PAY-05**: OPG faucet link shown to users who need testnet tokens

### Verification & Proof

- [ ] **PROOF-01**: Analysis uses INDIVIDUAL_FULL settlement mode — input/output hashes recorded on-chain
- [ ] **PROOF-02**: Transaction hash displayed as shortened badge (0x3a4f...b72c) with link to Basescan
- [ ] **PROOF-03**: "Verified by OpenGradient TEE" badge shown on every result
- [ ] **PROOF-04**: Result page URL is shareable — encodes repo, verdict, tx hash, and summary in query params (via nuqs)

### Results Display

- [ ] **UI-01**: Verdict displayed with color coding: green (Safe), yellow (Risky), red (Dangerous)
- [ ] **UI-02**: Expandable findings per category shown below the verdict
- [ ] **UI-03**: Legal disclaimer shown on every result: "This is AI opinion, not a security audit. Results may be inaccurate."
- [ ] **UI-04**: "Report incorrect verdict" link shown on every result
- [ ] **UI-05**: Loading state shown during analysis with step progress (Fetching repo → Analyzing → Settling on-chain)

### General

- [ ] **GEN-01**: App is deployed on Vercel (free tier)
- [ ] **GEN-02**: Works on desktop browsers (Chrome, Firefox, Safari)
- [ ] **GEN-03**: GitHub PAT optional env variable to raise API limit from 60/hr to 5,000/hr

## v2 Requirements

### Enhanced Analysis

- **ANAL-V2-01**: Two AI models analyze in parallel (GPT-4 + Claude) with consensus display
- **ANAL-V2-02**: Dependency vulnerability lookup via OSV.dev API
- **ANAL-V2-03**: Typosquatting detection (compare package name against known popular packages)

### Features

- **FEAT-V2-01**: Embeddable README badge (SVG) with live verdict link
- **FEAT-V2-02**: Analysis history stored in Vercel KV (persistent shareable results)
- **FEAT-V2-03**: GitHub App integration for automatic PR checks

## Out of Scope

| Feature | Reason |
|---------|--------|
| Private repository analysis | Requires OAuth, significantly more complexity |
| Full codebase static analysis | Too slow, too expensive, existing tools do it better |
| CVE database lookup | Different product (Snyk does this) — our value is AI + proof |
| Mobile app | Web-first; mobile later |
| Mainnet deployment | Testnet only for v1 — real money adds risk |
| AI model comparison UI | Deferred to v2 — single model is simpler and sufficient for proof of concept |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INPUT-01 | Phase 1 | Pending |
| INPUT-02 | Phase 1 | Pending |
| INPUT-03 | Phase 1 | Pending |
| ANAL-01 | Phase 2 | Pending |
| ANAL-02 | Phase 2 | Pending |
| ANAL-03 | Phase 2 | Pending |
| ANAL-04 | Phase 2 | Pending |
| ANAL-05 | Phase 2 | Pending |
| PAY-01 | Phase 3 | Pending |
| PAY-02 | Phase 3 | Pending |
| PAY-03 | Phase 3 | Pending |
| PAY-04 | Phase 3 | Pending |
| PAY-05 | Phase 3 | Pending |
| PROOF-01 | Phase 3 | Pending |
| PROOF-02 | Phase 3 | Pending |
| PROOF-03 | Phase 3 | Pending |
| PROOF-04 | Phase 4 | Pending |
| UI-01 | Phase 2 | Pending |
| UI-02 | Phase 2 | Pending |
| UI-03 | Phase 2 | Pending |
| UI-04 | Phase 2 | Pending |
| UI-05 | Phase 2 | Pending |
| GEN-01 | Phase 4 | Pending |
| GEN-02 | Phase 2 | Pending |
| GEN-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after initial definition*
