import 'server-only';
import type { RepoData } from '@/types/github';
import type { VerdictResult } from '@/types/verdict';

const OPENGRADIENT_URL = 'https://llm.opengradient.ai/v1/chat/completions';
const MODEL = 'openai/gpt-4o';

function buildSecurityPrompt(data: RepoData): string {
  const bundle = {
    repo: {
      full_name: data.repo.full_name,
      description: data.repo.description,
      created_at: data.repo.created_at,
      pushed_at: data.repo.pushed_at,
      stargazers_count: data.repo.stargazers_count,
      forks_count: data.repo.forks_count,
      open_issues_count: data.repo.open_issues_count,
      license: data.repo.license,
      topics: data.repo.topics,
      language: data.repo.language,
      archived: data.repo.archived,
    },
    owner: {
      login: data.repo.owner.login,
      created_at: data.repo.owner.created_at,
      public_repos: data.repo.owner.public_repos,
      followers: data.repo.owner.followers,
    },
    contributors: data.contributors.slice(0, 5),
    recent_commits: data.recentCommits.slice(0, 10).map(c => ({
      sha: c.sha.slice(0, 7),
      message: c.commit.message.split('\n')[0].slice(0, 100),
      author: c.commit.author.name,
      email: c.commit.author.email,
      date: c.commit.author.date,
    })),
    readme_text: data.readmeText.slice(0, 2000),
    package_json: data.packageJson
      ? JSON.stringify(data.packageJson).slice(0, 2000)
      : null,
    workflow_files: data.workflowFiles.map(w => ({
      name: w.name,
      content: w.content.slice(0, 1500),
    })),
  };

  const systemInstruction = `You are a supply chain security analyst specializing in malicious GitHub repositories.
Analyze the following repository data for security risks.

ANALYZE THESE SPECIFIC SIGNAL CATEGORIES IN ORDER:
1. ACCOUNT CREDIBILITY: Owner account age, number of repos, followers
2. REPOSITORY CREDIBILITY: Repo age, stars, license, description quality
3. PACKAGE MANIFEST RISKS: postinstall hooks, suspicious scripts, typosquatting names
4. CODE BEHAVIOR RISKS: base64 decode+exec, network calls in install scripts, obfuscation
5. COMMIT INTEGRITY: Commit frequency, author consistency, suspicious timing patterns
6. README RED FLAGS: External payment links, piracy claims, unrealistic promises
7. GITHUB ACTIONS RISKS: External fetches, base64 commands, mutable action tags, secret logging

For each category, provide:
- findings: specific evidence found (or "none found")
- risk_level: none | low | medium | high | critical

Then provide:
- overall_score: integer 0-100 (0=completely safe, 100=confirmed malicious)
- verdict: "Safe" | "Risky" | "Dangerous"
- top_findings: array of 3-5 most important findings, each as one sentence
- reasoning: 2-3 sentence explanation of the verdict

SCORING GUIDE:
- 0-30: Safe — typical open source project, no red flags
- 31-65: Risky — some concerning signals, use with caution, investigate further
- 66-100: Dangerous — clear malicious indicators, do not install

Respond ONLY with valid JSON matching this exact schema. No markdown fences, no explanation outside the JSON:
{
  "overall_score": <integer 0-100>,
  "verdict": "Safe" | "Risky" | "Dangerous",
  "categories": {
    "account_credibility": { "risk_level": "none|low|medium|high|critical", "findings": "..." },
    "repository_credibility": { "risk_level": "none|low|medium|high|critical", "findings": "..." },
    "package_manifest_risks": { "risk_level": "none|low|medium|high|critical", "findings": "..." },
    "code_behavior_risks": { "risk_level": "none|low|medium|high|critical", "findings": "..." },
    "commit_integrity": { "risk_level": "none|low|medium|high|critical", "findings": "..." },
    "readme_red_flags": { "risk_level": "none|low|medium|high|critical", "findings": "..." },
    "github_actions_risks": { "risk_level": "none|low|medium|high|critical", "findings": "..." }
  },
  "top_findings": ["...", "...", "..."],
  "reasoning": "..."
}`;

  return systemInstruction + '\n\nREPOSITORY DATA:\n' + JSON.stringify(bundle, null, 2);
}

async function callWithX402(prompt: string): Promise<{ rawContent: string; txHash: string | null }> {
  const privateKey = process.env.APP_WALLET_PRIVATE_KEY;

  if (!privateKey) {
    console.warn('[opengradient] APP_WALLET_PRIVATE_KEY not set — calling OpenGradient without x402 payment');
    return callDirect(prompt);
  }

  try {
    const { wrapFetchWithPayment, x402Client } = await import('@x402/fetch');
    const { registerExactEvmScheme } = await import('@x402/evm/exact/client');
    const { privateKeyToAccount } = await import('viem/accounts');

    const account = privateKeyToAccount(privateKey as `0x${string}`);

    // Create a simple signer compatible with ExactEvmScheme
    const signer = {
      address: account.address,
      signTypedData: account.signTypedData.bind(account),
    };

    const client = new x402Client();
    registerExactEvmScheme(client, { signer });

    const x402fetch = wrapFetchWithPayment(fetch, client);

    const response = await x402fetch(OPENGRADIENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SETTLEMENT-TYPE': 'individual',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw Object.assign(
        new Error(`OpenGradient returned ${response.status}: ${body.slice(0, 200)}`),
        { code: 'AI_API_ERROR' as const }
      );
    }

    // Extract on-chain proof from response header
    const rawPaymentResponse = response.headers.get('X-PAYMENT-RESPONSE');
    let txHash: string | null = null;
    if (rawPaymentResponse) {
      try {
        const decoded = JSON.parse(
          Buffer.from(rawPaymentResponse, 'base64').toString('utf-8')
        );
        txHash = decoded.txHash ?? decoded.transaction_hash ?? null;
      } catch {
        console.warn('[opengradient] Could not parse X-PAYMENT-RESPONSE header');
      }
    }

    const body = await response.json();
    const rawContent: string = body?.choices?.[0]?.message?.content ?? '';
    return { rawContent, txHash };
  } catch (err: unknown) {
    // If x402 payment fails, fall back to direct call
    console.warn('[opengradient] x402 payment failed, falling back to direct call:', err instanceof Error ? err.message : err);
    return callDirect(prompt);
  }
}

async function callDirect(prompt: string): Promise<{ rawContent: string; txHash: string | null }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);

  let response: Response;
  try {
    response = await fetch(OPENGRADIENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.2,
      }),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw Object.assign(new Error('OpenGradient request timed out after 45 seconds'), {
        code: 'TIMEOUT' as const,
      });
    }
    throw Object.assign(new Error('Failed to reach OpenGradient API'), {
      code: 'AI_API_ERROR' as const,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw Object.assign(
      new Error(`OpenGradient returned ${response.status}: ${body.slice(0, 200)}`),
      { code: 'AI_API_ERROR' as const }
    );
  }

  const responseData = await response.json();
  const rawContent: string = responseData?.choices?.[0]?.message?.content ?? '';
  return { rawContent, txHash: null };
}

export async function analyzeRepo(data: RepoData): Promise<VerdictResult & { txHash: string | null }> {
  const prompt = buildSecurityPrompt(data);
  const { rawContent, txHash } = await callWithX402(prompt);

  const jsonStr = rawContent
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsed: VerdictResult;
  try {
    const raw = JSON.parse(jsonStr);
    if (
      typeof raw.overall_score !== 'number' ||
      !['Safe', 'Risky', 'Dangerous'].includes(raw.verdict) ||
      !raw.categories ||
      !Array.isArray(raw.top_findings) ||
      typeof raw.reasoning !== 'string'
    ) {
      throw new Error('Missing or invalid required fields in AI response');
    }
    parsed = {
      ...raw,
      modelUsed: MODEL,
      analyzedAt: new Date().toISOString(),
    } as VerdictResult;
  } catch {
    console.error('[opengradient] Failed to parse AI response:', rawContent.slice(0, 500));
    throw Object.assign(
      new Error('AI returned malformed JSON — could not parse verdict'),
      { code: 'AI_PARSE_ERROR' as const }
    );
  }

  return { ...parsed, txHash };
}
