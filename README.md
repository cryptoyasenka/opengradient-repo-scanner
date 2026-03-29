# GitHub Security Checker

AI-powered supply chain security analysis for GitHub repositories, verified on-chain via [OpenGradient TEE](https://opengradient.ai/).

**[Live Demo](https://github-security-checker.vercel.app)**

## What it does

Paste any public GitHub repo URL and get an instant security verdict — **Safe**, **Risky**, or **Dangerous** — with a 0–100 risk score and detailed breakdown across 7 categories:

- Account credibility (owner age, repos, followers)
- Repository credibility (age, stars, license, description)
- Package manifest risks (postinstall hooks, typosquatting)
- Code behavior risks (obfuscation, base64+exec, network calls)
- Commit integrity (frequency, author consistency, timing)
- README red flags (payment links, unrealistic promises)
- GitHub Actions risks (external fetches, mutable tags, secret logging)

Every analysis is executed inside a **Trusted Execution Environment (TEE)** on the OpenGradient network. The TEE cryptographically signs the result, proving the AI output has not been tampered with. The on-chain proof is displayed as a verification badge.

Results are shareable — encoded into the URL so anyone with the link can view the verdict without re-running analysis.

## Architecture

```
User enters GitHub repo URL
        │
        ▼
  /api/fetch-repo ──► GitHub API
        │                 │
        │         repo metadata, commits,
        │         README, package.json,
        │         workflows, contributors
        │                 │
        ▼                 ▼
  /api/analyze ◄── assembled repo data
        │
        ▼
  OpenGradient Devnet (chain 10740)
  TEE Registry smart contract
        │
        ▼
  Discover active TEE node endpoint
        │
        ▼
  TEE node returns 402 Payment Required
        │
        ▼
  Server wallet signs Permit2 (x402/upto)
  Payment on Base Sepolia (eip155:84532)
        │
        ▼
  TEE executes claude-haiku-4-5
  inside secure enclave
        │
        ▼
  Returns verdict JSON + TEE signature
  (x-tee-signature, x-tee-output-hash)
        │
        ▼
  UI displays verdict + proof badge
```

### Key design decisions

- **Server-side payment** — the app wallet pays for AI inference, so users don't need to connect a wallet
- **On-chain TEE discovery** — the app reads the TEE Registry contract on OpenGradient Devnet to find active nodes dynamically, rather than hardcoding endpoints
- **x402 protocol** — HTTP-native micropayments: the TEE node responds with `402 Payment Required`, the server signs a Permit2 authorization, and the paid request returns the AI result

## Stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind CSS v4** + shadcn/ui
- **OpenGradient TEE** — verified AI inference (claude-haiku-4-5)
- **x402 / upto** — HTTP micropayment protocol (Permit2 on Base Sepolia)
- **viem** — blockchain interactions (TEE registry reads, payment signing)
- **nuqs** — URL-encoded shareable state

## Getting started

```bash
git clone https://github.com/cryptoyasenka/github-security-checker
cd github-security-checker
npm install --legacy-peer-deps
cp .env.example .env.local
# fill in .env.local (see below)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_WALLET_PRIVATE_KEY` | Yes | Private key of a Base Sepolia wallet with test tokens. Used for x402 payments to TEE nodes |
| `GITHUB_TOKEN` | Recommended | GitHub PAT (no scopes needed). Raises rate limit from 60 to 5,000 req/hr |

## Scripts

```bash
npm run dev      # development server
npm run build    # production build
npm run lint     # ESLint
```

## Built with OpenGradient

This project demonstrates how [OpenGradient](https://opengradient.ai/) enables **verifiable AI inference**:

1. AI models run inside TEE (Trusted Execution Environments)
2. Every response is cryptographically signed by the TEE enclave
3. TEE nodes are registered on-chain — anyone can verify which enclaves are active
4. Payment is handled via the x402 micropayment protocol, making AI calls as simple as HTTP requests

## License

MIT
