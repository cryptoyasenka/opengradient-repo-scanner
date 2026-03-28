import Link from 'next/link';
import { VerdictCard } from '@/components/VerdictCard';
import { ProofBadge } from '@/components/ProofBadge';
import { ShareButton } from '@/components/ShareButton';
import { AlertTriangle } from 'lucide-react';

interface ResultPageProps {
  searchParams: Promise<{
    repo?: string;
    verdict?: string;
    score?: string;
    tx?: string;
    summary?: string;
    date?: string;
  }>;
}

export default async function ResultPage({ searchParams }: ResultPageProps) {
  const params = await searchParams;
  const { repo, verdict, score, tx, summary, date } = params;

  if (!verdict || !repo) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
        <AlertTriangle className="h-12 w-12 text-yellow-500" />
        <h1 className="text-xl font-semibold">No result found</h1>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          This link does not contain a valid security result. Results are encoded in the URL — the link may be incomplete or expired.
        </p>
        <Link href="/" className="text-sm underline underline-offset-4 hover:text-primary">
          Check a repository
        </Link>
      </main>
    );
  }

  const numericScore = parseInt(score ?? '0', 10);
  const verdictLevel = (verdict === 'Safe' || verdict === 'Risky' || verdict === 'Dangerous')
    ? verdict
    : 'Risky';

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Security analysis result</p>
        <h1 className="text-lg font-semibold break-all">{repo}</h1>
        {date && <p className="text-xs text-muted-foreground">Analyzed on {date}</p>}
      </div>

      <VerdictCard
        verdict={verdictLevel}
        score={numericScore}
        summary={summary ?? ''}
      />

      {tx && <ProofBadge txHash={tx} analyzedAt={date ?? new Date().toISOString()} />}

      <p className="text-xs text-muted-foreground border rounded-md p-3">
        This is an AI-assisted surface analysis, not a professional security audit.
        Results may be inaccurate. Always verify critical dependencies independently.
        The operator of this tool accepts no liability for decisions made based on these results.
      </p>

      <div className="flex items-center gap-3">
        <ShareButton />
        <Link href="/" className="text-sm underline underline-offset-4 hover:text-primary">
          Check another repository
        </Link>
      </div>
    </main>
  );
}
