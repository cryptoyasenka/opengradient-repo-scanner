import 'server-only';
import https from 'https';
import type { RepoData } from '@/types/github';
import type { VerdictResult } from '@/types/verdict';

const MODEL = 'claude-haiku-4-5';
const PLACEHOLDER_AUTH = 'Bearer 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

const TEE_REGISTRY_ADDRESS = '0x4e72238852f3c918f4E4e57AeC9280dDB0c80248';
const OG_RPC = 'https://ogevmdevnet.opengradient.ai';
const TEE_REGISTRY_ABI = [{
  name: 'getActiveTEEs',
  type: 'function',
  inputs: [{ name: 'teeType', type: 'uint8' }],
  outputs: [{ type: 'tuple[]', components: [
    { name: 'owner', type: 'address' },
    { name: 'paymentAddress', type: 'address' },
    { name: 'endpoint', type: 'string' },
    { name: 'publicKey', type: 'bytes' },
    { name: 'tlsCertificate', type: 'bytes' },
    { name: 'pcrHash', type: 'bytes32' },
    { name: 'teeType', type: 'uint8' },
    { name: 'enabled', type: 'bool' },
    { name: 'registeredAt', type: 'uint256' },
    { name: 'lastHeartbeatAt', type: 'uint256' },
  ]}],
  stateMutability: 'view',
}] as const;

let cachedTeeEndpoint: string | null = null;

async function getTeeEndpoint(): Promise<string> {
  if (cachedTeeEndpoint) return cachedTeeEndpoint;
  try {
    const { createPublicClient, http } = await import('viem');
    const client = createPublicClient({
      transport: http(OG_RPC),
      chain: { id: 10740, name: 'OG EVM Devnet', nativeCurrency: { name: 'OPG', symbol: 'OPG', decimals: 18 }, rpcUrls: { default: { http: [OG_RPC] } } },
    });
    const tees = await client.readContract({
      address: TEE_REGISTRY_ADDRESS,
      abi: TEE_REGISTRY_ABI,
      functionName: 'getActiveTEEs',
      args: [0],
    }) as unknown as Array<{ endpoint: string; enabled: boolean }>;
    const active = tees.filter(t => t.enabled && t.endpoint);
    if (!active.length) throw new Error('No active TEE nodes found');
    cachedTeeEndpoint = active[0].endpoint + '/v1/chat/completions';
    console.log('[opengradient] Resolved TEE endpoint:', cachedTeeEndpoint);
    return cachedTeeEndpoint;
  } catch (err) {
    console.error('[opengradient] TEE discovery failed:', err);
    throw Object.assign(new Error('Failed to discover OpenGradient TEE endpoint'), { code: 'AI_API_ERROR' as const });
  }
}

const tlsAgent = new https.Agent({ rejectUnauthorized: false });
function teeNodeFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, ...(String(url).startsWith('https://') ? { agent: tlsAgent } as never : {}) });
}

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
5. COMMIT INTEGRITY: Commit frequency, author consistency, suspicious timing patterns. IMPORTANT: When checking author consistency, match by EMAIL address, not display name. Different display names with the same email are the SAME person (e.g. git config name changes) — do NOT flag this as suspicious.
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

async function createUptoPayment(
  privateKey: string,
  requirements: { network: string; asset: string; amount: string; payTo: string; maxTimeoutSeconds: number }
) {
  const { privateKeyToAccount } = await import('viem/accounts');
  const { getAddress } = await import('viem');

  const OG_PERMIT2_WITNESS_TYPES = {
    PermitWitnessTransferFrom: [
      { name: 'permitted', type: 'TokenPermissions' },
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
      { name: 'witness', type: 'Witness' },
    ],
    TokenPermissions: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    Witness: [
      { name: 'to', type: 'address' },
      { name: 'validAfter', type: 'uint256' },
      { name: 'extra', type: 'bytes' },
    ],
  } as const;
  const OG_UPTO_PROXY = '0xBe08D629cc799E6C17200F454F68A61E017038C8';

  const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3' as const;
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const chainId = parseInt(requirements.network.split(':')[1]);
  const now = Math.floor(Date.now() / 1000);

  const nonceBytes = crypto.getRandomValues(new Uint8Array(32));
  const nonce = BigInt('0x' + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join(''));
  const nonceStr = nonce.toString();
  const deadline = (now + requirements.maxTimeoutSeconds).toString();
  const validAfter = (now - 60).toString();

  const signature = await account.signTypedData({
    domain: { name: 'Permit2', chainId, verifyingContract: PERMIT2_ADDRESS },
    types: OG_PERMIT2_WITNESS_TYPES,
    primaryType: 'PermitWitnessTransferFrom',
    message: {
      permitted: {
        token: getAddress(requirements.asset),
        amount: BigInt(requirements.amount),
      },
      spender: getAddress(OG_UPTO_PROXY),
      nonce,
      deadline: BigInt(deadline),
      witness: {
        to: getAddress(requirements.payTo),
        validAfter: BigInt(validAfter),
        extra: '0x' as `0x${string}`,
      },
    },
  });

  return {
    x402Version: 2,
    payload: {
      signature,
      permit2Authorization: {
        from: account.address,
        permitted: { token: getAddress(requirements.asset), amount: requirements.amount },
        spender: getAddress(OG_UPTO_PROXY),
        nonce: nonceStr,
        deadline,
        witness: { to: getAddress(requirements.payTo), validAfter, extra: '0x' },
      },
    },
  };
}

async function callWithX402(prompt: string): Promise<{ rawContent: string; txHash: string | null }> {
  const privateKey = process.env.APP_WALLET_PRIVATE_KEY;
  if (!privateKey) {
    throw Object.assign(new Error('APP_WALLET_PRIVATE_KEY not set'), { code: 'AI_API_ERROR' as const });
  }

  const teeUrl = await getTeeEndpoint();

  const body = JSON.stringify({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 2000,
    temperature: 0.2,
  });

  // Step 1: probe for payment requirements (match SDK: include Auth + batch settlement)
  console.log('[opengradient] Step 1: Probing', teeUrl, 'model:', MODEL);
  const probe = await teeNodeFetch(teeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': PLACEHOLDER_AUTH,
      'X-SETTLEMENT-TYPE': 'batch',
    },
    body,
  });

  if (probe.status !== 402) {
    if (!probe.ok) {
      const errBody = await probe.text().catch(() => '');
      throw Object.assign(new Error(`OpenGradient returned ${probe.status}: ${errBody.slice(0, 500)}`), { code: 'AI_API_ERROR' as const });
    }
    const data = await probe.json();
    return { rawContent: data?.choices?.[0]?.message?.content ?? '', txHash: null };
  }

  // Step 2: parse payment requirements
  const payHeader = probe.headers.get('payment-required') ?? probe.headers.get('PAYMENT-REQUIRED');
  if (!payHeader) throw new Error('No payment-required header in 402 response');
  const payReqs = JSON.parse(Buffer.from(payHeader, 'base64').toString());
  console.log('[opengradient] Step 2: Payment options:', payReqs.accepts?.length);

  const accepts = payReqs.accepts ?? [];
  let req = accepts.find((r: { scheme: string; network: string }) => r.scheme === 'upto' && r.network === 'eip155:84532');
  if (!req) req = accepts[0];
  if (!req) throw new Error('No payment option found');

  // Step 3: create payment and send (SDK gets 200 directly after payment)
  const payment = await createUptoPayment(privateKey, req);
  const fullPayment = {
    ...payment,
    resource: payReqs.resource ?? teeUrl,
    accepted: req,
    extensions: payReqs.extensions ?? {},
  };
  const paymentHeader = Buffer.from(JSON.stringify(fullPayment)).toString('base64');
  console.log('[opengradient] Step 3: Sending payment...');

  const paid = await teeNodeFetch(teeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': PLACEHOLDER_AUTH,
      'X-SETTLEMENT-TYPE': 'batch',
      'PAYMENT-SIGNATURE': paymentHeader,
    },
    body,
  });

  console.log('[opengradient] Payment response:', paid.status);

  if (!paid.ok) {
    const errBody = await paid.text().catch(() => '');
    console.error('[opengradient] Request failed:', paid.status, errBody.slice(0, 500));
    throw Object.assign(
      new Error(`OpenGradient returned ${paid.status}: ${errBody.slice(0, 500)}`),
      { code: 'AI_API_ERROR' as const }
    );
  }

  // Extract TEE verification data from response headers
  const teeSignature = paid.headers.get('x-tee-signature');
  const teeId = paid.headers.get('x-tee-id');
  const teeOutputHash = paid.headers.get('x-tee-output-hash');
  const teeRequestHash = paid.headers.get('x-tee-request-hash');
  const txHash = teeOutputHash ? `${teeRequestHash}:${teeOutputHash}` : null;

  if (teeSignature) {
    console.log('[opengradient] TEE verified! id:', teeId?.slice(0, 16), 'output_hash:', teeOutputHash?.slice(0, 16));
  }

  const responseData = await paid.json();
  return { rawContent: responseData?.choices?.[0]?.message?.content ?? '', txHash };
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
      throw new Error('Missing or invalid required fields');
    }
    parsed = { ...raw, modelUsed: MODEL, analyzedAt: new Date().toISOString() } as VerdictResult;
  } catch {
    console.error('[opengradient] Failed to parse AI response:', rawContent.slice(0, 500));
    throw Object.assign(new Error('AI returned malformed JSON'), { code: 'AI_PARSE_ERROR' as const });
  }

  return { ...parsed, txHash };
}
