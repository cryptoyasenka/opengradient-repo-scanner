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
    <div className="mt-8 space-y-3">
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
