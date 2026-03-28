import 'server-only';
import type { RepoData, GitHubRepo, GitHubContributor, GitHubCommit, FetchRepoError } from '@/types/github';

function buildGitHubHeaders(): HeadersInit {
  const headers: HeadersInit = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
  } else {
    console.warn('[github] GITHUB_TOKEN not set — using unauthenticated API (60 req/hr limit)');
  }
  return headers;
}

export function parseOwnerRepo(input: string): { owner: string; repo: string } | null {
  let cleaned = input.trim();
  // Remove protocol
  cleaned = cleaned.replace(/^https?:\/\//, '');
  // Remove github.com/ prefix
  cleaned = cleaned.replace(/^github\.com\//, '');
  // Remove trailing slash and .git suffix
  cleaned = cleaned.replace(/\.git$/, '').replace(/\/$/, '');

  const parts = cleaned.split('/');
  if (parts.length < 2) return null;

  const owner = parts[0];
  const repo = parts[1];

  const validSegment = /^[a-zA-Z0-9._-]+$/;
  if (!owner || !repo || !validSegment.test(owner) || !validSegment.test(repo)) {
    return null;
  }

  return { owner, repo };
}

export async function fetchRepoData(owner: string, repo: string): Promise<RepoData> {
  const headers = buildGitHubHeaders();
  const base = 'https://api.github.com';

  // Fire all main requests in parallel
  const [repoRes, ownerRes, contributorsRes, commitsRes, readmeRes, pkgRes, workflowsRes] =
    await Promise.all([
      fetch(`${base}/repos/${owner}/${repo}`, { headers }),
      fetch(`${base}/users/${owner}`, { headers }),
      fetch(`${base}/repos/${owner}/${repo}/contributors?per_page=5`, { headers }),
      fetch(`${base}/repos/${owner}/${repo}/commits?per_page=10`, { headers }),
      fetch(`${base}/repos/${owner}/${repo}/readme`, { headers }),
      fetch(`${base}/repos/${owner}/${repo}/contents/package.json`, { headers }),
      fetch(`${base}/repos/${owner}/${repo}/contents/.github/workflows`, { headers }),
    ]);

  // Handle main repo response errors
  if (!repoRes.ok) {
    const body = await repoRes.json().catch(() => ({}));
    const message = (body as { message?: string }).message ?? '';

    if (repoRes.status === 404) {
      throw { error: 'Repository not found', code: 'NOT_FOUND' } as FetchRepoError;
    }
    if (repoRes.status === 403 && message.toLowerCase().includes('rate limit')) {
      throw { error: 'GitHub API rate limit exceeded', code: 'RATE_LIMITED' } as FetchRepoError;
    }
    if (repoRes.status === 403) {
      throw { error: 'Repository is private or access denied', code: 'PRIVATE_REPO' } as FetchRepoError;
    }
    throw { error: `GitHub API error: ${message}`, code: 'API_ERROR' } as FetchRepoError;
  }

  const repoData: GitHubRepo = await repoRes.json();

  // Rate limit check
  const rateLimitRemaining = parseInt(repoRes.headers.get('X-RateLimit-Remaining') ?? '60', 10);
  const rateLimitWarning = rateLimitRemaining < 5;

  // Merge owner profile
  if (ownerRes.ok) {
    const ownerProfile = await ownerRes.json();
    repoData.owner.created_at = ownerProfile.created_at;
    repoData.owner.public_repos = ownerProfile.public_repos;
    repoData.owner.followers = ownerProfile.followers;
  }

  // Contributors
  const contributors: GitHubContributor[] = contributorsRes.ok ? await contributorsRes.json() : [];

  // Commits
  const recentCommits: GitHubCommit[] = commitsRes.ok ? await commitsRes.json() : [];

  // README
  let readmeText = '';
  if (readmeRes.ok) {
    const readmeData = await readmeRes.json();
    const raw = Buffer.from(readmeData.content.replace(/\n/g, ''), 'base64').toString('utf-8');
    readmeText = raw.slice(0, 3000);
  }

  // package.json
  let packageJson: Record<string, unknown> | null = null;
  if (pkgRes.ok) {
    const pkgData = await pkgRes.json();
    try {
      const raw = Buffer.from(pkgData.content.replace(/\n/g, ''), 'base64').toString('utf-8');
      packageJson = JSON.parse(raw.slice(0, 2000));
    } catch {
      packageJson = null;
    }
  }

  // Workflow files
  const workflowFiles: { name: string; content: string }[] = [];
  if (workflowsRes.ok) {
    const workflowsDir = await workflowsRes.json();
    if (Array.isArray(workflowsDir) && workflowsDir.length > 0) {
      const first = workflowsDir[0];
      if (first?.download_url) {
        const wfRes = await fetch(first.download_url, { headers });
        if (wfRes.ok) {
          const content = await wfRes.text();
          workflowFiles.push({ name: first.name, content: content.slice(0, 2000) });
        }
      }
    }
  }

  return {
    repo: repoData,
    contributors,
    recentCommits,
    readmeText,
    packageJson,
    workflowFiles,
    rateLimitRemaining,
    rateLimitWarning,
  };
}
