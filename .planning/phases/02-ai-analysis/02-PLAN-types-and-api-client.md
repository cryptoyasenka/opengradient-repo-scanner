---
id: "02-1"
title: "VerdictResult Types + OpenGradient API Client"
wave: 1
depends_on: []
files_modified:
  - src/types/verdict.ts
  - src/lib/opengradient.ts
  - src/app/api/analyze/route.ts
autonomous: true
requirements_addressed:
  - ANAL-04
  - ANAL-05

must_haves:
  truths:
    - "POST /api/analyze with a valid RepoData body returns a VerdictResult JSON within 45 seconds"
    - "POST /api/analyze with a malformed body returns 400 with a typed error"
    - "When OpenGradient returns a non-200 response, /api/analyze returns 502 with {error: '...'} — the user is not left hanging"
    - "The response JSON contains all VerdictResult fields: verdict, overall_score, categories, top_findings, reasoning"
    - "The AI response is parsed and validated — if JSON is malformed a fallback error is returned, not a crash"
  artifacts:
    - path: "src/types/verdict.ts"
      provides: "TypeScript types for VerdictResult and all nested shapes"
      exports:
        - "VerdictResult"
        - "VerdictCategory"
        - "VerdictLevel"
        - "AnalyzeError"
    - path: "src/lib/opengradient.ts"
      provides: "Server-only function that calls OpenGradient, parses response, returns VerdictResult"
      contains: "import 'server-only'"
      exports:
        - "analyzeRepo"
    - path: "src/app/api/analyze/route.ts"
      provides: "POST /api/analyze route handler"
      contains: "export async function POST"
  key_links:
    - from: "src/app/api/analyze/route.ts"
      to: "src/lib/opengradient.ts"
      via: "import analyzeRepo"
      pattern: "analyzeRepo"
    - from: "src/lib/opengradient.ts"
      to: "https://llm.opengradient.ai/v1/chat/completions"
      via: "fetch POST"
      pattern: "llm.opengradient.ai"
    - from: "src/app/api/analyze/route.ts"
      to: "src/types/verdict.ts"
      via: "import VerdictResult"
      pattern: "VerdictResult"
---

<objective>
Define VerdictResult TypeScript types, implement the OpenGradient API client function, and create the /api/analyze route handler. This plan establishes the data contracts that the prompt-builder (Plan 02) and UI (Plans 03–04) depend on.

Purpose: Phase 2's core value — calling the OpenGradient LLM and getting back structured security analysis — lives here.
Output: Working POST /api/analyze route that accepts RepoData and returns VerdictResult JSON without any payment gate (direct HTTP call for dev/testing).
</objective>

<execution_context>
@C:/Users/Yana/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Yana/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/research/STACK.md
@.planning/research/FEATURES.md
@.planning/research/ARCHITECTURE.md
@.planning/research/PITFALLS.md
</context>

<interfaces>
<!-- Types from Phase 1 that this plan consumes. -->
<!-- Source of truth: src/types/github.ts (created in Plan 01-2) -->

```typescript
// From src/types/github.ts (Phase 1 output — do not redefine):
interface RepoData {
  repo: {
    full_name: string;
    description: string | null;
    created_at: string;
    pushed_at: string;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    license: { name: string; spdx_id: string } | null;
    topics: string[];
    language: string | null;
    archived: boolean;
    default_branch: string;
    owner: { login: string; created_at?: string; public_repos?: number; followers?: number };
  };
  contributors: Array<{ login: string; contributions: number; type: string }>;
  recentCommits: Array<{
    sha: string;
    commit: { message: string; author: { name: string; email: string; date: string } };
    author: { login: string } | null;
  }>;
  readmeText: string;
  packageJson: Record<string, unknown> | null;
  workflowFiles: Array<{ name: string; content: string }>;
  rateLimitRemaining: number;
  rateLimitWarning: boolean;
}
```

<!-- Types this plan CREATES — downstream plans 02-2, 02-3, 02-4 depend on these. -->
<!-- Executor: define these exactly in src/types/verdict.ts before implementing opengradient.ts. -->

```typescript
// src/types/verdict.ts — define these exact exports

export type VerdictLevel = 'Safe' | 'Risky' | 'Dangerous';

export type CategoryRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface VerdictCategory {
  risk_level: CategoryRiskLevel;
  findings: string;
}

export interface VerdictResult {
  verdict: VerdictLevel;
  overall_score: number;          // 0–100 integer
  categories: {
    account_credibility: VerdictCategory;
    repository_credibility: VerdictCategory;
    package_manifest_risks: VerdictCategory;
    code_behavior_risks: VerdictCategory;
    commit_integrity: VerdictCategory;
    readme_red_flags: VerdictCategory;
    github_actions_risks: VerdictCategory;
  };
  top_findings: string[];         // 3–5 items
  reasoning: string;              // 2–3 sentences
  modelUsed: string;              // e.g. "openai/gpt-4o"
  analyzedAt: string;             // ISO timestamp
}

export interface AnalyzeError {
  error: string;
  code: 'INVALID_INPUT' | 'AI_PARSE_ERROR' | 'AI_API_ERROR' | 'TIMEOUT' | 'SERVER_ERROR';
}
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Define verdict types and implement opengradient.ts</name>

  <read_first>
    - src/types/github.ts (RepoData shape — exact field names to pass to buildSecurityPrompt)
    - .planning/research/STACK.md (OpenGradient endpoint URL, request format, model strings, NO payment header in Phase 2)
    - .planning/research/FEATURES.md (AI prompt structure section — exact system prompt text, output JSON schema, 7 category names)
    - .planning/research/PITFALLS.md (Pitfall 5 — token overflow, Pitfall 6 — undocumented latency and 45s timeout)
    - .planning/research/ARCHITECTURE.md (Anti-Pattern 2 — do not store secrets in client; import 'server-only')
  </read_first>

  <files>src/types/verdict.ts, src/lib/opengradient.ts</files>

  <action>
**Step 1: Create src/types/verdict.ts**

Create the file with exactly the types shown in the `<interfaces>` block above (VerdictLevel, CategoryRiskLevel, VerdictCategory, VerdictResult, AnalyzeError). Do not deviate from these type names — Plans 02-2 through 02-4 import from this file.

**Step 2: Create src/lib/opengradient.ts**

Start with `import 'server-only'` as the first line.

Add an env var check at module load time:
```typescript
const OPENGRADIENT_URL = 'https://llm.opengradient.ai/v1/chat/completions';
const MODEL = 'openai/gpt-4o';
const FALLBACK_MODEL = 'anthropic/claude-haiku-4-5';
```

Implement `buildSecurityPrompt(data: RepoData): string` that assembles a JSON bundle from RepoData and returns the full prompt string. The prompt string is a single user message that includes:

1. The system instruction (inline in the user message for simplicity — OpenGradient may not have a separate system role):

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

Respond ONLY with valid JSON matching this exact schema. No markdown fences, no explanation outside the JSON:
{
  "overall_score": <integer 0-100>,
  "verdict": "Safe" | "Risky" | "Dangerous",
  "categories": {
    "account_credibility": { "risk_level": "none|low|medium|high|critical", "findings": "..." },
    "repository_credibility": { "risk_level": "none|low|medium|high|critical", "findings": "..." },
    "package_manifest_risks": { "risk_level": "none|low|medium|high|critical", "findings": "..." },
    "code_behavior_risks": { "risk_level": "none|low|medium|high|critical", "findings": "..." },
    "commit_integrity": { "risk_level": "none|low|medium|high|critical", "findings": "..." },
    "readme_red_flags": { "risk_level": "none|low|medium|high|critical", "findings": "..." },
    "github_actions_risks": { "risk_level": "none|low|medium|high|critical", "findings": "..." }
  },
  "top_findings": ["...", "...", "..."],
  "reasoning": "..."
}
```

2. The repo data bundle (JSON.stringify the assembled object):

```typescript
const bundle = {
  repo: {
    full_name: data.repo.full_name,
    description: data.repo.description,
    created_at: data.repo.created_at,
    pushed_at: data.repo.pushed_at,
    stargazers_count: data.repo.stargazers_count,
    forks_count: data.repo.forks_count,
    open_issues_count: data.repo.open_issues_count,
    license: data.repo.license,
    topics: data.repo.topics,
    language: data.repo.language,
    archived: data.repo.archived,
  },
  owner: {
    login: data.repo.owner.login,
    created_at: data.repo.owner.created_at,
    public_repos: data.repo.owner.public_repos,
    followers: data.repo.owner.followers,
  },
  contributors: data.contributors.slice(0, 5),
  recent_commits: data.recentCommits.slice(0, 10).map(c => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split('\n')[0].slice(0, 100), // first line, max 100 chars
    author: c.commit.author.name,
    email: c.commit.author.email,
    date: c.commit.author.date,
  })),
  readme_text: data.readmeText.slice(0, 2000), // already truncated by github.ts but cap again
  package_json: data.packageJson
    ? JSON.stringify(data.packageJson).slice(0, 2000)
    : null,
  workflow_files: data.workflowFiles.map(w => ({
    name: w.name,
    content: w.content.slice(0, 1500), // cap per-file to stay within token budget
  })),
};
```

Full prompt = system instruction text + '\n\nREPOSITORY DATA:\n' + JSON.stringify(bundle, null, 2)

Implement `analyzeRepo(data: RepoData): Promise<VerdictResult>`:

```typescript
export async function analyzeRepo(data: RepoData): Promise<VerdictResult> {
  const prompt = buildSecurityPrompt(data);

  // Phase 2: direct call — no X-PAYMENT header (payment added in Phase 3)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000); // 45s hard timeout per Pitfall 6

  let response: Response;
  try {
    response = await fetch(OPENGRADIENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw Object.assign(new Error('OpenGradient request timed out after 45 seconds'), {
        code: 'TIMEOUT' as const,
      });
    }
    throw Object.assign(new Error('Failed to reach OpenGradient API'), {
      code: 'AI_API_ERROR' as const,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw Object.assign(
      new Error(`OpenGradient returned ${response.status}: ${body.slice(0, 200)}`),
      { code: 'AI_API_ERROR' as const }
    );
  }

  const responseData = await response.json();
  const rawContent: string = responseData?.choices?.[0]?.message?.content ?? '';

  // Strip potential markdown fences before parsing
  const jsonStr = rawContent
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: VerdictResult;
  try {
    const raw = JSON.parse(jsonStr);
    // Validate required fields are present
    if (
      typeof raw.overall_score !== 'number' ||
      !['Safe', 'Risky', 'Dangerous'].includes(raw.verdict) ||
      !raw.categories ||
      !Array.isArray(raw.top_findings) ||
      typeof raw.reasoning !== 'string'
    ) {
      throw new Error('Missing or invalid required fields in AI response');
    }
    parsed = {
      ...raw,
      modelUsed: MODEL,
      analyzedAt: new Date().toISOString(),
    } as VerdictResult;
  } catch (parseErr) {
    console.error('[opengradient] Failed to parse AI response:', rawContent.slice(0, 500));
    throw Object.assign(
      new Error('AI returned malformed JSON — could not parse verdict'),
      { code: 'AI_PARSE_ERROR' as const }
    );
  }

  return parsed;
}
```

Export only: `analyzeRepo` (buildSecurityPrompt is internal — do not export).
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>

  <acceptance_criteria>
    - `src/types/verdict.ts` contains `export type VerdictLevel = 'Safe' | 'Risky' | 'Dangerous'`
    - `src/types/verdict.ts` contains `export interface VerdictResult`
    - `src/types/verdict.ts` contains `export interface AnalyzeError`
    - `src/types/verdict.ts` VerdictResult has `modelUsed` and `analyzedAt` fields
    - `src/lib/opengradient.ts` first line is `import 'server-only'`
    - `src/lib/opengradient.ts` contains `export async function analyzeRepo`
    - `src/lib/opengradient.ts` contains `AbortController` and `45_000` (timeout implementation)
    - `src/lib/opengradient.ts` contains `llm.opengradient.ai` (correct endpoint)
    - `src/lib/opengradient.ts` contains `openai/gpt-4o` (model string)
    - `src/lib/opengradient.ts` contains `temperature: 0.2` (low-temperature for determinism)
    - `src/lib/opengradient.ts` strips markdown fences before JSON.parse (contains `.replace`)
    - `src/lib/opengradient.ts` validates `['Safe', 'Risky', 'Dangerous'].includes(raw.verdict)`
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>VerdictResult types defined and opengradient.ts implements analyzeRepo with 45s timeout, response validation, and markdown fence stripping.</done>
</task>

<task type="auto">
  <name>Task 2: Implement /api/analyze route handler</name>

  <read_first>
    - src/types/verdict.ts (just created — VerdictResult and AnalyzeError)
    - src/types/github.ts (RepoData — the request body shape)
    - src/lib/opengradient.ts (just created — analyzeRepo function signature)
    - .planning/research/ARCHITECTURE.md (maxDuration config, force-dynamic, Anti-Pattern 4)
    - .planning/research/PITFALLS.md (Pitfall 3 — delivery failure after payment note; Pitfall 6 — timeout)
  </read_first>

  <files>src/app/api/analyze/route.ts</files>

  <action>
Create `src/app/api/analyze/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepo } from '@/lib/opengradient';
import type { RepoData } from '@/types/github';
import type { AnalyzeError } from '@/types/verdict';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Vercel Fluid Compute — AI inference can take up to 45s

export async function POST(req: NextRequest) {
  let body: { repoData?: RepoData };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<AnalyzeError>(
      { error: 'Request body must be JSON with a "repoData" field', code: 'INVALID_INPUT' },
      { status: 400 }
    );
  }

  const { repoData } = body;

  // Validate required RepoData fields are present
  if (!repoData || typeof repoData !== 'object' || !repoData.repo?.full_name) {
    return NextResponse.json<AnalyzeError>(
      { error: 'Missing or invalid "repoData" in request body', code: 'INVALID_INPUT' },
      { status: 400 }
    );
  }

  try {
    const verdict = await analyzeRepo(repoData);
    return NextResponse.json(verdict, { status: 200 });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const typedErr = err as { code: string; message: string };
      const statusMap: Record<string, number> = {
        INVALID_INPUT: 400,
        AI_PARSE_ERROR: 502,
        AI_API_ERROR: 502,
        TIMEOUT: 504,
        SERVER_ERROR: 500,
      };
      const status = statusMap[typedErr.code] ?? 500;
      return NextResponse.json<AnalyzeError>(
        { error: typedErr.message, code: typedErr.code as AnalyzeError['code'] },
        { status }
      );
    }

    console.error('[analyze] Unexpected error:', err);
    return NextResponse.json<AnalyzeError>(
      { error: 'Internal server error during analysis', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
```

The request body is `{ repoData: RepoData }`. The client assembles RepoData in the browser from the Phase 1 `/api/fetch-repo` response, then sends it to this route for analysis.

**Phase 2 note:** No X-PAYMENT header is included. This is intentional — Phase 3 adds payment gating. Include a comment: `// TODO Phase 3: add x402 payment gate before calling analyzeRepo`.
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npm run build 2>&1 | tail -10</automated>
  </verify>

  <acceptance_criteria>
    - `src/app/api/analyze/route.ts` exists
    - File contains `export const maxDuration = 60`
    - File contains `export const dynamic = 'force-dynamic'`
    - File contains `export async function POST`
    - File imports `analyzeRepo` from `@/lib/opengradient`
    - File imports `RepoData` from `@/types/github`
    - File imports `AnalyzeError` from `@/types/verdict`
    - File handles TIMEOUT → 504, AI_API_ERROR → 502, INVALID_INPUT → 400
    - File contains `// TODO Phase 3: add x402 payment gate` comment
    - `npm run build` exits 0
  </acceptance_criteria>

  <done>POST /api/analyze accepts RepoData, calls analyzeRepo, and returns VerdictResult or a typed error with correct HTTP status codes. No payment gate in this phase.</done>
</task>

</tasks>

<verification>
After both tasks complete:

```bash
# TypeScript check
cd "C:/Projects/opengradient 1" && npx tsc --noEmit

# Build check
npm run build

# Verify server-only guard
grep -n "import 'server-only'" src/lib/opengradient.ts

# Verify types exported
grep -n "^export" src/types/verdict.ts

# Verify timeout
grep -n "45_000" src/lib/opengradient.ts

# Verify no payment header in Phase 2
grep -n "X-PAYMENT" src/lib/opengradient.ts  # should return nothing

# Verify Phase 3 TODO comment
grep -n "TODO Phase 3" src/app/api/analyze/route.ts
```
</verification>

<success_criteria>
- `npm run build` exits 0
- `src/types/verdict.ts` exports VerdictResult, VerdictLevel, VerdictCategory, AnalyzeError
- `src/lib/opengradient.ts` starts with `import 'server-only'`
- analyzeRepo has 45s AbortController timeout
- AI response is validated for required fields before returning
- Markdown fences stripped from AI response before JSON.parse
- POST /api/analyze returns 400 for invalid input, 502 for AI errors, 504 for timeout
- No X-PAYMENT header in Phase 2 (direct call to OpenGradient)
- Phase 3 TODO comment present in route.ts
</success_criteria>

<output>
After completion, create `.planning/phases/02-ai-analysis/02-1-SUMMARY.md` with:
- VerdictResult interface shape (copy from src/types/verdict.ts)
- The full system prompt text used in buildSecurityPrompt (copy from src/lib/opengradient.ts)
- The exact token budget per field (readme: 2000, package_json: 2000, workflow: 1500 per file)
- Error codes and HTTP status mappings from route.ts
- Any deviations from plan (e.g., OpenGradient response format differed from expected)
- `npm run build` output confirming success
</output>
