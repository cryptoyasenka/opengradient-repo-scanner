---
id: "02-3"
title: "Step progress loading states + wire VerdictDisplay into main page"
wave: 3
depends_on: ["02-1", "02-2"]
files_modified:
  - src/components/AnalysisProgress.tsx
  - src/app/page.tsx
autonomous: false
requirements_addressed:
  - ANAL-05
  - UI-01
  - UI-05

must_haves:
  truths:
    - "Pasting a GitHub repo URL and clicking Analyze shows a multi-step progress indicator (Fetching... → Analyzing... → Done)"
    - "When analysis completes, VerdictDisplay renders with the result"
    - "When OpenGradient API fails, an error message is shown and the user can retry"
    - "The page does not crash if the API returns a non-200 response"
  artifacts:
    - path: "src/components/AnalysisProgress.tsx"
      provides: "Three-step progress indicator component"
      exports: ["AnalysisProgress"]
    - path: "src/app/page.tsx"
      provides: "Wired full analysis flow: input → fetch → analyze → display"
      contains: "VerdictDisplay"
---

<objective>
Create a multi-step loading indicator (Fetching repo data → Analyzing with AI → Done) and wire the full Phase 2 flow into page.tsx: URL input → /api/fetch-repo → /api/analyze → VerdictDisplay.

This completes Phase 2's "done when" condition: pasting a GitHub URL returns a formatted AI security verdict.
</objective>

<execution_context>
@C:/Users/Yana/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Yana/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/research/FEATURES.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create AnalysisProgress component</name>

  <read_first>
    - src/components/ directory (understand existing component conventions)
  </read_first>

  <files>src/components/AnalysisProgress.tsx</files>

  <action>
Create `src/components/AnalysisProgress.tsx`:

```tsx
"use client";

type AnalysisStep = "idle" | "fetching" | "analyzing" | "done" | "error";

const STEPS = [
  { key: "fetching", label: "Fetching repo data" },
  { key: "analyzing", label: "Analyzing with AI" },
  { key: "done", label: "Complete" },
] as const;

interface AnalysisProgressProps {
  step: AnalysisStep;
  errorMessage?: string;
}

export function AnalysisProgress({ step, errorMessage }: AnalysisProgressProps) {
  const stepIndex = step === "fetching" ? 0 : step === "analyzing" ? 1 : step === "done" ? 2 : -1;

  if (step === "error") {
    return (
      <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">Analysis failed</p>
        <p className="mt-1">{errorMessage ?? "An unexpected error occurred. Please try again."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {STEPS.map((s, i) => {
        const isComplete = i < stepIndex || step === "done";
        const isActive = i === stepIndex && step !== "done";
        return (
          <div key={s.key} className="flex items-center gap-3">
            <div
              className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                isComplete
                  ? "bg-green-500 border-green-500 text-white"
                  : isActive
                  ? "border-blue-500 text-blue-500 animate-pulse"
                  : "border-muted text-muted-foreground"
              }`}
            >
              {isComplete ? "✓" : i + 1}
            </div>
            <span
              className={`text-sm ${
                isActive ? "font-medium text-blue-700" : isComplete ? "text-green-700" : "text-muted-foreground"
              }`}
            >
              {s.label}
              {isActive && "..."}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```
  </action>

  <acceptance_criteria>
    - `src/components/AnalysisProgress.tsx` exists
    - File exports `AnalysisProgress`
    - File contains steps: "fetching", "analyzing", "done"
    - File handles `step === "error"` with error message display
    - File contains `animate-pulse` for active step
  </acceptance_criteria>

  <done>AnalysisProgress shows 3-step progress with active/complete/pending states and error display.</done>
</task>

<task type="checkpoint">
  <name>Task 2: Wire full analysis flow into page.tsx</name>

  <read_first>
    - src/app/page.tsx (current state — read carefully before modifying)
    - src/types/verdict.ts (VerdictResult shape)
    - src/components/VerdictDisplay.tsx (props: result: VerdictResult, repoFullName: string)
    - src/components/AnalysisProgress.tsx (props: step: AnalysisStep, errorMessage?: string)
  </read_first>

  <files>src/app/page.tsx</files>

  <action>
Read page.tsx carefully first. The Phase 1 implementation already has URL input and fetch logic for /api/fetch-repo. Extend it to:

1. Add state: `const [analysisStep, setAnalysisStep] = useState<"idle"|"fetching"|"analyzing"|"done"|"error">("idle")`
2. Add state: `const [verdictResult, setVerdictResult] = useState<VerdictResult | null>(null)`
3. Add state: `const [analysisError, setAnalysisError] = useState<string | null>(null)`

4. Modify the submit handler to implement the two-step flow:
```typescript
async function handleAnalyze(repoUrl: string) {
  setAnalysisStep("fetching");
  setVerdictResult(null);
  setAnalysisError(null);

  // Step 1: fetch repo data
  let repoData;
  try {
    const res = await fetch("/api/fetch-repo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Failed to fetch repository data");
    }
    repoData = await res.json();
  } catch (err: unknown) {
    setAnalysisStep("error");
    setAnalysisError(err instanceof Error ? err.message : "Failed to fetch repo");
    return;
  }

  // Step 2: analyze
  setAnalysisStep("analyzing");
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoData }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "AI analysis failed");
    }
    const verdict = await res.json();
    setVerdictResult(verdict);
    setAnalysisStep("done");
  } catch (err: unknown) {
    setAnalysisStep("error");
    setAnalysisError(err instanceof Error ? err.message : "AI analysis failed");
  }
}
```

5. In JSX, replace existing loading/result rendering with:
```tsx
{/* Show progress while fetching or analyzing */}
{(analysisStep === "fetching" || analysisStep === "analyzing" || analysisStep === "error") && (
  <AnalysisProgress step={analysisStep} errorMessage={analysisError ?? undefined} />
)}

{/* Show verdict when done */}
{analysisStep === "done" && verdictResult && (
  <VerdictDisplay result={verdictResult} repoFullName={verdictResult.categories ? repoUrl : ""} />
)}
```

6. Import at top of file:
```typescript
import { VerdictDisplay } from "@/components/VerdictDisplay";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import type { VerdictResult } from "@/types/verdict";
```

Adapt field names and existing state structure as needed — do not break Phase 1 functionality (URL validation, error display for invalid URLs still works).
  </action>

  <acceptance_criteria>
    - `src/app/page.tsx` imports `VerdictDisplay`
    - `src/app/page.tsx` imports `AnalysisProgress`
    - `src/app/page.tsx` calls `/api/analyze` after `/api/fetch-repo` succeeds
    - `src/app/page.tsx` has state tracking for fetching/analyzing/done/error steps
    - `npm run build` exits 0
  </acceptance_criteria>

  <human_verification>
    1. Run `npm run dev`
    2. Paste `https://github.com/vercel/next.js` and click Analyze
    3. Confirm step progress shows: "Fetching repo data..." then "Analyzing with AI..."
    4. Confirm VerdictDisplay renders with a verdict, score, findings, and disclaimer
    5. Confirm error state: disconnect network mid-request → error message appears, retry works
  </human_verification>

  <done>Full Phase 2 flow working: URL → fetch → analyze → VerdictDisplay with progress steps and error handling.</done>
</task>

</tasks>

<success_criteria>
- AnalysisProgress shows Fetching → Analyzing → Done steps
- Error state shows message and allows retry
- VerdictDisplay renders after successful analysis
- npm run build exits 0
- Pasting any public GitHub URL returns a formatted AI security verdict
</success_criteria>

<output>
After completion, create `.planning/phases/02-ai-analysis/02-3-SUMMARY.md`
</output>
