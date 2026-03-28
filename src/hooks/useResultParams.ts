"use client";

import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';

export function useResultParams() {
  const [repo, setRepo] = useQueryState('repo', parseAsString.withDefault(''));
  const [verdict, setVerdict] = useQueryState('verdict', parseAsString.withDefault(''));
  const [score, setScore] = useQueryState('score', parseAsInteger.withDefault(0));
  const [txHash, setTxHash] = useQueryState('tx', parseAsString.withDefault(''));
  const [summary, setSummary] = useQueryState('summary', parseAsString.withDefault(''));
  const [analysisDate, setAnalysisDate] = useQueryState('date', parseAsString.withDefault(''));

  const hasResult = Boolean(verdict && repo);

  function encodeResult(params: {
    repo: string;
    verdict: string;
    score: number;
    txHash: string;
    summary: string;
  }) {
    setRepo(params.repo);
    setVerdict(params.verdict);
    setScore(params.score);
    setTxHash(params.txHash);
    setSummary(params.summary.slice(0, 120));
    setAnalysisDate(new Date().toISOString().split('T')[0]);
  }

  function clearResult() {
    setRepo(null);
    setVerdict(null);
    setScore(null);
    setTxHash(null);
    setSummary(null);
    setAnalysisDate(null);
  }

  return {
    repo, verdict, score, txHash, summary, analysisDate,
    hasResult, encodeResult, clearResult,
  };
}
