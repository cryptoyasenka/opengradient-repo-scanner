export interface GitHubRepo {
  full_name: string;
  description: string | null;
  created_at: string;
  pushed_at: string;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  subscribers_count: number;
  license: { name: string; spdx_id: string } | null;
  topics: string[];
  language: string | null;
  archived: boolean;
  default_branch: string;
  owner: {
    login: string;
    type: string;
    created_at?: string;
    public_repos?: number;
    followers?: number;
  };
}

export interface GitHubContributor {
  login: string;
  contributions: number;
  type: string;
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: { name: string; email: string; date: string };
  };
  author: { login: string } | null;
}

export interface GitHubWorkflowFile {
  name: string;
  content: string;
}

export interface RepoData {
  repo: GitHubRepo;
  contributors: GitHubContributor[];
  recentCommits: GitHubCommit[];
  readmeText: string;
  packageJson: Record<string, unknown> | null;
  workflowFiles: GitHubWorkflowFile[];
  rateLimitRemaining: number;
  rateLimitWarning: boolean;
}

export interface FetchRepoError {
  error: string;
  code: 'INVALID_URL' | 'NOT_FOUND' | 'RATE_LIMITED' | 'PRIVATE_REPO' | 'API_ERROR';
}
