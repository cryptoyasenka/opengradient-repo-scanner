# GitHub Security Checker

AI-powered supply chain security analysis for GitHub repositories, verified on-chain.

## What it does

Paste any public GitHub repo URL and get an instant security verdict — **Safe**, **Risky**, or **Dangerous** — with a 0–100 risk score and a breakdown across 7 categories:

- Dependency health (package.json, lock files)
- CI/CD pipeline (GitHub Actions workflows)
- Maintainer credibility & contributor patterns
- Commit history & release cadence
- Secret exposure risk
- Code quality signals
- License & compliance

If `APP_WALLET_PRIVATE_KEY` is set, analysis is paid via [x402](https://x402.org/) micropayments on Base Sepolia and the result is verified by [OpenGradient TEE](https://opengradient.ai/). The on-chain proof is shown as a badge with a Basescan link.

Results are shareable — encoded into the URL so anyone with the link can view the verdict without re-running analysis.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind CSS v4
- **OpenGradient** — LLM inference gateway (GPT-4o)
- **x402** — HTTP-native micropayment protocol for AI inference
- **wagmi v2 + RainbowKit** — wallet connection (Base Sepolia)
- **nuqs** — URL-encoded shareable state

## Getting started

```bash
git clone https://github.com/cryptoyasenka/github-security-checker
cd github-security-checker
npm install
cp .env.example .env.local
# fill in .env.local (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | No | GitHub PAT (no scopes needed). Raises rate limit from 60 to 5000 req/hr |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | Yes | WalletConnect Cloud project ID for RainbowKit |
| `APP_WALLET_PRIVATE_KEY` | No | Private key of a Base Sepolia wallet holding OPG tokens. Enables x402 payments + on-chain proof |

Without `APP_WALLET_PRIVATE_KEY` the app falls back to direct AI calls (no on-chain proof badge).

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run lint     # ESLint
```

## License

MIT
