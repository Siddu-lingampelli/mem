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
  // Real fine-grained PATs are 80+ chars; classic PATs 40+. Body
  // `{12,}` after the 4-char visible prefix rejects short identifiers
  // like `ghs_abc123def456ghi789` (24 chars total, body 12 chars would
  // just barely match — kept here as the trade-off).
  { re: /\b(github_pat_[A-Za-z0-9_]{4})[A-Za-z0-9_]{12,}/g, mask: "$1********" },
  { re: /\b(gh[pousr]_[A-Za-z0-9]{4})[A-Za-z0-9]{12,}/g, mask: "$1********" },

  // ── Stripe ────────────────────────────────────────────────────
  // Real Stripe keys are 100+ chars; minimum body length 24 enforces it.
  { re: /\b(whsec_)[A-Za-z0-9_-]{24,}/g, mask: "$1********" },
  { re: /\b(sk_live_)[A-Za-z0-9_-]{24,}/g, mask: "$1********" },
  { re: /\b(sk_test_)[A-Za-z0-9_-]{24,}/g, mask: "$1********" },
  { re: /\b(rk_live_)[A-Za-z0-9_-]{24,}/g, mask: "$1********" },
  { re: /\b(rk_test_)[A-Za-z0-9_-]{24,}/g, mask: "$1********" },

  // ── AI / ML platform keys ─────────────────────────────────────
  // Anthropic sk-ant- keys are 90+ chars; total body ≥18 rejects
  // short identifiers like `sk-protocol` (13 chars total).
  { re: /\b(sk-ant-)[A-Za-z0-9_-]{18,}/g, mask: "$1********" },
  // Generic sk- keys (OpenAI and others)
  { re: /\b(sk-)[A-Za-z0-9_-]{20,}/g, mask: "$1********" },
  // Hugging Face
  { re: /\b(hf_[A-Za-z0-9]{4})[A-Za-z0-9]{16,}/g, mask: "$1********" },
  // Replicate
  { re: /\b(r8_[A-Za-z0-9]{4})[A-Za-z0-9_]{16,}/g, mask: "$1********" },
  // Cohere
  { re: /\b(coy[A-Za-z0-9]{4})[A-Za-z0-9_]{16,}/g, mask: "$1********" },
  // OpenAI-style (sk_...) — must be after Stripe so sk_live_/sk_test_ match first
  { re: /\b(sk_)[A-Za-z0-9_]{24,}/g, mask: "$1********" },

  // ── Git hosting tokens ────────────────────────────────────────
  // GitLab PATs are 26+ chars; body {20,} avoids false-matches.
  { re: /\b(glpat-)[A-Za-z0-9]{20,}/g, mask: "$1********" },
  // Bitbucket — fixed structure
  { re: /\b(BB[A-Za-z0-9]{4})[A-Za-z0-9]{28}\b/g, mask: "$1********" },

  // ── Cloud provider keys ───────────────────────────────────────
  // Databricks
  { re: /\b(dapi[A-Za-z0-9]{4})[A-Za-z0-9]{16,}/g, mask: "$1********" },
  // Google API
  { re: /\b(AIza[A-Za-z0-9_-]{4})[A-Za-z0-9_-]{16,}/g, mask: "$1********" },
  // AWS access key IDs — fixed length
  { re: /\b(AKIA[A-Z0-9]{4})[A-Z0-9]{12}\b/g, mask: "$1********" },
  { re: /\b(ASIA[A-Z0-9]{4})[A-Z0-9]{12}\b/g, mask: "$1********" },
  // DigitalOcean
  { re: /\b(dopx_[A-Za-z0-9]{4})[A-Za-z0-9_-]{12,}/g, mask: "$1********" },

  // ── Messaging / Slack ─────────────────────────────────────────
  // Slack tokens are 30+ chars after the xoxb-/xoxa- prefix.
  { re: /\b(xox[bpoa]2?-[-A-Za-z0-9]{4})[-A-Za-z0-9]{12,}/g, mask: "$1********" },
  { re: /\b(xoxs[-A-Za-z0-9]{4})[-A-Za-z0-9]{16,}/g, mask: "$1********" },
  // Slack webhook URLs — fixed structure
  {
    re: /(hooks\.slack\.com\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/)[A-Za-z0-9]+/g,
    mask: "$1********",
  },
  // Telegram bot tokens — real tokens ≥ 35 chars total
  { re: /\b(bot[0-9]{8,}:[A-Za-z0-9_-]{4})[A-Za-z0-9_-]{16,}/g, mask: "$1********" },
  // Discord bot tokens (format: <id-base64>.<timestamp-base64>.<hmac>).
  // Both the id-segment (17-30 chars) and the total length of the third
  // segment (which the hmac lives in) are bounded. The HMAC segment is
  // 27-40 chars long in real Discord tokens; the lower bound rejects
  // version-string-style commands like `git checkout <sha>.<sha>.<sha>`
  // which used to false-positive against the looser pattern.
  {
    re: /\b([A-Za-z0-9_-]{17,30})\.([A-Za-z0-9_-]{6})\.([A-Za-z0-9_-]{4})[A-Za-z0-9_-]{23,36}\b/g,
    mask: "$1.$2.$3********",
  },

  // ── Package registries ────────────────────────────────────────
  // npm tokens are typically 40+ chars total.
  { re: /\b(npm_[A-Za-z0-9]{4})[A-Za-z0-9]{16,}/g, mask: "$1********" },

  // ── Hosting / deployment platforms ────────────────────────────
  // Only patterns with unique prefixes are added. Bare-length patterns
  // (40-char hex, 32-char alnum) would false-positive on every git SHA
  // and package hash in shell output. Use prefixed patterns instead and
  // document that tokens pasted without a recognisable prefix cannot be
  // reliably masked.
  // Vercel
  { re: /\b(vercel_[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  // Linear API key
  { re: /\b(lin_api_[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  // PlanetScale
  { re: /\b(pscale_tkn_[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  // Cloudflare API token (literal "Cloudflare" or "cf-" prefix in headers/CLI)
  { re: /\b(cf[-_][A-Za-z0-9]{32,40})\b/g, mask: "$1********" },
  // Heroku API key (UUID format used as password in `heroku auth:token`)
  // — masked when paired with explicit "heroku" command context.
  {
    re: /(heroku\s+(?:auth|password|api[_-]?key)\s+["']?)([a-f0-9-]{36})/gi,
    mask: "$1$2********",
  },
  // Twilio Account SID / Auth Token (SK prefix for Auth Token)
  { re: /\b(SK[a-f0-9]{32})\b/g, mask: "$1********" },

  // ── Cloud / data ──────────────────────────────────────────────
  // AWS secret access key — only masked when the user types it as
  // `aws_secret_access_key <value>` or `AWS_SECRET_ACCESS_KEY=<value>`.
  // Bare 40-char base64 strings are too ambiguous (false-positive risk).
  {
    re: /(aws_secret_access_key\s*=?\s*["']?)([A-Za-z0-9/+=]{40})/gi,
    mask: "$1$2********",
  },
  {
    re: /(AWS_SECRET_ACCESS_KEY\s*=\s*["']?)([A-Za-z0-9/+=]{40})\b/g,
    mask: "$1$2********",
  },

  // ── JWT / JWS ────────────────────────────────────────────────
  // Real JWTs are 100+ chars (header.payload.signature). Require ≥30 chars
  // of body so short placeholders in docs (`eyJhbGciOi...`) don't mask.
  { re: /\b(eyJ[A-Za-z0-9_-]{4})[A-Za-z0-9_.-]{30,}/g, mask: "$1********" },

  // ── Authorization headers ─────────────────────────────────────
  // Bearer — body must be ≥24 chars to avoid masking "Bearer foo" in tests
  { re: /(Bearer\s+)(["']?)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]{20,}/gi, mask: "$1$2$3********" },
  // x-api-key
  {
    re: /(x-api-key\s*[:=]\s*["']?)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]{12,}/gi,
    mask: "$1$2********",
  },
  // Authorization with scheme
  {
    re: /(Authorization\s*[:=]\s*)(?:Basic|Bearer|Digest|Token|OAuth)\s+(["']?)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]{20,}/gi,
    mask: "$1[hidden] $2$3********",
  },

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
  {
    re: /(\s--(?:api[_-]?key|token|secret|password|passwd|ask|dgai)\s+)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi,
    mask: "$1$2********",
  },
];

export function maskSecrets(input: string): string {
  let out = input;
  for (const { re, mask } of PATTERNS) {
    out = out.replace(re, mask);
  }
  return out;
}
