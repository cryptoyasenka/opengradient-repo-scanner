# Domain Pitfalls

**Domain:** Browser-based AI security checker with x402 micropayments + OpenGradient TEE inference
**Researched:** 2026-03-28
**Overall confidence:** MEDIUM — OpenGradient is a young testnet product with sparse public documentation; many specifics confirmed via architecture docs and adjacent ecosystem research.

---

## Critical Pitfalls

Mistakes that cause rewrites, broken UX, or wasted user funds.

---

### Pitfall 1: x402 Payment with No Wallet Connected

**What goes wrong:** User clicks "Analyze" without MetaMask or a compatible wallet installed/connected. The EIP-712 signature step fails silently or throws a cryptic provider error (`window.ethereum is undefined`).

**Why it happens:** x402 on the browser side relies on `eth_signTypedData_v4` (EIP-712). If no injected provider exists, wagmi/viem will throw immediately. Users unfamiliar with Web3 have no idea what this means.

**Consequences:** Hard failure with no actionable error message; user loses trust; if the payment header was partially constructed, edge cases can cause the analysis to fail after wallet prompt is rejected.

**Prevention:**
- Gate the "Analyze" button: disable it and show a "Connect Wallet" prompt if `useAccount().isConnected` is false
- Pre-flight check: resolve the wallet state before touching the payment flow at all
- Catch `UserRejectedRequestError` separately from other wallet errors and show "Payment cancelled" rather than a generic error

**Detection:** Any `window.ethereum` absence or wagmi `useAccount().status === 'disconnected'` state.

---

### Pitfall 2: Insufficient OPG Balance on Base Sepolia

**What goes wrong:** User has MetaMask connected but their Base Sepolia wallet has 0 OPG or less than 0.05 OPG. The EIP-712 signature succeeds (wallet signs happily), but the x402 facilitator rejects the payment with a `402 Payment Required` response, which the frontend may not handle cleanly.

**Why it happens:** Users don't know they need testnet OPG. They may have Sepolia ETH but not OPG tokens specifically. The `transferWithAuthorization` call will revert on-chain if allowance/balance is insufficient.

**Consequences:** User pays gas for a failed transaction, or sees a confusing `402` response from the OpenGradient LLM gateway after signing.

**Prevention:**
- Before triggering payment: check `balanceOf(userAddress, OPG_TOKEN)` using viem's `readContract`
- If balance < required amount, show a clear faucet link (https://faucet.opengradient.ai/) with copy text: "You need at least 0.05 OPG on Base Sepolia"
- Show current balance in the UI so users know their state

**Detection:** Check `X-PAYMENT-RESPONSE` header on 402 responses; the facilitator returns a reason string explaining rejection.

---

### Pitfall 3: x402 Payment-Before-Service Race Condition (Atomic Delivery Risk)

**What goes wrong:** x402 enforces a payment-first workflow: on-chain authorization is signed before inference runs. If the OpenGradient TEE node crashes, times out, or returns a malformed response after payment is accepted, the user has paid but received nothing.

**Why it happens:** x402 currently has no native escrow or atomic swap between payment and delivery. The protocol spec explicitly notes that service providers must execute "optimistically before payment finalization," creating a window of non-delivery risk. [Source: A402 paper, arxiv 2603.01179]

**Consequences:** User's OPG is spent; no result shown; no automatic refund path exists in the current testnet implementation.

**Prevention:**
- Implement a clear UI state: "Payment confirmed — awaiting analysis..." with a timeout
- On failure after payment: show "Payment was sent but analysis failed. This is a testnet — please try again." with the transaction hash so the user has a record
- Consider idempotency: store the tx hash client-side (localStorage) so a page refresh can check if analysis was already run for that payment

**Detection:** Timeout on the fetch to `llm.opengradient.ai` after 30–60 seconds; treat as "delivery failure after payment."

---

### Pitfall 4: GitHub API Rate Limit Exhaustion (60 req/hour Unauthenticated)

**What goes wrong:** The GitHub public REST API limits unauthenticated requests to 60 per hour per IP address. In May 2025, GitHub tightened these limits further in response to scraping activity. A typical repo analysis hits 3–5 endpoints (repo metadata, README, package.json, commits, file tree). At 60 req/hour, that is 12–20 analyses per hour max from a single server IP — or per user IP if calling from the browser.

**Why it happens:** The decision to use the GitHub public API without auth was made for simplicity. This works at low volume but becomes a hard ceiling quickly.

**Consequences:**
- GitHub returns HTTP 403 with `X-RateLimit-Remaining: 0`
- User gets a broken analysis result or an error screen
- If the app calls GitHub from the server (Vercel serverless), all users share the same server IP — hitting the limit with any meaningful traffic

**Prevention:**
- Call GitHub API from the browser (client-side fetch), not from the Vercel server. This distributes the rate limit across each user's IP.
- Check `X-RateLimit-Remaining` in response headers before each call; surface a clear warning if approaching 0
- Cache API responses in `sessionStorage` or a simple KV store (Vercel KV / Upstash) per repo URL with a 10-minute TTL — same repo analyzed twice in 10 minutes doesn't double the API calls
- Document the GitHub Personal Access Token option for users hitting limits; PAT increases limit to 5,000/hour

**Detection:** HTTP 403 response from `api.github.com` with `message: "API rate limit exceeded"`.

---

### Pitfall 5: Very Large Repository — Token Overflow Sent to OpenGradient

**What goes wrong:** A popular repo may have a 50KB README, a `package.json` with 200 dependencies, and multi-thousand-line source files. GPT-4 context is 128K tokens (~96K words); Claude is 200K tokens. But the OpenGradient gateway likely imposes its own limits on payload size. Naively concatenating all fetched content and sending it risks: (a) exceeding the model's context window, (b) very slow and expensive inference, (c) silent truncation causing the model to analyze an incomplete picture.

**Why it happens:** The project scope says "analysis of visible files" but doesn't define a maximum payload size. Repos vary enormously in size.

**Consequences:** Analysis silently analyzes only partial content; "Safe" verdict on a repo that has malicious code in a section that was truncated; or API error 400/413 payload too large.

**Prevention:**
- Define a strict budget per analysis: README (max 3,000 chars), package.json (max 2,000 chars), top-level file tree (max 50 files listed), last 5 commits messages only
- Truncate each piece individually with a visible note: "[truncated at 3000 chars]"
- Clearly state in the UI: "Analysis covers README, dependencies, and repo signals. Full code review is not performed."
- Use a structured prompt that explicitly lists the data sources being provided, so the model knows the scope

**Detection:** Track token count of the assembled prompt; log when truncation occurs.

---

## Moderate Pitfalls

---

### Pitfall 6: OpenGradient TEE Inference — Undocumented Latency and Limits

**What goes wrong:** OpenGradient's documentation explicitly does not publish latency SLAs, throughput limits, rate limits per API key, or cost-per-token figures as of March 2026. The platform is in testnet. This means:
- Response times are unknown and may vary 5–60+ seconds depending on model and load
- There is no documented retry policy if the TEE node becomes unavailable
- Running two models in parallel (per the project spec) doubles the uncertainty

**Consequences:** Users stare at a spinner with no feedback; if one of the two parallel model calls fails, the consensus logic breaks; no budget-based safeguard exists.

**Prevention:**
- Set a hard client-side timeout of 45 seconds per inference call; after that, show "Analysis took too long — please retry"
- Implement independent error handling for each model call; if one fails, present partial results from the other with a note
- Display a progress indicator (not a spinner) with step labels: "Fetching repo data → Sending to AI → Verifying on-chain"
- Test with both GPT-4 and Claude under simulated load before launch

**Confidence:** LOW — based on absence of published specs. Validate by testing directly against `llm.opengradient.ai` during implementation.

---

### Pitfall 7: INDIVIDUAL_FULL Settlement Mode — On-Chain Latency

**What goes wrong:** The project spec uses `INDIVIDUAL_FULL` settlement, which stores input/output hashes on-chain for maximum auditability. This settlement mode is the most expensive and slowest because it writes data on-chain per-request. On a testnet, finality may be inconsistent.

**Consequences:** The "verifiable proof badge" may not be available immediately after the analysis completes; the tx hash shown to users may be unconfirmed for 30+ seconds; block explorers may not index it instantly.

**Prevention:**
- Decouple the result display from settlement finality: show the AI verdict immediately, and update the proof badge asynchronously when the settlement tx is confirmed
- Store the pending tx hash client-side; poll for confirmation every 5 seconds up to 2 minutes
- Clearly label the badge as "Settlement Pending" until confirmed

---

### Pitfall 8: EIP-712 Signature User Experience Friction

**What goes wrong:** MetaMask and other wallets present EIP-712 typed data signing prompts that look intimidating to users unfamiliar with Web3. The prompt shows raw JSON fields including `validAfter`, `validBefore`, `nonce`, `from`, `to`, `value`. Many users will reject the signature out of fear.

**Why it happens:** x402 uses EIP-712 with `transferWithAuthorization` (ERC-3009). The wallet displays the raw typed data struct, which is not human-friendly.

**Consequences:** High abandonment rate at the payment step; users think they are signing something dangerous.

**Prevention:**
- Add a "What you're signing" explanation immediately before triggering the wallet prompt: "You're authorizing a one-time transfer of 0.05 OPG (~$X) to pay for this analysis"
- Show the exact OPG amount prominently; never trigger the signature without user-confirmed intent
- Use Coinbase Wallet or WalletConnect as alternatives to MetaMask — they have better EIP-712 display

---

### Pitfall 9: AI Verdict Accuracy — False Positives and False Negatives

**What goes wrong:** LLM-based code/repo analysis has a baseline false positive rate of 5–40% depending on the model and task. An 82% bug detection rate (best-in-class per Greptile's 2025 benchmarks) means 18% of real vulnerabilities are missed. The proposed three-category verdict (Safe/Risky/Dangerous) collapses a continuous risk spectrum into three buckets, overstating certainty.

**Specific limitations of this approach:**
- The analysis covers README, package.json, and surface-level file content — not deep static analysis or dataflow tracing
- Business logic flaws, authorization bypass, and race conditions are invisible without full codebase analysis
- A repo can have malicious code in a file that wasn't fetched (e.g., deeply nested in `src/utils/`)
- Active supply chain attacks (a dependency was compromised last week) won't be detected without a live CVE database lookup
- Repos with no README but malicious install scripts score deceptively "clean" on surface analysis

**Consequences:** A user installs a "Safe"-labeled package that later compromises their system; or a legitimate popular package gets flagged "Dangerous" based on unusual patterns in the README.

**Prevention:**
- Mandate a prominent disclaimer on every result: "This is an AI-assisted surface analysis, not a professional security audit. Always verify critical dependencies independently."
- Use hedged language in the verdict: "No obvious red flags detected" rather than "Safe"
- Show the AI's reasoning so users can evaluate it themselves, not just trust the label
- Add a confidence score alongside the verdict

---

## Minor Pitfalls

---

### Pitfall 10: Shareable Result Link — Permanence vs. Cost

**What goes wrong:** The project spec includes "shareable result links." If results are stored in a database (e.g., Vercel KV or Postgres), storage accumulates indefinitely. If results are reconstructed on demand, the user must re-pay to view a shared result.

**Prevention:**
- Store results in Vercel KV with a 30-day TTL; after expiry, link shows "Result expired"
- Alternative: encode the full verdict payload in the URL as a base64 query param — no database needed, but URLs become long

---

### Pitfall 11: Vercel Free Tier Cold Starts + Serverless Timeouts

**What goes wrong:** Vercel free tier serverless functions have a 10-second execution limit by default. If the GitHub API calls + OpenGradient inference are all server-side, a slow TEE response will hit this limit. Vercel Pro allows 60 seconds; Enterprise up to 900 seconds.

**Prevention:**
- Do GitHub API calls client-side (browser) to avoid serverless timeout
- If a backend route is used as a proxy for OpenGradient, set `export const maxDuration = 60` in the route config (requires Vercel Pro, or keep calls client-side)

---

### Pitfall 12: Base Sepolia OPG Token Address Hard-Coded

**What goes wrong:** The OPG token address (`0x240b09731D96979f50B2C649C9CE10FcF9C7987F`) is a testnet contract. If OpenGradient migrates or redeploys it, all payment flows break silently.

**Prevention:**
- Store the token address in a `.env` variable, not inline in code
- Add an on-startup check: call `symbol()` on the contract to verify it returns "OPG"

---

## Legal and Ethical Considerations

### The "Dangerous" Label Problem

**Risk:** Publicly and persistently labeling a GitHub repository as "Dangerous" based on AI inference creates real legal exposure. Under US defamation doctrine, a false statement of fact published to third parties that damages reputation is actionable. AI-generated security verdicts that are incorrect could constitute defamation toward project maintainers, especially if:
- The result is shareable (the spec calls for shareable links)
- The verdict is framed as fact rather than opinion
- The AI hallucinates specific false claims (e.g., "this package contains a backdoor")

**Bloomberg Law (2025)** notes courts are actively adapting defamation law to AI-generated content, with plaintiffs successfully suing over AI systems that "fabricated criminal histories" or "attributed extremist beliefs." A false "Dangerous" label on a legitimate library is analogous.

**Mitigation — non-negotiable:**
1. Frame verdicts as AI opinion, not fact: "AI analysis suggests this repository may present risk" not "This repository is Dangerous"
2. Include a legal disclaimer on every result: "This verdict is generated by AI and is not a professional security assessment. The operator of this tool accepts no liability for decisions made based on these results."
3. Add a "Report incorrect verdict" link — giving maintainers recourse reduces legal exposure
4. Do not index or make shared results crawlable by search engines (add `noindex` to result pages) — reduces the "publication" surface

**Confidence:** MEDIUM — based on Bloomberg Law reporting and general US defamation doctrine; not legal advice.

---

## Competition Analysis

### How This Project Differs From Existing Tools

| Tool | Approach | Scope | Verdict Style | Payment | Verifiable? |
|------|----------|-------|---------------|---------|-------------|
| **Socket.dev** | Deep package inspection + behavioral analysis + AI summaries | npm/pip/Go packages; not arbitrary GitHub repos | Risk scores per package; blocks installs | Free tier + paid SaaS | No cryptographic proof |
| **Snyk OSS** | CVE database lookup + SAST + reachability analysis | Dependencies in a repo; requires code access | Known CVEs with severity | Free tier + paid SaaS | No cryptographic proof |
| **deps.dev** | Dependency graph + OSV advisory database cross-reference | Package ecosystems (npm, PyPI, Go, etc.) | Known vulnerabilities and license issues | Free | No cryptographic proof |
| **GitHub Advisory Database + Dependabot** | CVE/OSV advisory matching on your repo's dependencies | Only repos you own/have access to | Dependabot alerts via PR | Free (for public repos) | No cryptographic proof |
| **OpenSSF Scorecard** | Static heuristics: branch protection, code review, CI/CD, signing | Any public GitHub repo | Numeric score (0–10) by category | Free | No cryptographic proof |
| **This project** | AI analysis of surface content (README, deps, repo signals) via TEE | Any public GitHub repo URL | Safe/Risky/Dangerous with AI reasoning | Micropayment per check | Cryptographic TEE proof on-chain |

**Key differentiation this project has:**
- The only tool producing a cryptographically verified, shareable AI verdict (cannot be faked or modified after generation)
- The only tool requiring zero repo access (just a URL, no install, no GitHub auth)
- First tool using x402 micropayment to gate AI security analysis

**Key gaps vs. existing tools:**
- No CVE database integration (Socket, Snyk, Dependabot all have this) — explicitly out of scope for v1
- No install-time blocking (Socket Firewall blocks at npm install time) — not applicable to this web app model
- Lower analysis depth than Socket or Snyk — AI surface analysis vs. deep static analysis

**Strategic verdict:** This project does not compete head-to-head with Socket or Snyk. It occupies a distinct niche: quick, zero-friction, cryptographically verifiable AI opinion for an arbitrary GitHub URL. The proof/verifiability angle is the only genuinely novel moat.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| x402 payment integration | Wallet not connected; insufficient OPG balance | Pre-flight wallet + balance checks before payment flow |
| GitHub data fetching | Rate limit exhaustion (60/hr per IP) | Client-side calls; per-repo cache; clearly show 403 errors |
| OpenGradient inference | Undocumented latency; no published rate limits | 45s timeout; independent error handling per model; progress UI |
| Content assembly for AI | Token overflow for large repos | Hard per-field character budgets; visible truncation note |
| Settlement & proof badge | INDIVIDUAL_FULL is slow; testnet finality unreliable | Decouple result display from settlement; async badge update |
| Sharing results | Legal exposure from persistent "Dangerous" labels | Disclaim as AI opinion; add report link; noindex result pages |
| Vercel deployment | 10s function timeout | Client-side GitHub calls; `maxDuration = 60` for proxy routes |
| Result display | False verdicts damaging reputation of legitimate repos | Hedged language; strong disclaimers; confidence scoring |

---

## Sources

- [x402 Whitepaper — x402.org](https://www.x402.org/x402-whitepaper.pdf)
- [x402 GitHub Repository — Coinbase](https://github.com/coinbase/x402)
- [A402: Bridging Web 3.0 Payments and Web 2.0 Services — arxiv 2603.01179](https://arxiv.org/html/2603.01179v1) — source for atomicity/non-payment risk analysis
- [OpenGradient x402 Upgrade Blog Post](https://www.opengradient.ai/blog/x402-opengradient-upgrade-trustless-verifiable-inference)
- [OpenGradient Inference Node Docs](https://docs.opengradient.ai/learn/architecture/inference_nodes.html)
- [GitHub REST API Rate Limits Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitHub Rate Limit Update — May 2025](https://github.blog/changelog/2025-05-08-updated-rate-limits-for-unauthenticated-requests/)
- [AI Code Review Accuracy — State of Tools 2025](https://www.devtoolsacademy.com/blog/state-of-ai-code-review-tools-2025/)
- [Greptile AI Code Review Benchmarks 2025](https://www.greptile.com/benchmarks)
- [Veracode GenAI Code Security Report 2025](https://www.veracode.com/blog/genai-code-security-report/)
- [AI Defamation Legal Risks — Bloomberg Law 2025](https://news.bloomberglaw.com/legal-exchange-insights-and-commentary/courts-navigating-ai-defamation-opens-legal-risks-for-companies)
- [Socket.dev vs Snyk Comparison](https://socket.dev/compare/socket-vs-snyk)
- [Socket Security $40M Funding — TechCrunch 2024](https://techcrunch.com/2024/10/22/socket-lands-a-fresh-40m-to-scan-software-for-security-flaws/)
- [x402 Payment Flow Implementation Guide — QuickNode](https://www.quicknode.com/guides/infrastructure/how-to-use-x402-payment-required)
- [5 Approaches to LLM Token Limits — Deepchecks](https://www.deepchecks.com/5-approaches-to-solve-llm-token-limits/)
- [AI Bug Hunters Spamming Open Source — Axios March 2026](https://www.axios.com/2026/03/10/ai-agents-spam-the-volunteers-securing-open-source-software)
- [OWASP LLM09:2025 Misinformation](https://genai.owasp.org/llmrisk/llm092025-misinformation/)
