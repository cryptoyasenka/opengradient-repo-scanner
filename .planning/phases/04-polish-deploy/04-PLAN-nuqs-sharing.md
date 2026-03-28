---
id: "04-01"
title: "nuqs URL encoding + share button"
wave: 1
depends_on: []
files_modified:
  - src/hooks/useResultParams.ts
  - src/components/ShareButton.tsx
  - src/app/layout.tsx
  - package.json
autonomous: true
requirements_addressed:
  - PROOF-04

must_haves:
  truths:
    - "After analysis completes, the browser URL contains encoded result params (repo, verdict, score, tx, summary)"
    - "Clicking the Share button copies the current URL to clipboard"
    - "Pasting the copied URL in a new tab restores the result view without re-running analysis"
    - "Summary param is truncated to 120 chars max to keep URLs under 2KB"
  artifacts:
    - path: "src/hooks/useResultParams.ts"
      provides: "Type-safe nuqs hook for reading/writing result URL params"
      exports: ["useResultParams"]
    - path: "src/components/ShareButton.tsx"
      provides: "Copy-to-clipboard share button with toast feedback"
      exports: ["ShareButton"]
  key_links:
    - from: "src/app/page.tsx"
      to: "useResultParams setters"
      via: "called in onAnalysisComplete handler after API response"
      pattern: "setVerdict|setTxHash|setSummary|setRepo"
    - from: "src/app/layout.tsx"
      to: "NuqsAdapter"
      via: "wrapping children in layout"
      pattern: "NuqsAdapter"
---

<objective>
Install nuqs and implement type-safe URL state encoding for analysis results. When an analysis completes, the result (repo, verdict, score, tx hash, summary) is encoded into the URL query string. A ShareButton copies the URL to clipboard.

Purpose: Shareable result links are the core deliverable of Phase 4. The URL encodes the full verdict so anyone with the link sees the result without paying.

Output: useResultParams hook, ShareButton component, NuqsAdapter wired in layout.
</objective>

<execution_context>
@C:/Users/Yana/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Yana/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/research/ARCHITECTURE.md
@.planning/research/STACK.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install nuqs and create useResultParams hook</name>
  <files>package.json, src/hooks/useResultParams.ts, src/app/layout.tsx</files>

  <read_first>
    - src/app/layout.tsx — to know current provider wrapping structure before modifying
    - package.json — to verify nuqs is not already installed
  </read_first>

  <action>
    1. Install nuqs: `npm install nuqs`

    2. Create src/hooks/useResultParams.ts with the following type-safe hook:

    ```typescript
    import { useQueryState, parseAsString, parseAsInteger } from 'nuqs'

    export function useResultParams() {
      const [repo, setRepo] = useQueryState('repo', parseAsString.withDefault(''))
      const [verdict, setVerdict] = useQueryState('verdict', parseAsString.withDefault(''))
      const [score, setScore] = useQueryState('score', parseAsInteger.withDefault(0))
      const [txHash, setTxHash] = useQueryState('tx', parseAsString.withDefault(''))
      const [summary, setSummary] = useQueryState('summary', parseAsString.withDefault(''))
      const [analysisDate, setAnalysisDate] = useQueryState('date', parseAsString.withDefault(''))

      const hasResult = Boolean(verdict && repo)

      function encodeResult(params: {
        repo: string
        verdict: string
        score: number
        txHash: string
        summary: string
      }) {
        setRepo(params.repo)
        setVerdict(params.verdict)
        setScore(params.score)
        setTxHash(params.txHash)
        // Truncate summary to 120 chars to keep URL under 2KB
        setSummary(params.summary.slice(0, 120))
        setAnalysisDate(new Date().toISOString().split('T')[0])
      }

      function clearResult() {
        setRepo(null)
        setVerdict(null)
        setScore(null)
        setTxHash(null)
        setSummary(null)
        setAnalysisDate(null)
      }

      return {
        repo, verdict, score, txHash, summary, analysisDate,
        hasResult, encodeResult, clearResult,
      }
    }
    ```

    3. Add NuqsAdapter to src/app/layout.tsx. Import from 'nuqs/adapters/next/app' and wrap children:

    ```typescript
    import { NuqsAdapter } from 'nuqs/adapters/next/app'
    // Inside the body, wrap Providers with NuqsAdapter:
    <NuqsAdapter>
      <Providers>{children}</Providers>
    </NuqsAdapter>
    ```

    The NuqsAdapter must be a server component wrapper (it is, by default). It goes outside the client Providers.
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>

  <acceptance_criteria>
    - `grep -r "nuqs" package.json` returns a version entry
    - `grep -r "NuqsAdapter" src/app/layout.tsx` matches
    - `grep -r "useQueryState" src/hooks/useResultParams.ts` matches
    - `grep -r "encodeResult" src/hooks/useResultParams.ts` matches
    - `grep -r "slice(0, 120)" src/hooks/useResultParams.ts` matches (summary truncation)
    - TypeScript compiles without errors on the new files
  </acceptance_criteria>

  <done>nuqs installed, useResultParams hook exported with encodeResult/clearResult helpers, NuqsAdapter wired in layout.</done>
</task>

<task type="auto">
  <name>Task 2: Create ShareButton component and wire encodeResult into main page</name>
  <files>src/components/ShareButton.tsx, src/app/page.tsx</files>

  <read_first>
    - src/app/page.tsx — to find the onAnalysisComplete handler and RESULT state rendering section
    - src/components/ directory listing — to understand existing component conventions
  </read_first>

  <action>
    1. Create src/components/ShareButton.tsx:

    ```typescript
    "use client"

    import { useState } from 'react'
    import { Button } from '@/components/ui/button'
    import { Copy, Check } from 'lucide-react'

    interface ShareButtonProps {
      className?: string
    }

    export function ShareButton({ className }: ShareButtonProps) {
      const [copied, setCopied] = useState(false)

      async function handleCopy() {
        await navigator.clipboard.writeText(window.location.href)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }

      return (
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className={className}
        >
          {copied ? (
            <>
              <Check className="mr-2 h-4 w-4 text-green-600" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="mr-2 h-4 w-4" />
              Share result
            </>
          )}
        </Button>
      )
    }
    ```

    2. In src/app/page.tsx, import and use useResultParams:
       - Import: `import { useResultParams } from '@/hooks/useResultParams'`
       - Call the hook at the top of the component: `const { encodeResult, clearResult, hasResult } = useResultParams()`
       - In the onAnalysisComplete (or equivalent) callback, after receiving the verdict response, call:
         ```typescript
         encodeResult({
           repo: repoUrl,
           verdict: result.verdict,
           score: result.overall_score,
           txHash: result.txHash ?? '',
           summary: result.reasoning ?? result.top_findings?.[0] ?? '',
         })
         ```
       - In the "Check Another" / reset button handler, call `clearResult()`
       - In the RESULT state section, render `<ShareButton className="mt-4" />` below the VerdictCard and ProofBadge

    3. Import ShareButton in page.tsx: `import { ShareButton } from '@/components/ShareButton'`

    Note: if the analysis result shape differs from the above, adapt field names to match the actual API response type. The goal is: verdict string, numeric score, txHash string, short summary string all get encoded into URL params on success.
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>

  <acceptance_criteria>
    - `grep -r "ShareButton" src/app/page.tsx` matches
    - `grep -r "encodeResult" src/app/page.tsx` matches
    - `grep -r "clearResult" src/app/page.tsx` matches
    - `grep -r "navigator.clipboard" src/components/ShareButton.tsx` matches
    - `grep -r "copied" src/components/ShareButton.tsx` matches (state toggle)
    - TypeScript compiles without errors
    - `npm run build` exits 0
  </acceptance_criteria>

  <done>ShareButton renders in RESULT state, encodeResult called on analysis success, clearResult called on reset. URL updates to include verdict params after analysis.</done>
</task>

</tasks>

<verification>
Manual smoke test (after build passes):
1. Run `npm run dev`
2. Analyze a repo. On success, confirm the URL changes to include `?repo=...&verdict=...&score=...`
3. Click Share result — confirm "Copied!" appears, paste URL in new tab, confirm result view appears
4. Click "Check Another" — confirm URL params are cleared
</verification>

<success_criteria>
- nuqs installed and NuqsAdapter in layout
- useResultParams hook exports encodeResult and clearResult
- Summary truncated to 120 chars in URL
- ShareButton copies URL to clipboard with 2s feedback
- encodeResult called after analysis success in page.tsx
- clearResult called on reset
- `npm run build` passes
</success_criteria>

<output>
After completion, create `.planning/phases/04-polish-deploy/04-01-SUMMARY.md`
</output>
