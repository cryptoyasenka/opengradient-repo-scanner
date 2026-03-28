"use client";

import { useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { RepoInput } from "@/components/RepoInput";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { VerdictDisplay } from "@/components/VerdictDisplay";
import { ProofBadge } from "@/components/ProofBadge";
import { Button } from "@/components/ui/button";
import type { FetchRepoError } from "@/types/github";
import type { VerdictResult } from "@/types/verdict";

type AnalysisStep = "idle" | "fetching" | "analyzing" | "done" | "error";

export default function Home() {
  const [step, setStep] = useState<AnalysisStep>("idle");
  const [verdictResult, setVerdictResult] = useState<VerdictResult | null>(null);
  const [txHash, setTxHash] = useState<string>("");
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<FetchRepoError | null>(null);
  const [repoFullName, setRepoFullName] = useState<string>("");

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
      if (verdict.txHash) setTxHash(verdict.txHash);
      setVerdictResult(verdict);
      setStep("done");
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
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">GitHub Security Checker</h1>
            <p className="mt-2 text-muted-foreground">
              AI-powered supply chain security analysis for GitHub repositories.
            </p>
          </div>
          <div className="shrink-0 pt-1">
            <ConnectButton chainStatus="icon" showBalance={false} />
          </div>
        </div>

        {/* Input — always visible when not done */}
        {step !== "done" && (
          <RepoInput
            onSubmit={handleAnalyze}
            isLoading={step === "fetching" || step === "analyzing"}
          />
        )}

        {/* Progress steps */}
        {(step === "fetching" || step === "analyzing") && (
          <AnalysisProgress step={step} />
        )}

        {/* Fetch error */}
        {step === "error" && fetchError && (
          <div className="mt-8">
            <ErrorDisplay error={fetchError} onReset={handleReset} />
          </div>
        )}

        {/* Analysis error */}
        {step === "error" && !fetchError && (
          <div className="mt-8 space-y-4">
            <AnalysisProgress step="error" errorMessage={analysisError ?? undefined} />
            <Button variant="outline" onClick={handleReset}>Try another repository</Button>
          </div>
        )}

        {/* Verdict result */}
        {step === "done" && verdictResult && (
          <div className="mt-8 space-y-6">
            {txHash && (
              <ProofBadge txHash={txHash} analyzedAt={verdictResult.analyzedAt} />
            )}
            <VerdictDisplay result={verdictResult} repoFullName={repoFullName} />
            <div className="text-center">
              <Button variant="outline" onClick={handleReset}>
                Check another repository
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
