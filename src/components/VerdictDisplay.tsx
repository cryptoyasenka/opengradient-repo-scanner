"use client";

import { CategoryAccordion } from "@/components/CategoryAccordion";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { VerdictResult, VerdictLevel } from "@/types/verdict";

const VERDICT_STYLES: Record<VerdictLevel, { bg: string; text: string; border: string; label: string }> = {
  Safe: {
    bg: "bg-green-50 dark:bg-green-950",
    text: "text-green-800 dark:text-green-200",
    border: "border-green-300",
    label: "SAFE",
  },
  Risky: {
    bg: "bg-yellow-50 dark:bg-yellow-950",
    text: "text-yellow-800 dark:text-yellow-200",
    border: "border-yellow-300",
    label: "RISKY",
  },
  Dangerous: {
    bg: "bg-red-50 dark:bg-red-950",
    text: "text-red-800 dark:text-red-200",
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
          <p className="mt-1 text-xs text-muted-foreground">
            Analyzed by {result.modelUsed} · {new Date(result.analyzedAt).toLocaleString()}
          </p>
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
                <span className="mt-0.5 text-muted-foreground shrink-0">•</span>
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
