/**
 * Mask known API key / token patterns in a command so secrets are never
 * printed to the terminal. Only the prefix is shown; the secret body is
 * replaced with stars. Length-preserving where it matters (helps spot
 * truncated tokens) but the secret itself is unrecoverable.
 *
 * Covered patterns:
 *   github_pat_...        GitHub fine-grained PAT
 *   ghp_... gho_... ghs_... ghr_... ghu_...   GitHub classic tokens
 *   sk-...  sk_...        OpenAI / Anthropic-style keys
 *   AIza...               Google API key
 *   xox[bpo]-...          Slack tokens
 *   AKIA...               AWS access key id
 *   eyJ...                JWT (JWS) — base64-url starts with eyJ
 *   Bearer <token>        Authorization header
 *   x-api-key: <token>    Generic API key header
 *
 * Anything else is left as-is. We intentionally err on the side of masking:
 * a false positive is a cosmetic annoyance, a missed secret is a leak.
 */

const PATTERNS: { re: RegExp; mask: string }[] = [
  // GitHub tokens — keep the 4-char prefix, mask the rest.
  { re: /\b(github_pat_[A-Za-z0-9_]{4})[A-Za-z0-9_]+/g, mask: "$1********" },
  { re: /\b(gh[pousr]_[A-Za-z0-9]{4})[A-Za-z0-9]+/g, mask: "$1********" },
  // OpenAI / Anthropic-style keys.
  { re: /\b(sk-[A-Za-z0-9]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  { re: /\b(sk_[A-Za-z0-9]{4})[A-Za-z0-9_]+/g, mask: "$1********" },
  // Google API key (39 chars after AIza).
  { re: /\b(AIza[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+/g, mask: "$1********" },
  // Slack tokens.
  { re: /\b(xox[bpo]-[A-Za-z0-9-]{4})[A-Za-z0-9-]+/g, mask: "$1********" },
  // AWS access key id (20 chars after AKIA).
  { re: /\b(AKIA[A-Z0-9]{4})[A-Z0-9]+/g, mask: "$1********" },
  // JWT / JWS — base64url header starts with eyJ.
  { re: /\b(eyJ[A-Za-z0-9_-]{4})[A-Za-z0-9_.-]+/g, mask: "$1********" },
  // Authorization: Bearer <token>
  { re: /(Bearer\s+)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },
  // x-api-key: <token>
  { re: /(x-api-key\s*[:=]\s*"?)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },
  // Generic quoted Authorization header value.
  { re: /(Authorization\s*[:=]\s*"?\s*)([A-Za-z0-9_.-]{4})[A-Za-z0-9_.-]+/gi, mask: "$1$2********" },
];

export function maskSecrets(input: string): string {
  let out = input;
  for (const { re, mask } of PATTERNS) {
    out = out.replace(re, mask);
  }
  return out;
}
