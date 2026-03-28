import { NextRequest, NextResponse } from 'next/server';
import { analyzeRepo } from '@/lib/opengradient';
import type { RepoData } from '@/types/github';
import type { AnalyzeError } from '@/types/verdict';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { repoData?: RepoData };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<AnalyzeError>(
      { error: 'Request body must be JSON with a "repoData" field', code: 'INVALID_INPUT' },
      { status: 400 }
    );
  }

  const { repoData } = body;

  if (!repoData || typeof repoData !== 'object' || !repoData.repo?.full_name) {
    return NextResponse.json<AnalyzeError>(
      { error: 'Missing or invalid "repoData" in request body', code: 'INVALID_INPUT' },
      { status: 400 }
    );
  }

  try {
    const verdict = await analyzeRepo(repoData);
    return NextResponse.json(verdict, { status: 200 });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const typedErr = err as { code: string; message: string };
      const statusMap: Record<string, number> = {
        INVALID_INPUT: 400,
        AI_PARSE_ERROR: 502,
        AI_API_ERROR: 502,
        TIMEOUT: 504,
        SERVER_ERROR: 500,
      };
      const status = statusMap[typedErr.code] ?? 500;
      return NextResponse.json<AnalyzeError>(
        { error: typedErr.message, code: typedErr.code as AnalyzeError['code'] },
        { status }
      );
    }

    console.error('[analyze] Unexpected error:', err);
    return NextResponse.json<AnalyzeError>(
      { error: 'Internal server error during analysis', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
