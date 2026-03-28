export type VerdictLevel = 'Safe' | 'Risky' | 'Dangerous';

export type CategoryRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface VerdictCategory {
  risk_level: CategoryRiskLevel;
  findings: string;
}

export interface VerdictResult {
  verdict: VerdictLevel;
  overall_score: number;
  categories: {
    account_credibility: VerdictCategory;
    repository_credibility: VerdictCategory;
    package_manifest_risks: VerdictCategory;
    code_behavior_risks: VerdictCategory;
    commit_integrity: VerdictCategory;
    readme_red_flags: VerdictCategory;
    github_actions_risks: VerdictCategory;
  };
  top_findings: string[];
  reasoning: string;
  modelUsed: string;
  analyzedAt: string;
}

export interface AnalyzeError {
  error: string;
  code: 'INVALID_INPUT' | 'AI_PARSE_ERROR' | 'AI_API_ERROR' | 'TIMEOUT' | 'SERVER_ERROR';
}
