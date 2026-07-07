/**
 * Mask known API key / token patterns in a command so secrets are never
 * printed to the terminal. Only the prefix is shown; the secret body is
 * replaced with stars. Length-preserving where it matters (helps spot
 * truncated tokens) but the secret itself is unrecoverable.
 *
 * Covered patterns (in order, most specific first):
 *   github_pat_...          GitHub fine-grained PAT
 *   ghp_... gho_... ghs_... ghr_... ghu_...   GitHub classic tokens
 *   sk-ant-...              Anthropic API keys (3-char prefix after sk-)
 *   sk-... sk_...           OpenAI / other API keys
 *   hf_...                  Hugging Face token
 *   glpat-...               GitLab PAT
 *   dapi...                 Databricks token
 *   npm_...                 npm token
 *   AIza...                 Google API key
 *   xox[bpoa]-...           Slack tokens (bot, user, workspace, app-level)
 *   xoxs-...                Slack session token
 *   AKIA... ASIA...         AWS access key ids
 *   eyJ...                  JWT (base64-url starts with eyJ)
 *   Bearer <token>          Authorization header
 *   x-api-key: <token>      Generic API key header
 *
 * Anything else is left as-is. We intentionally err on the side of masking:
 * a false positive is a cosmetic annoyance, a missed secret is a leak.
 */

const PATTERNS: { re: RegExp; mask: string }[] = [
  // GitHub fine-grained PAT (github_pat_xxxxxxxx)
  { re: /\b(github_pat_[A-Za-z0-9_]{4})[A-Za-z0-9_]+/g, mask: "$1********" },
  // GitHub classic tokens (ghp_, gho_, ghu_, ghs_, ghr_)
  { re: /\b(gh[pousr]_[A-Za-z0-9]{4})[A-Za-z0-9]+/g, mask: "$1********" },
  // Anthropic API keys (sk-ant-... — note 3 chars after sk- before the hyphen)
  { re: /\b(sk-[A-Za-z0-9]{3,4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  // OpenAI-style keys (sk-xxxx...)
  { re: /\b(sk_[A-Za-z0-9]{4})[A-Za-z0-9_]+/g, mask: "$1********" },
  // Hugging Face token (hf_xxxxxxxx...)
  { re: /\b(hf_[A-Za-z0-9]{4})[A-Za-z0-9]+/g, mask: "$1********" },
  // GitLab Personal Access Token (glpat-xxxxxxxx)
  { re: /\b(glpat-[A-Za-z0-9]{4})[A-Za-z0-9]+/g, mask: "$1********" },
  // Databricks token (dapi0123456789...)
  { re: /\b(dapi[A-Za-z0-9]{4})[A-Za-z0-9]+/g, mask: "$1********" },
  // npm token (npm_xxxxxxxx...)
  { re: /\b(npm_[A-Za-z0-9]{4})[A-Za-z0-9]+/g, mask: "$1********" },
  // Google API key (39 chars after AIza)
  { re: /\b(AIza[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  // Slack tokens (xoxb-, xoxp-, xoxo-, xoxa-2, xoxs-)
  { re: /\b(xox[bpoa]2?-[-A-Za-z0-9]{4})[-A-Za-z0-9]+/g, mask: "$1********" },
  // Slack session token (xoxs-xxxxxxxx...)
  { re: /\b(xoxs[-A-Za-z0-9]{4})[-A-Za-z0-9]+/g, mask: "$1********" },
  // AWS access key id (AKIA + 16 chars, ASIA for STS temp creds)
  { re: /\b(AKIA[A-Z0-9]{4})[A-Z0-9]+/g, mask: "$1********" },
  { re: /\b(ASIA[A-Z0-9]{4})[A-Z0-9]+/g, mask: "$1********" },
  // JWT / JWS — base64url header starts with eyJ
  { re: /\b(eyJ[A-Za-z0-9_-]{4})[A-Za-z0-9_.-]+/g, mask: "$1********" },
  // Authorization: Bearer <token>
  { re: /(Bearer\s+)(["']?)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2$3********" },
  // x-api-key: <token>
  { re: /(x-api-key\s*[:=]\s*["']?)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },
  // Authorization header with any scheme — capture the actual credential after the scheme
  { re: /(Authorization\s*[:=]\s*)(?:Basic|Bearer|Digest|Token|OAuth)\s+([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1[hidden] $2********" },
];

export function maskSecrets(input: string): string {
  let out = input;
  for (const { re, mask } of PATTERNS) {
    out = out.replace(re, mask);
  }
  return out;
}
