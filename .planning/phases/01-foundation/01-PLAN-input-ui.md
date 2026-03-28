---
id: "01-3"
title: "URL Input Form and Raw Data Display"
wave: 3
depends_on:
  - "01-2"
files_modified:
  - src/app/page.tsx
  - src/components/RepoInput.tsx
  - src/components/RepoDataDisplay.tsx
autonomous: true
requirements_addressed:
  - INPUT-01
  - INPUT-02

must_haves:
  truths:
    - "User can type a GitHub URL into the input field and click 'Check Repository'"
    - "A valid URL triggers a POST to /api/fetch-repo and shows a loading spinner"
    - "A successful fetch renders the repo name, star count, last push date, contributor list, README excerpt, and package.json dependencies"
    - "The input field has a clear placeholder showing the expected format"
    - "Submitting an empty input shows an inline validation message without making an API call"
  artifacts:
    - path: "src/components/RepoInput.tsx"
      provides: "Controlled URL input form with client-side format validation"
      contains: "use client"
    - path: "src/components/RepoDataDisplay.tsx"
      provides: "Structured display of RepoData fields using shadcn Card components"
      contains: "RepoData"
    - path: "src/app/page.tsx"
      provides: "Main page orchestrating input + fetch + display state"
      contains: "use client"
  key_links:
    - from: "src/app/page.tsx"
      to: "/api/fetch-repo"
      via: "fetch POST in handleSubmit"
      pattern: "fetch.*api/fetch-repo"
    - from: "src/app/page.tsx"
      to: "src/components/RepoInput.tsx"
      via: "import and render"
      pattern: "RepoInput"
    - from: "src/app/page.tsx"
      to: "src/components/RepoDataDisplay.tsx"
      via: "conditional render when data != null"
      pattern: "RepoDataDisplay"
---

<objective>
Build the user-facing UI: a URL input form and a raw data display panel. The page calls `/api/fetch-repo`, shows a loading state during the fetch, then renders the full `RepoData` in a readable format.

Purpose: Phase 1's "done when" criterion is "user can paste any public GitHub repo URL and see structured repo data displayed." This plan delivers that end-to-end experience (error states and loading polish come in Plan 04).
Output: A working single-page UI where pasting a GitHub URL and clicking submit shows structured repo data.
</objective>

<execution_context>
@C:/Users/Yana/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Yana/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/research/ARCHITECTURE.md
@.planning/research/STACK.md
</context>

<interfaces>
<!-- Types from Plan 02 that this plan consumes. -->
<!-- Source of truth: src/types/github.ts (created in Plan 02) -->

```typescript
// From src/types/github.ts:

interface RepoData {
  repo: {
    full_name: string;
    description: string | null;
    created_at: string;
    pushed_at: string;
    stargazers_count: number;
    forks_count: number;
    open_issues_count: number;
    license: { name: string } | null;
    topics: string[];
    language: string | null;
    archived: boolean;
    owner: { login: string; created_at?: string; public_repos?: number; followers?: number };
  };
  contributors: Array<{ login: string; contributions: number }>;
  recentCommits: Array<{
    sha: string;
    commit: { message: string; author: { name: string; date: string } };
  }>;
  readmeText: string;
  packageJson: Record<string, unknown> | null;
  workflowFiles: Array<{ name: string; content: string }>;
  rateLimitRemaining: number;
  rateLimitWarning: boolean;
}

interface FetchRepoError {
  error: string;
  code: 'INVALID_URL' | 'NOT_FOUND' | 'RATE_LIMITED' | 'PRIVATE_REPO' | 'API_ERROR';
}
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Build RepoInput and RepoDataDisplay components</name>

  <read_first>
    - src/types/github.ts (exact RepoData shape — do not guess field names)
    - src/components/ui/input.tsx (Input component API)
    - src/components/ui/button.tsx (Button component API — check variant names)
    - src/components/ui/card.tsx (Card, CardHeader, CardContent, CardTitle exports)
    - src/components/ui/badge.tsx (Badge component API)
    - src/lib/utils.ts (cn() utility)
  </read_first>

  <files>src/components/RepoInput.tsx, src/components/RepoDataDisplay.tsx</files>

  <action>
**Component 1: src/components/RepoInput.tsx**

A `"use client"` component. Props:
```typescript
interface RepoInputProps {
  onSubmit: (repo: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}
```

Implementation:
- Controlled `<input>` via shadcn `Input` — value bound to local `url` state
- Placeholder text: `"https://github.com/owner/repo"`
- Client-side validation on submit: trim the value, check it is non-empty
  - If empty: set a `validationError` state string "Please enter a GitHub repository URL" and return early (no call to onSubmit)
  - If non-empty: clear validationError and call `onSubmit(url.trim())`
- Render a shadcn `Button` with type="submit" and text "Check Repository"
  - Show `disabled` and text "Checking..." when `isLoading === true`
- Render `validationError` below the input in `text-sm text-destructive` when set
- The form uses `onSubmit` handler (not onClick) to support Enter key submission
- Wrap in a `<form>` element with `onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}`

Layout: single row with input taking `flex-1` and button beside it. Mobile: stacks vertically.

**Component 2: src/components/RepoDataDisplay.tsx**

A standard (no `"use client"`) component. Props:
```typescript
interface RepoDataDisplayProps {
  data: RepoData;
}
```

Import `RepoData` from `@/types/github`.

Display sections (use shadcn `Card` for each section):

1. **Repository Overview Card**
   - Title: `{data.repo.full_name}` (bold, large)
   - Description: `{data.repo.description}` or italic "No description"
   - Metadata row (use shadcn `Badge`): Language, Stars, Forks, Open Issues
   - License: `{data.repo.license?.name}` or "No license"
   - Last pushed: formatted date from `data.repo.pushed_at`
   - Archived: show a red "ARCHIVED" badge if `data.repo.archived === true`

2. **Owner / Contributors Card**
   - Owner login + account created date (format: "Created {date}")
   - Contributor list: top 5, show login and contribution count

3. **Recent Commits Card**
   - List last 10 commits: `{commit.commit.author.date} — {commit.commit.message.split('\n')[0]}` (first line of message only, truncated to 80 chars)

4. **Package Manifest Card** (only render if `data.packageJson !== null`)
   - Show `name`, `version` from packageJson
   - Show `dependencies` count and list first 10 dependency names

5. **README Excerpt Card**
   - Show `data.readmeText.slice(0, 500)` in a `<pre>` with `whitespace-pre-wrap text-xs`
   - Label: "README (first 500 chars)"

6. **GitHub Actions Card** (only render if `data.workflowFiles.length > 0`)
   - List workflow file names
   - Show first 300 chars of first workflow content in `<pre>`

7. **Rate Limit Warning** (only render if `data.rateLimitWarning === true`)
   - Yellow/amber `Badge` with text: "GitHub API rate limit nearly exhausted. Set GITHUB_TOKEN to increase limit."

Use `className="space-y-4"` on the wrapper div to space cards.
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>

  <acceptance_criteria>
    - `src/components/RepoInput.tsx` starts with `"use client"`
    - `src/components/RepoInput.tsx` contains `onSubmit: (repo: string) => void` in its props interface
    - `src/components/RepoInput.tsx` contains `e.preventDefault()` (form submit handling)
    - `src/components/RepoInput.tsx` shows validation error message when input is empty
    - `src/components/RepoInput.tsx` disables the button and shows "Checking..." when `isLoading` is true
    - `src/components/RepoDataDisplay.tsx` imports `RepoData` from `@/types/github`
    - `src/components/RepoDataDisplay.tsx` renders `data.repo.full_name` in the heading
    - `src/components/RepoDataDisplay.tsx` renders `data.rateLimitWarning` conditional section
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>RepoInput form component and RepoDataDisplay component created, typed correctly against RepoData, and building without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Wire page.tsx with fetch logic and state management</name>

  <read_first>
    - src/components/RepoInput.tsx (just created — use exact props interface)
    - src/components/RepoDataDisplay.tsx (just created — use exact props interface)
    - src/types/github.ts (RepoData and FetchRepoError types)
    - src/app/layout.tsx (current layout — do not break it)
    - .planning/research/ARCHITECTURE.md (Anti-Pattern 3 — process.env in client; page state machine)
  </read_first>

  <files>src/app/page.tsx</files>

  <action>
Replace `src/app/page.tsx` with a full client component that manages the fetch flow:

```typescript
"use client";

import { useState } from "react";
import { RepoInput } from "@/components/RepoInput";
import { RepoDataDisplay } from "@/components/RepoDataDisplay";
import type { RepoData, FetchRepoError } from "@/types/github";

type PageState = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [pageState, setPageState] = useState<PageState>("idle");
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [fetchError, setFetchError] = useState<FetchRepoError | null>(null);

  async function handleRepoSubmit(repoInput: string) {
    setPageState("loading");
    setRepoData(null);
    setFetchError(null);

    try {
      const response = await fetch("/api/fetch-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: repoInput }),
      });

      const json = await response.json();

      if (!response.ok) {
        setFetchError(json as FetchRepoError);
        setPageState("error");
        return;
      }

      setRepoData(json as RepoData);
      setPageState("success");
    } catch (err) {
      setFetchError({
        error: "Network error: could not reach the server. Check your connection.",
        code: "API_ERROR",
      });
      setPageState("error");
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">GitHub Security Checker</h1>
          <p className="mt-2 text-muted-foreground">
            Analyze any public GitHub repository for supply chain security signals.
          </p>
        </div>

        {/* Input Form */}
        <RepoInput
          onSubmit={handleRepoSubmit}
          isLoading={pageState === "loading"}
        />

        {/* Loading State */}
        {pageState === "loading" && (
          <div className="mt-8 text-center text-muted-foreground">
            <p>Fetching repository data...</p>
          </div>
        )}

        {/* Error State (Plan 04 will enhance this) */}
        {pageState === "error" && fetchError && (
          <div className="mt-8 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <strong>Error:</strong> {fetchError.error}
          </div>
        )}

        {/* Success State */}
        {pageState === "success" && repoData && (
          <div className="mt-8">
            <RepoDataDisplay data={repoData} />
          </div>
        )}
      </div>
    </main>
  );
}
```

No server-side env vars accessed here — this is a pure client component calling the API route.
The loading and error states are intentionally minimal placeholders — Plan 04 adds the full polish.
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npm run build 2>&1 | tail -10</automated>
  </verify>

  <acceptance_criteria>
    - `src/app/page.tsx` starts with `"use client"`
    - File contains `useState<PageState>("idle")` (state machine pattern)
    - File contains `fetch("/api/fetch-repo"` (API call)
    - File renders `<RepoInput` with `onSubmit` and `isLoading` props
    - File conditionally renders `<RepoDataDisplay` when `pageState === "success"`
    - File shows error message when `pageState === "error"`
    - `npm run build` exits 0
    - No `process.env` references in this file (server env vars must not appear in client code)
  </acceptance_criteria>

  <done>Main page wires RepoInput → fetch → RepoDataDisplay with a four-state state machine. App is functionally complete for the happy path.</done>
</task>

</tasks>

<verification>
After both tasks:

```bash
# Build must pass
cd "C:/Projects/opengradient 1" && npm run build

# Confirm no process.env in page.tsx
grep "process.env" src/app/page.tsx  # should return nothing

# Confirm "use client" on both component files
head -1 src/components/RepoInput.tsx
head -1 src/app/page.tsx

# Manual end-to-end test:
# 1. npm run dev
# 2. Open http://localhost:3000
# 3. Paste: https://github.com/vercel/next.js
# 4. Click "Check Repository"
# 5. Confirm repo data card appears with "vercel/next.js" as title
```
</verification>

<success_criteria>
- `npm run build` exits 0
- Empty input shows "Please enter a GitHub repository URL" without making any API call
- Valid GitHub URL triggers loading state, then renders RepoDataDisplay
- RepoDataDisplay shows: repo name, stars, description, contributors, recent commits, README excerpt
- Rate limit warning badge renders when `rateLimitWarning` is true
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation/01-3-SUMMARY.md` with:
- Component props interfaces (RepoInput, RepoDataDisplay)
- Page state machine states and transitions
- What RepoDataDisplay renders for each section (confirm fields match RepoData shape)
- Any shadcn component import paths that deviated from expected
- `npm run build` output confirming success
</output>
