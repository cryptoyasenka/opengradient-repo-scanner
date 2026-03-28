---
id: "02-2"
title: "VerdictDisplay UI: verdict banner, score bar, findings accordion, disclaimer"
wave: 2
depends_on: ["02-1"]
files_modified:
  - src/components/VerdictDisplay.tsx
  - src/components/CategoryAccordion.tsx
autonomous: true
requirements_addressed:
  - ANAL-01
  - ANAL-02
  - ANAL-03
  - UI-01
  - UI-02
  - UI-03
  - UI-04
  - GEN-02

must_haves:
  truths:
    - "Safe verdict renders with green color scheme"
    - "Risky verdict renders with amber/yellow color scheme"
    - "Dangerous verdict renders with red color scheme"
    - "Risk score 0-100 is displayed as a number and as a visual progress bar"
    - "top_findings array is rendered as a bulleted list"
    - "Each of the 7 security categories is shown in an expandable accordion"
    - "Legal disclaimer text is visible on every result"
    - "A 'Report incorrect verdict' link is present"
  artifacts:
    - path: "src/components/VerdictDisplay.tsx"
      provides: "Main verdict UI component"
      exports: ["VerdictDisplay"]
    - path: "src/components/CategoryAccordion.tsx"
      provides: "Expandable per-category findings"
      exports: ["CategoryAccordion"]
---

<objective>
Build the VerdictDisplay component that renders a full security verdict from a VerdictResult object. This is the primary user-facing output — a verdict banner (Safe/Risky/Dangerous), numeric score with progress bar, top findings list, and an expandable accordion of per-category analysis.

Includes: legal disclaimer and "Report incorrect verdict" link (required by GEN-02).
</objective>

<execution_context>
@C:/Users/Yana/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/Yana/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/research/FEATURES.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create CategoryAccordion component</name>

  <read_first>
    - src/types/verdict.ts (VerdictCategory type, VerdictLevel, CategoryRiskLevel)
    - .planning/research/FEATURES.md (category names and what each analyzes)
  </read_first>

  <files>src/components/CategoryAccordion.tsx</files>

  <action>
Create `src/components/CategoryAccordion.tsx` using shadcn/ui Accordion:

```tsx
"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import type { VerdictResult, CategoryRiskLevel } from "@/types/verdict";

const CATEGORY_LABELS: Record<keyof VerdictResult["categories"], string> = {
  account_credibility: "Account Credibility",
  repository_credibility: "Repository Credibility",
  package_manifest_risks: "Package Manifest Risks",
  code_behavior_risks: "Code Behavior Risks",
  commit_integrity: "Commit Integrity",
  readme_red_flags: "README Red Flags",
  github_actions_risks: "GitHub Actions Risks",
};

const RISK_COLORS: Record<CategoryRiskLevel, string> = {
  none: "bg-green-100 text-green-800",
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

interface CategoryAccordionProps {
  categories: VerdictResult["categories"];
}

export function CategoryAccordion({ categories }: CategoryAccordionProps) {
  return (
    <Accordion type="multiple" className="w-full">
      {(Object.keys(categories) as Array<keyof typeof categories>).map((key) => {
        const cat = categories[key];
        return (
          <AccordionItem key={key} value={key}>
            <AccordionTrigger className="flex justify-between">
              <span>{CATEGORY_LABELS[key]}</span>
              <Badge className={`ml-2 text-xs ${RISK_COLORS[cat.risk_level]}`}>
                {cat.risk_level}
              </Badge>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              {cat.findings}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
```

Install required shadcn components if not present:
```bash
npx shadcn@latest add accordion badge
```
  </action>

  <acceptance_criteria>
    - `src/components/CategoryAccordion.tsx` exists
    - File contains `CATEGORY_LABELS` with all 7 category keys
    - File contains `RISK_COLORS` mapping none/low/medium/high/critical
    - File exports `CategoryAccordion`
    - File uses `Accordion` from `@/components/ui/accordion`
  </acceptance_criteria>

  <done>CategoryAccordion renders all 7 security categories as expandable items with color-coded risk badges.</done>
</task>

<task type="auto">
  <name>Task 2: Create VerdictDisplay component</name>

  <read_first>
    - src/types/verdict.ts (VerdictResult, VerdictLevel types — exact field names)
    - src/components/CategoryAccordion.tsx (just created — import it)
    - .planning/research/FEATURES.md (verdict display layout: banner → score → findings → categories → proof)
  </read_first>

  <files>src/components/VerdictDisplay.tsx</files>

  <action>
Create `src/components/VerdictDisplay.tsx`:

```tsx
"use client";

import { CategoryAccordion } from "@/components/CategoryAccordion";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { VerdictResult, VerdictLevel } from "@/types/verdict";

const VERDICT_STYLES: Record<VerdictLevel, { bg: string; text: string; border: string; label: string }> = {
  Safe: {
    bg: "bg-green-50",
    text: "text-green-800",
    border: "border-green-300",
    label: "SAFE",
  },
  Risky: {
    bg: "bg-yellow-50",
    text: "text-yellow-800",
    border: "border-yellow-300",
    label: "RISKY",
  },
  Dangerous: {
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-300",
    label: "DANGEROUS",
  },
};

interface VerdictDisplayProps {
  result: VerdictResult;
  repoFullName: string;
}

export function VerdictDisplay({ result, repoFullName }: VerdictDisplayProps) {
  const style = VERDICT_STYLES[result.verdict];

  return (
    <div className="space-y-6">
      {/* Verdict banner */}
      <Card className={`border-2 ${style.border} ${style.bg}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{repoFullName}</p>
              <h2 className={`text-4xl font-bold ${style.text}`}>{style.label}</h2>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Risk Score</p>
              <p className={`text-4xl font-bold ${style.text}`}>{result.overall_score}</p>
              <p className="text-xs text-muted-foreground">/ 100</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={result.overall_score} className="h-3" />
          <p className="mt-3 text-sm">{result.reasoning}</p>
        </CardContent>
      </Card>

      {/* Top findings */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="font-semibold">Key Findings</h3>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {result.top_findings.map((finding, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="mt-0.5 text-muted-foreground">•</span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Category breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <h3 className="font-semibold">Security Signal Breakdown</h3>
        </CardHeader>
        <CardContent>
          <CategoryAccordion categories={result.categories} />
        </CardContent>
      </Card>

      {/* Legal disclaimer + report link */}
      <div className="rounded-md border border-dashed p-4 text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Disclaimer:</strong> This analysis is AI-generated and may contain errors.
          It is provided for informational purposes only and should not be the sole basis
          for security decisions. Always conduct your own due diligence before installing
          third-party dependencies.
        </p>
        <p>
          <a
            href={`mailto:security-report@example.com?subject=Incorrect verdict: ${repoFullName}`}
            className="underline hover:text-foreground"
          >
            Report incorrect verdict
          </a>
        </p>
      </div>
    </div>
  );
}
```

Install Progress component if not present:
```bash
npx shadcn@latest add progress card
```
  </action>

  <acceptance_criteria>
    - `src/components/VerdictDisplay.tsx` exists
    - File exports `VerdictDisplay`
    - File contains `VERDICT_STYLES` with Safe/Risky/Dangerous keys
    - File renders `CategoryAccordion`
    - File contains `Progress` component (score bar)
    - File contains `Disclaimer:` text
    - File contains `Report incorrect verdict` link
    - `npx tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>VerdictDisplay renders full verdict UI: color-coded banner, score bar, reasoning, top findings, category accordion, disclaimer, and report link.</done>
</task>

</tasks>

<verification>
```bash
grep -n "VerdictDisplay" src/components/VerdictDisplay.tsx
grep -n "CategoryAccordion" src/components/CategoryAccordion.tsx
grep -n "Disclaimer" src/components/VerdictDisplay.tsx
grep -n "Report incorrect verdict" src/components/VerdictDisplay.tsx
npx tsc --noEmit
```
</verification>

<success_criteria>
- VerdictDisplay and CategoryAccordion components exist and TypeScript-check clean
- Safe = green, Risky = yellow/amber, Dangerous = red color scheme
- Score shown as number + Progress bar
- top_findings rendered as bullet list
- All 7 categories in accordion with risk_level badge
- Legal disclaimer and report link present on every result
</success_criteria>

<output>
After completion, create `.planning/phases/02-ai-analysis/02-2-SUMMARY.md`
</output>
