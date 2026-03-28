---
id: "04-02"
title: "Shareable result page (/result route)"
wave: 1
depends_on: []
files_modified:
  - src/app/result/page.tsx
  - src/app/result/layout.tsx
autonomous: true
requirements_addressed:
  - PROOF-04

must_haves:
  truths:
    - "Anyone visiting /result?repo=...&verdict=...&score=...&tx=...&summary=... sees the verdict without a wallet or payment"
    - "The result page shows the same VerdictCard, ProofBadge, and legal disclaimer as the main page"
    - "If required params are missing or verdict is empty, page shows a 'No result found' state with a link back to home"
    - "Page has noindex meta tag so search engines do not crawl and index AI-generated verdicts"
    - "The result page is a server component that reads searchParams — no client-only state needed"
  artifacts:
    - path: "src/app/result/page.tsx"
      provides: "Static result view — reads URL params, renders verdict without requiring wallet"
      exports: ["default (ResultPage)"]
    - path: "src/app/result/layout.tsx"
      provides: "noindex meta tag for result route"
  key_links:
    - from: "src/app/result/page.tsx"
      to: "src/components/VerdictCard.tsx"
      via: "import and render with params from searchParams"
      pattern: "VerdictCard"
    - from: "src/app/result/page.tsx"
      to: "src/components/ProofBadge.tsx"
      via: "import and render with txHash from searchParams"
      pattern: "ProofBadge"
---

<objective>
Create the /result route that renders a shareable, read-only verdict page. Anyone with the link can see the full result (verdict, score, findings summary, on-chain proof badge) without connecting a wallet or paying. The route reads query params directly from searchParams — no database, no re-analysis.

Purpose: Completes PROOF-04. The shareable link from Plan 01 must resolve to an actual page. This page is the human-readable view of the encoded result.

Output: src/app/result/page.tsx (server component), src/app/result/layout.tsx (noindex meta).
</objective>

<execution_context>
@C:/Users/Yana/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Yana/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/research/ARCHITECTURE.md
@.planning/research/PITFALLS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create /result layout with noindex meta</name>
  <files>src/app/result/layout.tsx</files>

  <read_first>
    - src/app/layout.tsx — to understand root layout structure and what metadata pattern is used
  </read_first>

  <action>
    Create src/app/result/layout.tsx as a server component that adds noindex metadata:

    ```typescript
    import type { Metadata } from 'next'

    export const metadata: Metadata = {
      title: 'Security Analysis Result | GitHub Security Checker',
      description: 'AI-powered security verdict, verified on-chain via OpenGradient TEE.',
      robots: {
        index: false,
        follow: false,
      },
    }

    export default function ResultLayout({
      children,
    }: {
      children: React.ReactNode
    }) {
      return <>{children}</>
    }
    ```

    The `robots: { index: false }` prevents search engines from indexing individual result pages. This reduces legal exposure from AI-generated verdicts being indexed and surfaced as authoritative security assessments (per PITFALLS.md legal section).
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>

  <acceptance_criteria>
    - File exists at src/app/result/layout.tsx
    - `grep -r "index: false" src/app/result/layout.tsx` matches
    - `grep -r "robots" src/app/result/layout.tsx` matches
    - TypeScript compiles without errors
  </acceptance_criteria>

  <done>Result layout created with noindex metadata. Search engines will not index AI verdict pages.</done>
</task>

<task type="auto">
  <name>Task 2: Create /result page — read-only verdict view from URL params</name>
  <files>src/app/result/page.tsx</files>

  <read_first>
    - src/components/VerdictCard.tsx — to understand its props interface
    - src/components/ProofBadge.tsx — to understand its props interface
    - src/app/page.tsx — to see how verdict is displayed in the main page (copy layout pattern)
  </read_first>

  <action>
    Create src/app/result/page.tsx as a server component. It reads searchParams and renders the verdict read-only. No wallet, no payment, no client state.

    ```typescript
    import Link from 'next/link'
    import { VerdictCard } from '@/components/VerdictCard'
    import { ProofBadge } from '@/components/ProofBadge'
    import { ShareButton } from '@/components/ShareButton'
    import { AlertTriangle } from 'lucide-react'

    interface ResultPageProps {
      searchParams: Promise<{
        repo?: string
        verdict?: string
        score?: string
        tx?: string
        summary?: string
        date?: string
      }>
    }

    export default async function ResultPage({ searchParams }: ResultPageProps) {
      const params = await searchParams
      const { repo, verdict, score, tx, summary, date } = params

      // Missing or empty verdict — show fallback
      if (!verdict || !repo) {
        return (
          <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
            <AlertTriangle className="h-12 w-12 text-yellow-500" />
            <h1 className="text-xl font-semibold">No result found</h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              This link does not contain a valid security result. Results are encoded in the URL — the link may be incomplete or expired.
            </p>
            <Link
              href="/"
              className="text-sm underline underline-offset-4 hover:text-primary"
            >
              Check a repository
            </Link>
          </main>
        )
      }

      const numericScore = parseInt(score ?? '0', 10)

      return (
        <main className="mx-auto max-w-2xl px-4 py-12 space-y-6">
          {/* Header */}
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Security analysis result</p>
            <h1 className="text-lg font-semibold break-all">{repo}</h1>
            {date && (
              <p className="text-xs text-muted-foreground">Analyzed on {date}</p>
            )}
          </div>

          {/* Verdict */}
          <VerdictCard
            verdict={verdict as 'Safe' | 'Risky' | 'Dangerous'}
            score={numericScore}
            summary={summary ?? ''}
          />

          {/* On-chain proof */}
          {tx && <ProofBadge txHash={tx} />}

          {/* Legal disclaimer — required on every result per ANAL requirements */}
          <p className="text-xs text-muted-foreground border rounded-md p-3">
            This is an AI-assisted surface analysis, not a professional security audit.
            Results may be inaccurate. Always verify critical dependencies independently.
            The operator of this tool accepts no liability for decisions made based on these results.
          </p>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <ShareButton />
            <Link
              href="/"
              className="text-sm underline underline-offset-4 hover:text-primary"
            >
              Check another repository
            </Link>
          </div>
        </main>
      )
    }
    ```

    Adapt VerdictCard and ProofBadge prop names to match their actual interfaces (read those files first). If VerdictCard accepts different props than `verdict/score/summary`, adjust accordingly. The important constraint: render the same visual verdict that the main page shows, using only data from the URL params.

    Note: In Next.js 15, searchParams is a Promise — use `await searchParams` as shown above.
  </action>

  <verify>
    <automated>cd "C:/Projects/opengradient 1" && npm run build 2>&1 | tail -20</automated>
  </verify>

  <acceptance_criteria>
    - File exists at src/app/result/page.tsx
    - `grep -r "searchParams" src/app/result/page.tsx` matches
    - `grep -r "await searchParams" src/app/result/page.tsx` matches (Next.js 15 async pattern)
    - `grep -r "No result found" src/app/result/page.tsx` matches (fallback state)
    - `grep -r "not a professional security audit" src/app/result/page.tsx` matches (legal disclaimer)
    - `grep -r "VerdictCard" src/app/result/page.tsx` matches
    - `grep -r "ProofBadge" src/app/result/page.tsx` matches
    - `grep -r "ShareButton" src/app/result/page.tsx` matches
    - `npm run build` exits 0
  </acceptance_criteria>

  <done>Result page renders full verdict from URL params without wallet. Empty params show a clear fallback. Legal disclaimer present. noindex prevents search indexing.</done>
</task>

</tasks>

<verification>
Manual smoke test (after build passes):
1. Visit http://localhost:3000/result — confirm "No result found" state with link to home
2. Visit http://localhost:3000/result?repo=owner/repo&verdict=Safe&score=12&tx=0xabc123&summary=No+red+flags&date=2026-03-28 — confirm VerdictCard renders "Safe", ProofBadge shows "0xabc1...3123", disclaimer visible
3. Visit with verdict=Dangerous — confirm red styling
4. Check page source for `<meta name="robots" content="noindex">` or equivalent
</verification>

<success_criteria>
- /result page exists as server component
- Reads all params from searchParams (Next.js 15 async pattern)
- Renders VerdictCard + ProofBadge + disclaimer without wallet
- Fallback state for missing params
- noindex metadata on layout
- npm run build passes
</success_criteria>

<output>
After completion, create `.planning/phases/04-polish-deploy/04-02-SUMMARY.md`
</output>
