import { NextRequest, NextResponse } from 'next/server';
import { fetchRepoData, parseOwnerRepo } from '@/lib/github';
import type { FetchRepoError } from '@/types/github';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

if (!process.env.GITHUB_TOKEN) {
  console.warn('[fetch-repo] GITHUB_TOKEN not set — unauthenticated GitHub API in use (60 req/hr)');
}

export async function POST(req: NextRequest) {
  let body: { repo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json<FetchRepoError>(
      { error: 'Request body must be JSON with a "repo" field', code: 'INVALID_URL' },
      { status: 400 }
    );
  }

  const repoInput = body.repo?.trim();
  if (!repoInput) {
    return NextResponse.json<FetchRepoError>(
      { error: 'Missing required field: repo', code: 'INVALID_URL' },
      { status: 400 }
    );
  }

  const parsed = parseOwnerRepo(repoInput);
  if (!parsed) {
    return NextResponse.json<FetchRepoError>(
      { error: 'Invalid GitHub repository URL. Expected format: github.com/owner/repo or owner/repo', code: 'INVALID_URL' },
      { status: 400 }
    );
  }

  const { owner, repo } = parsed;

  try {
    const data = await fetchRepoData(owner, repo);
    return NextResponse.json(data, { status: 200 });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err) {
      const typedErr = err as FetchRepoError;
      const statusMap: Record<string, number> = {
        NOT_FOUND: 404,
        RATE_LIMITED: 429,
        PRIVATE_REPO: 403,
        API_ERROR: 502,
        INVALID_URL: 400,
      };
      const status = statusMap[typedErr.code] ?? 500;
      return NextResponse.json<FetchRepoError>(typedErr, { status });
    }

    console.error('[fetch-repo] Unexpected error:', err);
    return NextResponse.json<FetchRepoError>(
      { error: 'Internal server error while fetching repository data', code: 'API_ERROR' },
      { status: 500 }
    );
  }
}
