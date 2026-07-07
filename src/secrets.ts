/**
 * Mask known API key / token patterns in a command so secrets are never
 * printed to the terminal. Only the prefix is shown; the secret body is
 * replaced with stars.
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
 *   xox[bpoa]-...           Slack tokens
 *   xoxs-...                Slack session token
 *   AKIA... ASIA...         AWS access key ids
 *   eyJ...                  JWT (base64-url starts with eyJ)
 *   Bearer <token>          Authorization header
 *   Authorization: <token>  Authorization header values
 *   x-api-key: <token>      Generic API key header
 *   key= / token= / secret= / apikey= / api_key= / password= / passwd=
 *   ask= / dgai= / api=      Common parameter-based credentials
 *   Stripe: whsec_, sk_live_, rk_live_, sk_test_, rk_test_
 *   DigitalOcean: dopx_
 *   Telegram: bot<digits>:
 *   Slack webhook URLs
 *
 * Anything else is left as-is. We intentionally err on the side of masking:
 * a false positive is a cosmetic annoyance, a missed secret is a leak.
 */

const PATTERNS: { re: RegExp; mask: string }[] = [
  // ── GitHub tokens ──────────────────────────────────────────────
  { re: /\b(github_pat_[A-Za-z0-9_]{4})[A-Za-z0-9_]+/g, mask: "$1********" },
  { re: /\b(gh[pousr]_[A-Za-z0-9]{4})[A-Za-z0-9]+/g, mask: "$1********" },

  // ── AI / ML platform keys ─────────────────────────────────────
  // Anthropic (sk-ant-...)
  { re: /\b(sk-[A-Za-z0-9]{3,4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  // OpenAI-style (sk-...)
  { re: /\b(sk_[A-Za-z0-9]{4})[A-Za-z0-9_]+/g, mask: "$1********" },
  // Hugging Face
  { re: /\b(hf_[A-Za-z0-9]{4})[A-Za-z0-9]+/g, mask: "$1********" },
  // Replicate
  { re: /\b(r8_[A-Za-z0-9]{4})[A-Za-z0-9_]+/g, mask: "$1********" },
  // Cohere
  { re: /\b(coy[A-Za-z0-9]{4})[A-Za-z0-9_]+/g, mask: "$1********" },

  // ── Git hosting tokens ────────────────────────────────────────
  // GitLab
  { re: /\b(glpat-[A-Za-z0-9]{4})[A-Za-z0-9]+/g, mask: "$1********" },
  // Bitbucket
  { re: /\b(BB[A-Za-z0-9]{4})[A-Za-z0-9]+/g, mask: "$1********" },

  // ── Cloud provider keys ───────────────────────────────────────
  // Databricks
  { re: /\b(dapi[A-Za-z0-9]{4})[A-Za-z0-9]+/g, mask: "$1********" },
  // Google API
  { re: /\b(AIza[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  // AWS
  { re: /\b(AKIA[A-Z0-9]{4})[A-Z0-9]+/g, mask: "$1********" },
  { re: /\b(ASIA[A-Z0-9]{4})[A-Z0-9]+/g, mask: "$1********" },
  // DigitalOcean
  { re: /\b(dopx_[A-Za-z0-9]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },

  // ── Stripe ────────────────────────────────────────────────────
  { re: /\b(whsec_[A-Za-z0-9]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  { re: /\b(sk_live_[A-Za-z0-9]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  { re: /\b(sk_test_[A-Za-z0-9]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  { re: /\b(rk_live_[A-Za-z0-9]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  { re: /\b(rk_test_[A-Za-z0-9]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },

  // ── Messaging / Slack ─────────────────────────────────────────
  { re: /\b(xox[bpoa]2?-[-A-Za-z0-9]{4})[-A-Za-z0-9]+/g, mask: "$1********" },
  { re: /\b(xoxs[-A-Za-z0-9]{4})[-A-Za-z0-9]+/g, mask: "$1********" },
  // Slack webhook URLs
  { re: /(hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/)[A-Za-z0-9]+/g, mask: "$1********" },
  // Telegram bot tokens
  { re: /\b(bot[0-9]{8,}:[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  // Discord bot tokens
  { re: /\b([A-Za-z0-9_-]{24,26}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,38})/g, mask: "$1********" },

  // ── Package registries ────────────────────────────────────────
  { re: /\b(npm_[A-Za-z0-9]{4})[A-Za-z0-9]+/g, mask: "$1********" },

  // ── JWT / JWS ────────────────────────────────────────────────
  { re: /\b(eyJ[A-Za-z0-9_-]{4})[A-Za-z0-9_.-]+/g, mask: "$1********" },

  // ── Authorization headers ─────────────────────────────────────
  // Bearer
  { re: /(Bearer\s+)(["']?)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2$3********" },
  // x-api-key
  { re: /(x-api-key\s*[:=]\s*["']?)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },
  // Authorization with scheme
  { re: /(Authorization\s*[:=]\s*)(?:Basic|Bearer|Digest|Token|OAuth)\s+(["']?)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1[hidden] $2$3********" },

  // ── URL query parameter credentials ───────────────────────────
  // Matches: ?key=xxx, &token=xxx, ?secret=xxx, ?apikey=xxx, ?api_key=xxx
  // Also: --api-key=xxx, --token=xxx CLI flags
  { re: /([?&]api[_-]?key\s*=\s*)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },
  { re: /([?&]token\s*=\s*)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },
  { re: /([?&]secret\s*=\s*)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },
  { re: /([?&]key\s*=\s*)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },
  { re: /([?&]pass(?:word)?\s*=\s*)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },
  { re: /([?&]ask\s*=\s*)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },
  { re: /([?&]dgai\s*=\s*)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },

  // ── CLI flag credentials ──────────────────────────────────────
  { re: /(\s--(?:api[_-]?key|token|secret|password|passwd|ask|dgai)\s+)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },
];

export function maskSecrets(input: string): string {
  let out = input;
  for (const { re, mask } of PATTERNS) {
    out = out.replace(re, mask);
  }
  return out;
}
