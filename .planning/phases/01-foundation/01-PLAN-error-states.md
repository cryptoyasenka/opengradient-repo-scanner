---
id: "01-4"
title: "Error States, Loading Polish, GITHUB_TOKEN Env Var, and Phase Verification"
wave: 4
depends_on:
  - "01-3"
files_modified:
  - src/app/page.tsx
  - src/components/RepoInput.tsx
  - src/components/ErrorDisplay.tsx
  - src/components/LoadingDisplay.tsx
  - .env.local.example
autonomous: false
requirements_addressed:
  - INPUT-01
  - INPUT-02
  - INPUT-03
  - GEN-03

must_haves:
  truths:
    - "Invalid GitHub URL shows a specific error: 'Invalid GitHub repository URL. Expected format: github.com/owner/repo'"
    - "Non-existent repo shows: 'Repository not found. Check the URL and try again.'"
    - "Rate limit error shows: 'GitHub API rate limit exceeded.' with a note about GITHUB_TOKEN"
    - "Loading state shows a spinner and the text 'Fetching repository data...'"
    - "A 'Check another repo' button appears after a result or error, resets state to idle"
    - "Setting GITHUB_TOKEN in .env.local raises the API limit (verified by absence of rate-limit warning on first fetch)"
  artifacts:
    - path: "src/components/ErrorDisplay.tsx"
      provides: "Error display component with per-code messaging"
      contains: "FetchRepoError"
    - path: "src/components/LoadingDisplay.tsx"
      provides: "Loading spinner with descriptive text"
    - path: "src/app/page.tsx"
      provides: "Updated page using ErrorDisplay, LoadingDisplay, and reset flow"
      contains: "Check another"
    - path: ".env.local.example"
      provides: "Complete env var documentation"
      contains: "GITHUB_TOKEN"
  key_links:
    - from: "src/app/page.tsx"
      to: "src/components/ErrorDisplay.tsx"
      via: "conditional render on pageState === 'error'"
      pattern: "ErrorDisplay"
    - from: "src/app/page.tsx"
      to: "src/components/LoadingDisplay.tsx"
      via: "conditional render on pageState === 'loading'"
      pattern: "LoadingDisplay"
---

<objective>
Polish Phase 1 to production-quality error handling and loading states. Add specific error messages for each failure mode (invalid URL, repo not found, rate limited, private repo). Replace the placeholder loading div with a proper spinner component. Add a "Check another" reset flow. Verify the full phase end-to-end with a human checkpoint.

Purpose: Phase 1 is "done when: user can paste any public GitHub repo URL and see structured repo data displayed without errors." This plan closes the gap between a working happy path and the fully specified done condition.
Output: Complete Phase 1 UX with typed error messages, loading polish, and env var support verified.
</objective>

<execution_context>
@C:/Users/Yana/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Yana/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/research/PITFALLS.md
</context>

<interfaces>
<!-- Types from Plan 02 consumed here. -->

```typescript
// From src/types/github.ts:
type ErrorCode = 'INVALID_URL' | 'NOT_FOUND' | 'RATE_LIMITED' | 'PRIVATE_REPO' | 'API_ERROR';

interface FetchRepoError {
  error: string;
  code: ErrorCode;
}
```

<!-- Error messages to display per code: -->
```
INVALID_URL:   "Invalid GitHub repository URL. Use the format: github.com/owner/repo"
NOT_FOUND:     "Repository not found. Check the URL and make sure the repo is public."
RATE_LIMITED:  "GitHub API rate limit exceeded. Set GITHUB_TOKEN in .env.local to raise the limit to 5,000/hr."
PRIVATE_REPO:  "This repository is private. Only public repositories can be analyzed."
API_ERROR:     "GitHub API error. Please try again in a moment."
(network):     "Network error: could not reach the server. Check your connection."
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Create ErrorDisplay and LoadingDisplay components, update page.tsx</name>

  <read_first>
    - src/app/page.tsx (current state from Plan 03 — must read before editing)
    - src/components/RepoInput.tsx (current state — do not modify this file in this task)
    - src/types/github.ts (FetchRepoError type)
    - src/components/ui/button.tsx (Button variants)
    - src/components/ui/card.tsx (Card, CardContent exports)
    - .planning/research/PITFALLS.md (Pitfall 1-4 — exact error scenarios to handle)
  </read_first>

  <files>
    src/components/ErrorDisplay.tsx,
    src/components/LoadingDisplay.tsx,
    src/app/page.tsx
  </files>

  <action>
**Component 1: src/components/ErrorDisplay.tsx**

A standard (no `"use client"` needed) component. Props:
```typescript
interface ErrorDisplayProps {
  error: FetchRepoError;
  onReset: () => void;
}
```

Map each error code to a user-friendly message:
```typescript
const ERROR_MESSAGES: Record<string, string> = {
  INVALID_URL:  "Invalid GitHub repository URL. Use the format: github.com/owner/repo",
  NOT_FOUND:    "Repository not found. Check the URL and make sure the repo is public.",
  RATE_LIMITED: "GitHub API rate limit exceeded. Set GITHUB_TOKEN in .env.local to raise the limit to 5,000/hr.",
  PRIVATE_REPO: "This repository is private. Only public repositories can be analyzed.",
  API_ERROR:    "GitHub API error. Please try again in a moment.",
};
```

Display:
- Wrap in a `<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">`
- Show `ERROR_MESSAGES[error.code] ?? error.error` (fallback to raw error message)
- For `RATE_LIMITED`: also render a link to `https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens` with text "How to create a GitHub Personal Access Token"
- Render a shadcn `Button` variant="outline" below the message: text "Try another repository", calls `onReset`

**Component 2: src/components/LoadingDisplay.tsx**

A simple component:
```typescript
export function LoadingDisplay() {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 text-muted-foreground">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      <p className="text-sm">Fetching repository data...</p>
      <p className="text-xs">This may take a few seconds</p>
    </div>
  );
}
```

**Update src/app/page.tsx:**

Read the current file first. Make these targeted changes:

1. Import `ErrorDisplay` from `@/components/ErrorDisplay`
2. Import `LoadingDisplay` from `@/components/LoadingDisplay`
3. Add a `handleReset` function:
   ```typescript
   function handleReset() {
     setPageState("idle");
     setRepoData(null);
     setFetchError(null);
   }
   ```
4. Replace the loading section:
   ```tsx
   {pageState === "loading" && <LoadingDisplay />}
   ```
5. Replace the error section:
   ```tsx
   {pageState === "error" && fetchError && (
     <div className="mt-8">
       <ErrorDisplay error={fetchError} onReset={handleReset} />
     </div>
   )}
   ```
6. Add a "Check another repository" button below the success RepoDataDisplay:
   ```tsx
   {pageState === "success" && repoData && (
     <div className="mt-8">
       <RepoDataDisplay data={repoData} />
       <div className="mt-6 text-center">
         <Button variant="outline" onClick={handleReset}>
           Check another repository
         </Button>
       </div>
     </div>
   )}
   ```
7. Import `Button` from `@/components/ui/button` if not already imported.

Do NOT restructure the entire page.tsx — only make the targeted changes listed above.
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npm run build 2>&1 | tail -10</automated>
  </verify>

  <acceptance_criteria>
    - `src/components/ErrorDisplay.tsx` exists and contains `ERROR_MESSAGES` record
    - `src/components/ErrorDisplay.tsx` imports `FetchRepoError` from `@/types/github`
    - `src/components/ErrorDisplay.tsx` renders "Try another repository" Button that calls `onReset`
    - `src/components/ErrorDisplay.tsx` renders GitHub PAT docs link when `error.code === 'RATE_LIMITED'`
    - `src/components/LoadingDisplay.tsx` contains `animate-spin` class (CSS spinner)
    - `src/app/page.tsx` imports `ErrorDisplay` and `LoadingDisplay`
    - `src/app/page.tsx` contains `handleReset` function that resets all three state pieces
    - `src/app/page.tsx` renders "Check another repository" button in the success state
    - `npm run build` exits 0
  </acceptance_criteria>

  <done>Error display component with per-code messages and loading spinner component created. Page updated to use them with a reset flow.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Phase 1 end-to-end verification checkpoint</name>

  <what-built>
    Complete Phase 1 implementation:
    - Next.js 15 + TypeScript + Tailwind v4 + shadcn/ui bootstrapped
    - GitHub API client fetching 8 endpoints in parallel with rate limit handling
    - POST /api/fetch-repo route with URL validation and typed error responses
    - RepoInput form with client-side validation
    - RepoDataDisplay showing all repo data sections
    - ErrorDisplay with per-code messages and reset flow
    - LoadingDisplay spinner
    - GITHUB_TOKEN optional env var support (logs warning when absent)
  </what-built>

  <how-to-verify>
Run the development server:
```bash
cd "C:/Projects/opengradient 1"
npm run dev
```
Open http://localhost:3000 and run through each scenario:

**Scenario 1 — Happy path (run first)**
1. Paste `https://github.com/vercel/next.js` in the input
2. Click "Check Repository"
3. Confirm: spinner appears briefly, then repo data renders
4. Confirm displayed: repo name "vercel/next.js", star count (should be 100k+), description, recent commits, README excerpt
5. Confirm "Check another repository" button appears below the data

**Scenario 2 — Empty input validation**
1. Click "Check Repository" with empty input
2. Confirm: "Please enter a GitHub repository URL" appears inline, no loading state, no API call made

**Scenario 3 — Invalid URL format**
1. Paste `not-a-github-url` and submit
2. Confirm: error message containing "Invalid GitHub repository URL" appears
3. Confirm: "Try another repository" button appears

**Scenario 4 — Non-existent repo**
1. Paste `github.com/this-owner-does-not-exist-xyz/fake-repo-abc123` and submit
2. Confirm: error message containing "Repository not found" appears

**Scenario 5 — Reset flow**
1. After any result or error, click "Check another repository" or "Try another repository"
2. Confirm: form resets to idle state, previous result/error clears

**Optional — GITHUB_TOKEN verification**
1. Check server console (terminal running npm run dev) for the warning: `[github] GITHUB_TOKEN not set — using unauthenticated API`
2. Add `GITHUB_TOKEN=your_token` to `.env.local` and restart dev server
3. Confirm: warning no longer appears in console
  </how-to-verify>

  <resume-signal>
Type "approved" if all 5 scenarios pass. If any scenario fails, describe what happened (e.g., "Scenario 3 showed a generic error instead of the specific message").
  </resume-signal>
</task>

</tasks>

<verification>
Automated pre-checkpoint checks:

```bash
# Full build
cd "C:/Projects/opengradient 1" && npm run build

# Confirm error code mapping exists
grep -n "RATE_LIMITED" src/components/ErrorDisplay.tsx
grep -n "NOT_FOUND" src/components/ErrorDisplay.tsx
grep -n "PRIVATE_REPO" src/components/ErrorDisplay.tsx

# Confirm spinner class
grep -n "animate-spin" src/components/LoadingDisplay.tsx

# Confirm reset function
grep -n "handleReset" src/app/page.tsx

# Confirm "Check another" text
grep -n "Check another" src/app/page.tsx
```
</verification>

<success_criteria>
- `npm run build` exits 0
- All 5 verification scenarios pass during the human checkpoint
- ErrorDisplay shows specific messages per error code (not generic "Error")
- LoadingDisplay renders an animated spinner
- Reset flow returns page to idle state cleanly
- GITHUB_TOKEN env var logs a console warning when absent
- Phase 1 done-when criterion met: "User can paste any public GitHub repo URL and see structured repo data displayed without errors"
</success_criteria>

<output>
After checkpoint approval, create `.planning/phases/01-foundation/01-4-SUMMARY.md` with:
- Which verification scenarios passed and any deviations
- Final file list for Phase 1 (all created/modified files)
- Console warning behavior for GITHUB_TOKEN
- Any issues encountered and how they were resolved
- Confirmation that Phase 1 done-when criterion is met
</output>
