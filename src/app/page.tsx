"use client";

import { Suspense, useState } from "react";
import { RepoInput } from "@/components/RepoInput";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { VerdictDisplay } from "@/components/VerdictDisplay";
import { VerdictCard } from "@/components/VerdictCard";
import { ProofBadge } from "@/components/ProofBadge";
import { ShareButton } from "@/components/ShareButton";
import { Button } from "@/components/ui/button";
import { useResultParams } from "@/hooks/useResultParams";
import type { FetchRepoError } from "@/types/github";
import type { VerdictResult } from "@/types/verdict";

type AnalysisStep = "idle" | "fetching" | "analyzing" | "done" | "error";

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const [step, setStep] = useState<AnalysisStep>("idle");
  const [verdictResult, setVerdictResult] = useState<VerdictResult | null>(null);
  const [txHash, setTxHash] = useState<string>("");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<FetchRepoError | null>(null);
  const [repoFullName, setRepoFullName] = useState<string>("");

  const { repo: sharedRepo, verdict: sharedVerdict, score: sharedScore, txHash: sharedTx, summary: sharedSummary, analysisDate: sharedDate, hasResult: hasSharedResult, encodeResult, clearResult } = useResultParams();

  async function handleAnalyze(repoUrl: string) {
    setStep("fetching");
    setVerdictResult(null);
    setTxHash("");
    setAnalysisError(null);
    setFetchError(null);
    setRepoFullName("");

    // Step 1: Fetch repo data
    let repoData;
    try {
      const res = await fetch("/api/fetch-repo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo: repoUrl }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFetchError(json as FetchRepoError);
        setStep("error");
        return;
      }
      repoData = json;
      setRepoFullName(repoData.repo?.full_name ?? repoUrl);
    } catch {
      setAnalysisError("Network error: could not reach the server. Check your connection.");
      setStep("error");
      return;
    }

    // Step 2: Analyze with AI (+ x402 payment if APP_WALLET_PRIVATE_KEY is set)
    setStep("analyzing");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoData }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAnalysisError(json.error ?? "AI analysis failed");
        setStep("error");
        return;
      }
      const verdict = json as VerdictResult & { txHash?: string };
      const resolvedTxHash = verdict.txHash ?? "";
      if (resolvedTxHash) setTxHash(resolvedTxHash);
      setVerdictResult(verdict);
      setStep("done");

      // Encode result into URL for sharing
      encodeResult({
        repo: repoData.repo?.full_name ?? repoUrl,
        verdict: verdict.verdict,
        score: verdict.overall_score,
        txHash: resolvedTxHash,
        summary: verdict.reasoning ?? verdict.top_findings?.[0] ?? "",
      });
    } catch {
      setAnalysisError("AI analysis failed. Please try again.");
      setStep("error");
    }
  }

  function handleReset() {
    setStep("idle");
    setVerdictResult(null);
    setTxHash("");
    setAnalysisError(null);
    setFetchError(null);
    setRepoFullName("");
    clearResult();
  }

  return (
    <main className="min-h-screen relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0a0f19 0%, #141e32 40%, #0e4b5b 100%)' }}>
      {/* Background glow effect */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(36, 188, 227, 0.08) 0%, transparent 60%)' }} />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-16">
        {/* Header with OG Logo */}
        <div className="mb-12 og-hero-in">
          <div className="flex items-center gap-3 mb-6">
            <div data-og-logo="wordmark" className="h-8" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight og-gradient-text" style={{ animationDelay: '0.2s' }}>
            Security Checker
          </h1>
          <p className="mt-4 text-lg text-[#999999] max-w-xl" style={{ animation: 'og-fade-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both' }}>
            AI-powered supply chain security analysis for GitHub repositories, verified on-chain via TEE.
          </p>
        </div>

        {/* Shared result from URL */}
        {hasSharedResult && step === "idle" && (
          <div className="space-y-6 og-fade-up" style={{ animationDelay: '0.4s' }}>
            <div className="space-y-1 mb-4">
              <p className="text-sm text-[#999999]">Security analysis result</p>
              <h2 className="text-lg font-semibold text-[#e6e6e6] break-all font-mono">{sharedRepo}</h2>
              {sharedDate && <p className="text-xs text-[#666666]">Analyzed on {sharedDate}</p>}
            </div>

            <VerdictCard
              verdict={(sharedVerdict === 'Safe' || sharedVerdict === 'Risky' || sharedVerdict === 'Dangerous') ? sharedVerdict : 'Risky'}
              score={sharedScore}
              summary={sharedSummary}
            />

            {sharedTx && <ProofBadge txHash={sharedTx} analyzedAt={sharedDate || new Date().toISOString()} />}

            <div className="rounded-xl border border-dashed border-[rgba(36,188,227,0.15)] p-3 text-xs text-[#666666]">
              This is an AI-assisted surface analysis, not a professional security audit.
              Results may be inaccurate. Always verify critical dependencies independently.
            </div>

            <div className="flex items-center justify-center gap-3">
              <ShareButton />
              <button onClick={() => clearResult()} className="h-8 px-3 rounded-lg text-sm font-medium border border-[rgba(36,188,227,0.3)] bg-transparent text-[#bdebf7] hover:bg-[rgba(36,188,227,0.1)] hover:border-[rgba(36,188,227,0.5)] transition-all duration-300">
                Check another repository
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        {step !== "done" && !(hasSharedResult && step === "idle") && (
          <div className="og-fade-up" style={{ animationDelay: '0.5s' }}>
            <RepoInput
              onSubmit={handleAnalyze}
              isLoading={step === "fetching" || step === "analyzing"}
            />
          </div>
        )}

        {/* Progress */}
        {(step === "fetching" || step === "analyzing") && (
          <div className="mt-8 og-fade-up">
            <AnalysisProgress step={step} />
          </div>
        )}

        {/* Fetch error */}
        {step === "error" && fetchError && (
          <div className="mt-8 og-fade-up">
            <ErrorDisplay error={fetchError} onReset={handleReset} />
          </div>
        )}

        {/* Analysis error */}
        {step === "error" && !fetchError && (
          <div className="mt-8 space-y-4 og-fade-up">
            <AnalysisProgress step="error" errorMessage={analysisError ?? undefined} />
            <button onClick={handleReset} className="h-8 px-3 rounded-lg text-sm font-medium border border-[rgba(36,188,227,0.3)] bg-transparent text-[#bdebf7] hover:bg-[rgba(36,188,227,0.1)] hover:border-[rgba(36,188,227,0.5)] transition-all duration-300">Try another repository</button>
          </div>
        )}

        {/* Verdict result */}
        {step === "done" && verdictResult && (
          <div className="mt-8 space-y-6 og-stagger">
            {txHash && (
              <div className="og-fade-up">
                <ProofBadge txHash={txHash} analyzedAt={verdictResult.analyzedAt} />
              </div>
            )}
            <div className="og-fade-up">
              <VerdictDisplay result={verdictResult} repoFullName={repoFullName} />
            </div>
            <div className="flex items-center justify-center gap-3 og-fade-up">
              <ShareButton />
              <button onClick={handleReset} className="h-8 px-3 rounded-lg text-sm font-medium border border-[rgba(36,188,227,0.3)] bg-transparent text-[#bdebf7] hover:bg-[rgba(36,188,227,0.1)] hover:border-[rgba(36,188,227,0.5)] transition-all duration-300">
                Check another repository
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-20 pt-8 border-t border-[rgba(36,188,227,0.1)] text-center">
          <p className="text-xs text-[#666666]">
            Powered by <span className="text-[#24bce3]">OpenGradient</span> Trusted Execution Environment
          </p>
        </div>
      </div>
    </main>
  );
}
