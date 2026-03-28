---
id: "04-03"
title: "Vercel deployment + project README"
wave: 2
depends_on: ["04-01", "04-02"]
files_modified:
  - README.md
  - .env.example
  - .gitignore
autonomous: true
requirements_addressed:
  - GEN-01

must_haves:
  truths:
    - "README.md explains what the app does, how to run it locally, and what env vars are needed"
    - ".env.example documents all required and optional env vars"
    - "The app builds on Vercel without errors"
    - "README includes the tech stack"
  artifacts:
    - path: "README.md"
      provides: "Project README for GitHub"
      contains: "## Setup"
    - path: ".env.example"
      provides: "All required env vars documented"
      contains: "APP_WALLET_PRIVATE_KEY"
---

<objective>
Create the project README and finalize .env.example for handoff. The README is the entry point for anyone picking up this repo — it must explain the project, how to set it up, and what each env var does.

Vercel deployment is configuration-only (no code): set env vars in Vercel dashboard and connect the repo.
</objective>

<execution_context>
@C:/Users/Yana/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Yana/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/PROJECT.md
@.planning/research/STACK.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create .env.example and update .gitignore</name>

  <read_first>
    - .gitignore (check .env.local is already ignored)
    - .env.local.example (if exists — consolidate into .env.example)
  </read_first>

  <files>.env.example, .gitignore</files>

  <action>
**Step 1: Create `.env.example`** (this is the canonical env var reference — commit this to git):

```bash
# =============================================================================
# GitHub Security Checker — Environment Variables
# =============================================================================
# Copy this file to .env.local and fill in the values.
# NEVER commit .env.local — it contains secrets.

# -----------------------------------------------------------------------------
# OpenGradient / x402 Payment (REQUIRED)
# -----------------------------------------------------------------------------
# A wallet private key funded with OPG tokens on Base Sepolia.
# This wallet pays for AI inference via the x402 protocol.
# Generate a new wallet: https://app.safe.global/ or any EVM wallet
# Fund it with OPG: https://faucet.opengradient.ai/
APP_WALLET_PRIVATE_KEY=0x_your_private_key_here

# -----------------------------------------------------------------------------
# WalletConnect (REQUIRED for wallet connection UI)
# -----------------------------------------------------------------------------
# Get your project ID at https://cloud.walletconnect.com (free tier is sufficient)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id_here

# -----------------------------------------------------------------------------
# GitHub API (OPTIONAL but strongly recommended)
# -----------------------------------------------------------------------------
# A GitHub Personal Access Token (PAT) with no extra scopes.
# Without this: 60 requests/hour shared by all users (problematic for deployed apps)
# With this: 5,000 requests/hour per token
# Create at: https://github.com/settings/tokens/new (select no scopes → Generate)
GITHUB_TOKEN=ghp_your_token_here
```

**Step 2: Update `.gitignore`** — ensure these lines are present (add if missing):
```
.env.local
.env.*.local
```

Delete `.env.local.example` if it exists (replaced by `.env.example`).
  </action>

  <acceptance_criteria>
    - `.env.example` exists at project root
    - `.env.example` contains `APP_WALLET_PRIVATE_KEY`
    - `.env.example` contains `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
    - `.env.example` contains `GITHUB_TOKEN`
    - `.env.example` has comments explaining what each var does and where to get the value
    - `.gitignore` contains `.env.local`
  </acceptance_criteria>

  <done>.env.example documents all env vars with setup instructions. .gitignore prevents secret leaks.</done>
</task>

<task type="auto">
  <name>Task 2: Write project README.md</name>

  <read_first>
    - .planning/PROJECT.md (project goals, challenge context)
    - .planning/ROADMAP.md (phase list, tech decisions)
    - .planning/research/STACK.md (exact package versions, tech stack table)
    - package.json (actual project name, scripts)
  </read_first>

  <files>README.md</files>

  <action>
Create `README.md` at the project root:

```markdown
# GitHub Security Checker

AI-powered supply chain security analyzer for public GitHub repositories. Paste any GitHub repo URL, pay a micro-fee with OPG tokens, and get a cryptographically verified security verdict — Safe, Risky, or Dangerous — backed by an on-chain proof from OpenGradient's TEE infrastructure.

Built for the [OpenGradient Community Challenge](https://opengradient.ai).

---

## What it does

1. **Fetches** — pulls repo metadata, commits, contributors, README, package.json, and GitHub Actions workflows via the GitHub REST API
2. **Analyzes** — sends the data bundle to OpenGradient's LLM inference gateway (GPT-4o) with a structured security prompt covering 7 signal categories
3. **Verifies** — the AI inference is executed in a Trusted Execution Environment (TEE) and recorded on Base Sepolia (INDIVIDUAL_FULL mode) — the verdict is tamper-evident
4. **Shares** — shareable result URLs encode the verdict in query params; anyone with the link sees the result without paying again

### Security signals analyzed

| Category | What it checks |
|----------|---------------|
| Account Credibility | Owner account age, repo count, followers |
| Repository Credibility | Repo age, stars, license, topics |
| Package Manifest Risks | postinstall hooks, curl/wget in scripts, typosquatting |
| Code Behavior Risks | base64-encoded exec blocks, obfuscated init code |
| Commit Integrity | Commit frequency, author consistency, timing anomalies |
| README Red Flags | External payment links, piracy claims, unrealistic promises |
| GitHub Actions Risks | Remote script fetches, mutable action tags, secret logging |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router), TypeScript |
| Styling | Tailwind CSS v4, shadcn/ui |
| AI Inference | OpenGradient x402 gateway (`https://llm.opengradient.ai`) |
| Payment | x402 protocol, `@x402/fetch`, Base Sepolia |
| Wallet | wagmi v2, viem v2, RainbowKit |
| URL State | nuqs |
| Deployment | Vercel |

---

## Setup

### Prerequisites

- Node.js 18+
- A MetaMask wallet
- OPG tokens on Base Sepolia (free from [faucet.opengradient.ai](https://faucet.opengradient.ai))
- WalletConnect project ID (free from [cloud.walletconnect.com](https://cloud.walletconnect.com))

### Local development

```bash
# 1. Clone and install
git clone <this-repo>
cd github-security-checker
npm install

# 2. Configure env vars
cp .env.example .env.local
# Edit .env.local and fill in all three values (see below)

# 3. Run dev server
npm run dev
# Open http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_WALLET_PRIVATE_KEY` | Yes | Private key of a wallet funded with OPG on Base Sepolia |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | Yes | WalletConnect project ID (from cloud.walletconnect.com) |
| `GITHUB_TOKEN` | No | GitHub PAT — raises rate limit from 60 to 5,000 req/hr |

### Getting OPG tokens

1. Switch MetaMask to **Base Sepolia** network
2. Visit [faucet.opengradient.ai](https://faucet.opengradient.ai)
3. Enter your wallet address and claim tokens

---

## Project structure

```
src/
  app/
    api/
      fetch-repo/route.ts   — fetches GitHub data
      analyze/route.ts      — calls OpenGradient, handles x402 payment
    result/page.tsx          — shareable result page (no payment required)
    page.tsx                 — main app page
  components/
    VerdictDisplay.tsx       — verdict banner + score + findings
    CategoryAccordion.tsx    — expandable per-category analysis
    ProofBadge.tsx           — on-chain proof display
    ShareButton.tsx          — copy URL to clipboard
    AnalysisProgress.tsx     — step progress indicator
  lib/
    github.ts                — GitHub API client (8 endpoints)
    opengradient.ts          — OpenGradient inference client
    web3/config.ts           — wagmi config, chain constants
  types/
    github.ts                — RepoData type
    verdict.ts               — VerdictResult type
```

---

## Deployment (Vercel)

1. Push this repo to GitHub
2. Import the repo in [vercel.com/new](https://vercel.com/new)
3. Add env vars in **Settings → Environment Variables**:
   - `APP_WALLET_PRIVATE_KEY`
   - `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID`
   - `GITHUB_TOKEN` (optional)
4. Deploy

No `vercel.json` needed — Next.js 15 is zero-config on Vercel.

---

## License

MIT
```
  </action>

  <acceptance_criteria>
    - `README.md` exists at project root
    - README contains `## Setup` section
    - README contains env vars table with all 3 variables
    - README contains `## Tech stack` table
    - README contains link to `faucet.opengradient.ai`
    - README contains project structure section
    - README contains Vercel deployment steps
  </acceptance_criteria>

  <done>README.md written. Anyone cloning the repo can understand the project and set it up without additional context.</done>
</task>

</tasks>

<verification>
```bash
# Verify env example
grep "APP_WALLET_PRIVATE_KEY" .env.example
grep "NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID" .env.example
grep "GITHUB_TOKEN" .env.example

# Verify README
grep "## Setup" README.md
grep "faucet.opengradient.ai" README.md
grep "APP_WALLET_PRIVATE_KEY" README.md

# Final build
npm run build
```
</verification>

<success_criteria>
- .env.example documents all env vars with where to get each value
- README explains the project, setup, env vars, structure, and Vercel deployment
- npm run build exits 0
- Anyone unfamiliar with the project can read README and get it running
</success_criteria>

<output>
After completion, create `.planning/phases/04-polish-deploy/04-03-SUMMARY.md`
</output>
