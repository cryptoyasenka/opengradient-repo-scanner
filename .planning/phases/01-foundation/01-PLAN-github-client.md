---
id: "01-2"
title: "GitHub API Client: 8 Endpoints, Error Handling, Rate Limit Headers"
wave: 2
depends_on:
  - "01-1"
files_modified:
  - src/lib/github.ts
  - src/types/github.ts
  - src/app/api/fetch-repo/route.ts
autonomous: true
requirements_addressed:
  - INPUT-02
  - INPUT-03
  - GEN-03

must_haves:
  truths:
    - "POST /api/fetch-repo with body {repo:'facebook/react'} returns structured repo data in under 3 seconds"
    - "POST /api/fetch-repo with body {repo:'invalid-url'} returns 400 with {error:'Invalid GitHub repository URL'}"
    - "POST /api/fetch-repo with a non-existent repo returns 404 with {error:'Repository not found'}"
    - "When GITHUB_TOKEN is set, the Authorization header is sent; when unset, API calls proceed unauthenticated"
    - "X-RateLimit-Remaining header is checked; if < 5, response includes {rateLimitWarning: true}"
  artifacts:
    - path: "src/types/github.ts"
      provides: "TypeScript types for all GitHub API responses and the assembled RepoData shape"
      exports:
        - "RepoData"
        - "GitHubRepo"
        - "GitHubContributor"
        - "GitHubCommit"
        - "GitHubWorkflow"
    - path: "src/lib/github.ts"
      provides: "Server-only GitHub API fetch utilities"
      contains: "import 'server-only'"
      exports:
        - "fetchRepoData"
    - path: "src/app/api/fetch-repo/route.ts"
      provides: "POST route handler that validates URL and calls fetchRepoData"
      contains: "export async function POST"
  key_links:
    - from: "src/app/api/fetch-repo/route.ts"
      to: "src/lib/github.ts"
      via: "import fetchRepoData"
      pattern: "fetchRepoData"
    - from: "src/lib/github.ts"
      to: "api.github.com"
      via: "fetch with Promise.all"
      pattern: "Promise.all"
    - from: "src/app/api/fetch-repo/route.ts"
      to: "src/types/github.ts"
      via: "import RepoData"
      pattern: "RepoData"
---

<objective>
Build the GitHub API client: TypeScript types, a server-only fetch utility (`src/lib/github.ts`), and the `/api/fetch-repo` route handler. Covers all 8 API endpoints, URL validation, error handling, rate limit header inspection, and optional GITHUB_TOKEN support.

Purpose: This is the data foundation. Phase 2 AI analysis and Phase 1 UI both depend on `RepoData` — the typed output of this plan.
Output: Working POST /api/fetch-repo endpoint that returns structured repo data or a typed error response.
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
<!-- Types this plan creates — downstream plans (01-3, 01-4) depend on these. -->
<!-- Executor: define these in src/types/github.ts before implementing github.ts. -->

```typescript
// src/types/github.ts — define these exact exports

export interface GitHubRepo {
  full_name: string;
  description: string | null;
  created_at: string;
  pushed_at: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  subscribers_count: number;
  license: { name: string; spdx_id: string } | null;
  topics: string[];
  language: string | null;
  archived: boolean;
  default_branch: string;
  owner: {
    login: string;
    type: string;
    created_at?: string;  // from /users/{owner} call
    public_repos?: number;
    followers?: number;
  };
}

export interface GitHubContributor {
  login: string;
  contributions: number;
  type: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
  };
  author: { login: string } | null;
}

export interface GitHubWorkflowFile {
  name: string;
  content: string;  // truncated to 2000 chars
}

export interface RepoData {
  repo: GitHubRepo;
  contributors: GitHubContributor[];
  recentCommits: GitHubCommit[];
  readmeText: string;          // decoded, truncated to 3000 chars
  packageJson: Record<string, unknown> | null;
  workflowFiles: GitHubWorkflowFile[];
  rateLimitRemaining: number;
  rateLimitWarning: boolean;   // true when remaining < 5
}

export interface FetchRepoError {
  error: string;
  code: 'INVALID_URL' | 'NOT_FOUND' | 'RATE_LIMITED' | 'PRIVATE_REPO' | 'API_ERROR';
}
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Define types and implement github.ts fetch utilities</name>

  <read_first>
    - .planning/research/STACK.md (GitHub API endpoints, rate limit header handling, GITHUB_TOKEN pattern, README base64 decode pattern)
    - .planning/research/FEATURES.md (exact 8 API endpoints and what data each returns, per-field truncation budgets)
    - .planning/research/PITFALLS.md (Pitfall 4 — rate limit exhaustion, Pitfall 5 — token overflow / truncation)
    - .planning/research/ARCHITECTURE.md (Decision 1 — server-side only, import 'server-only' requirement)
  </read_first>

  <files>src/types/github.ts, src/lib/github.ts</files>

  <action>
**Step 1: Create src/types/github.ts**

Create the file with exactly the types shown in the `<interfaces>` block above. Do not deviate from those type names or shapes — Plans 03 and 04 import from this file.

**Step 2: Create src/lib/github.ts**

Start with `import 'server-only'` as the first line — this prevents accidental browser bundling.

Implement a `buildGitHubHeaders()` helper:
```typescript
function buildGitHubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  } else {
    console.warn('[github] GITHUB_TOKEN not set — using unauthenticated API (60 req/hr limit)');
  }
  return headers;
}
```

Implement a `parseOwnerRepo(url: string): { owner: string; repo: string } | null` validator:
- Accept: `https://github.com/owner/repo`, `github.com/owner/repo`, `owner/repo`
- Strip trailing slashes and `.git` suffix
- Return null if format does not match owner/repo pattern (both segments must be non-empty alphanumeric/dash/underscore/dot strings)

Implement `fetchRepoData(owner: string, repo: string): Promise<RepoData>` using `Promise.all` to fire all 8 requests in parallel:

```
1. GET https://api.github.com/repos/{owner}/{repo}               → GitHubRepo
2. GET https://api.github.com/users/{owner}                       → owner profile (age, followers, repos)
3. GET https://api.github.com/repos/{owner}/{repo}/contributors?per_page=5
4. GET https://api.github.com/repos/{owner}/{repo}/commits?per_page=10
5. GET https://api.github.com/repos/{owner}/{repo}/readme         → base64 content
6. GET https://api.github.com/repos/{owner}/{repo}/contents/package.json  → base64 content (404 = null)
7. GET https://api.github.com/repos/{owner}/{repo}/contents/.github/workflows  → directory listing
8. GET first workflow file from step 7 (only if directory is non-empty)
```

**Rate limit handling:**
- After the metadata call (request 1) resolves, read `X-RateLimit-Remaining` header
- Set `rateLimitWarning: true` in the returned `RepoData` if remaining < 5
- Store the remaining count in `rateLimitRemaining`

**Error detection from request 1:**
- HTTP 404 → throw an error with code `NOT_FOUND`
- HTTP 403 + `message` containing "rate limit" → throw with code `RATE_LIMITED`
- HTTP 403 + `message` containing "private" → throw with code `PRIVATE_REPO`
- Other non-2xx → throw with code `API_ERROR`

**README decoding:**
```typescript
const readmeRaw = Buffer.from(readmeData.content.replace(/\n/g, ''), 'base64').toString('utf-8');
const readmeText = readmeRaw.slice(0, 3000); // truncate per Pitfall 5
```

**package.json decoding:**
- If 404: set `packageJson: null`
- If 200: decode base64 and `JSON.parse` with a try/catch (malformed JSON → `null`)
- Truncate the raw string to 2000 chars before parsing

**Workflow files:**
- Request 7 returns an array of `{ name, download_url, type }` objects, or 404 (= no workflows)
- Only fetch the first workflow file (request 8) — skip if directory is empty or 404
- Truncate workflow content to 2000 chars

**Owner profile merge:**
- Merge `created_at`, `public_repos`, `followers` from the `/users/{owner}` response into `repo.owner`

Export only: `fetchRepoData`, `parseOwnerRepo`
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>

  <acceptance_criteria>
    - `src/types/github.ts` contains `export interface RepoData`
    - `src/types/github.ts` contains `export interface FetchRepoError`
    - `src/lib/github.ts` first line is `import 'server-only'`
    - `src/lib/github.ts` contains `export async function fetchRepoData`
    - `src/lib/github.ts` contains `export function parseOwnerRepo`
    - `src/lib/github.ts` contains `Promise.all` (parallel fetching)
    - `src/lib/github.ts` contains `X-RateLimit-Remaining` (rate limit check)
    - `src/lib/github.ts` contains `Buffer.from` and `.slice(0, 3000)` (README truncation)
    - `src/lib/github.ts` contains `rateLimitWarning` boolean assignment
    - `npx tsc --noEmit` exits 0 with no errors in these two files
  </acceptance_criteria>

  <done>TypeScript types defined and github.ts fetch utilities implemented with all 8 endpoints, rate limit handling, and proper truncation.</done>
</task>

<task type="auto">
  <name>Task 2: Implement /api/fetch-repo route handler</name>

  <read_first>
    - src/types/github.ts (just created — use these exact types)
    - src/lib/github.ts (just created — use parseOwnerRepo and fetchRepoData)
    - .planning/research/ARCHITECTURE.md (Anti-Pattern 4 — split routes; maxDuration config)
    - .planning/research/PITFALLS.md (Pitfall 4 — server-side rate limit note)
  </read_first>

  <files>src/app/api/fetch-repo/route.ts</files>

  <action>
Create `src/app/api/fetch-repo/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { fetchRepoData, parseOwnerRepo } from '@/lib/github';
import type { FetchRepoError } from '@/types/github';

export const dynamic = 'force-dynamic';
export const maxDuration = 30; // Vercel Fluid Compute — allows up to 60s on free tier

export async function POST(req: NextRequest) {
  // Validate request body
  let body: { repo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<FetchRepoError>(
      { error: 'Request body must be JSON with a "repo" field', code: 'INVALID_URL' },
      { status: 400 }
    );
  }

  const repoInput = body.repo?.trim();
  if (!repoInput) {
    return NextResponse.json<FetchRepoError>(
      { error: 'Missing required field: repo', code: 'INVALID_URL' },
      { status: 400 }
    );
  }

  // Validate and parse the GitHub URL/slug
  const parsed = parseOwnerRepo(repoInput);
  if (!parsed) {
    return NextResponse.json<FetchRepoError>(
      { error: 'Invalid GitHub repository URL. Expected format: github.com/owner/repo or owner/repo', code: 'INVALID_URL' },
      { status: 400 }
    );
  }

  const { owner, repo } = parsed;

  try {
    const data = await fetchRepoData(owner, repo);
    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    // Typed error from fetchRepoData
    if (err && typeof err === 'object' && 'code' in err) {
      const typedErr = err as FetchRepoError;
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        RATE_LIMITED: 429,
        PRIVATE_REPO: 403,
        API_ERROR: 502,
        INVALID_URL: 400,
      };
      const status = statusMap[typedErr.code] ?? 500;
      return NextResponse.json<FetchRepoError>(typedErr, { status });
    }

    // Unknown error
    console.error('[fetch-repo] Unexpected error:', err);
    return NextResponse.json<FetchRepoError>(
      { error: 'Internal server error while fetching repository data', code: 'API_ERROR' },
      { status: 500 }
    );
  }
}
```

**Important:** The route uses `maxDuration = 30` which works with Vercel Fluid Compute (available on free tier). This gives enough headroom for the 8 parallel GitHub API calls.

Also log a warning at module load time if GITHUB_TOKEN is missing (does not block the route):
```typescript
// At the top of the file, after imports:
if (!process.env.GITHUB_TOKEN) {
  console.warn('[fetch-repo] GITHUB_TOKEN not set — unauthenticated GitHub API in use (60 req/hr)');
}
```
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npm run build 2>&1 | tail -10</automated>
  </verify>

  <acceptance_criteria>
    - `src/app/api/fetch-repo/route.ts` exists
    - File contains `export const maxDuration = 30`
    - File contains `export const dynamic = 'force-dynamic'`
    - File contains `export async function POST`
    - File imports `fetchRepoData` and `parseOwnerRepo` from `@/lib/github`
    - File imports `FetchRepoError` from `@/types/github`
    - File handles all error codes: `INVALID_URL` → 400, `NOT_FOUND` → 404, `RATE_LIMITED` → 429, `PRIVATE_REPO` → 403
    - `npm run build` exits 0 (no TypeScript errors)
    - Manual smoke test: `curl -X POST http://localhost:3000/api/fetch-repo -H "Content-Type: application/json" -d '{"repo":"invalid"}' ` returns HTTP 400 with `{"error":"Invalid GitHub repository URL..."}`
  </acceptance_criteria>

  <done>POST /api/fetch-repo validates repo URLs, fetches from GitHub, and returns typed RepoData or a typed error with correct HTTP status codes.</done>
</task>

</tasks>

<verification>
After both tasks complete:

```bash
# Build check
cd "C:/Projects/opengradient 1" && npm run build

# TypeScript check
npx tsc --noEmit

# Verify server-only guard
grep -n "import 'server-only'" src/lib/github.ts

# Verify rate limit handling
grep -n "X-RateLimit-Remaining" src/lib/github.ts

# Verify truncation guards
grep -n "slice(0, 3000)" src/lib/github.ts
grep -n "slice(0, 2000)" src/lib/github.ts

# Start dev server and test the route
# npm run dev &
# curl -X POST http://localhost:3000/api/fetch-repo \
#   -H "Content-Type: application/json" \
#   -d '{"repo":"github.com/vercel/next.js"}'
# Expected: 200 with RepoData JSON containing repo.full_name = "vercel/next.js"
```
</verification>

<success_criteria>
- `npm run build` exits 0
- `src/lib/github.ts` starts with `import 'server-only'`
- All 8 GitHub API endpoints are called in a single `Promise.all`
- README is decoded from base64 and truncated to 3000 chars
- package.json content is decoded from base64 and truncated to 2000 chars
- Rate limit header (`X-RateLimit-Remaining`) is read and surfaced in `RepoData.rateLimitWarning`
- POST /api/fetch-repo returns 400 for invalid URLs, 404 for missing repos, 200 for valid repos
- GITHUB_TOKEN absence logs a warning but does not block requests
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-2-SUMMARY.md` with:
- `RepoData` interface shape (copy from src/types/github.ts)
- The exact URL parsing regex or logic used in `parseOwnerRepo`
- Which GitHub endpoints are called and in what order within Promise.all
- Error codes and HTTP status mappings
- Any deviations from the plan (e.g., if a GitHub endpoint behaved unexpectedly)
- `npm run build` output confirming success
</output>
