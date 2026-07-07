import type { HistoryEntry, SearchHit } from "./types.js";

export const ALL_KEYWORDS = ["all", "*", "everything"];

/** Commands starting with these prefixes are ignored (self-pollution). */
const SELF_PREFIXES = ["mem ", "mem search ", "mem stats ", "mem sync ", "mem index "];

/** Exact commands that are noise. */
const EXACT_NOISE = new Set(["mem", "history", "clear", "cls", "exit"]);

/** Return true when a command should never appear in results. */
function isNoise(cmd: string): boolean {
  const c = cmd.trim().toLowerCase();
  for (const p of SELF_PREFIXES) {
    if (c.startsWith(p)) return true;
  }
  if (EXACT_NOISE.has(c)) return true;
  if (c.length <= 1) return true;
  if (/^[^a-z0-9]+$/.test(c)) return true;
  return false;
}

/** Tokenise into lower-case alphanumeric tokens, skipping single-char tokens. */
function tokenise(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** Levenshtein distance for fuzzy matching. */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

/**
 * Score a command (0 = perfect, 1 = no match).
 */
function scoreCmd(command: string, queryWords: string[]): number {
  const lower = command.toLowerCase();
  const tokens = tokenise(lower);
  let totalPenalty = 0;

  for (const qw of queryWords) {
    // Single-char query words can't discriminately match anything.
    if (qw.length < 2) { totalPenalty += 0; continue; }

    // Exact token match → best.
    if (tokens.includes(qw)) { totalPenalty += 0; continue; }

    let best = 1;

    // Fuzzy (Levenshtein) — catch "dcoker" → "docker" (dist 1-2)
    // Skip for short query words (<4 chars) to avoid false positives like "api" → "app"
    for (const tok of tokens) {
      if (tok.length < 2 || qw.length < 4) continue;
      const dist = levenshtein(qw, tok);
      if (dist === 0) { best = 0; break; }
      if (dist === 1) best = Math.min(best, 0.05);
      if (dist === 2) best = Math.min(best, 0.12);
    }

    // Token prefix: query word is a prefix of a token  ("com" → "compose")
    if (best > 0.12) {
      for (const tok of tokens) {
        if (tok.length >= 2 && tok.startsWith(qw)) {
          best = Math.min(best, 0.15);
        }
      }
    }

    // Query prefix: token is a prefix of query word  ("doc" → "docker")
    if (best > 0.1) {
      for (const tok of tokens) {
        if (tok.length >= 2 && qw.startsWith(tok)) {
          best = Math.min(best, 0.1);
        }
      }
    }

    // Substring inside a token  ("ai" in "clAIude") — only if token length > 2
    if (best > 0.1) {
      for (const tok of tokens) {
        if (tok.length >= 3 && tok.includes(qw)) {
          best = Math.min(best, 0.25);
        }
      }
    }

    // Command starts with query word
    if (best > 0.35 && lower.startsWith(qw)) {
      best = Math.min(best, 0.35);
    }

    // Substring anywhere in full command (only for longer queries)
    if (best > 0.5 && qw.length >= 3 && lower.includes(qw)) {
      best = Math.min(best, 0.5);
    }

    totalPenalty += best;
  }

  return Math.min(totalPenalty / queryWords.length, 1);
}

function dedupeWithCounts(entries: HistoryEntry[]): SearchHit[] {
  const seen = new Map<string, { count: number; index: number }>();
  const total = entries.length;

  for (let i = 0; i < entries.length; i++) {
    const cmd = entries[i].command;
    const existing = seen.get(cmd);
    if (existing) existing.count++;
    else seen.set(cmd, { count: 1, index: i });
  }

  const recentCutoff = Math.floor(total * 0.25);
  const hits: SearchHit[] = [];
  for (const [command, meta] of seen) {
    hits.push({ command, score: 1, count: meta.count, recent: meta.index < recentCutoff });
  }

  return hits.sort((a, b) => {
    const aIdx = seen.get(a.command)!.index;
    const bIdx = seen.get(b.command)!.index;
    return aIdx - bIdx;
  });
}

export function search(entries: HistoryEntry[], query: string): SearchHit[] {
  const normalized = query.trim();

  const all = dedupeWithCounts(entries).filter((h) => !isNoise(h.command));

  if (normalized.length === 0 || ALL_KEYWORDS.includes(normalized.toLowerCase())) {
    return all;
  }

  const queryWords = tokenise(normalized);
  if (queryWords.length === 0) return all;

  const scored = all.map((h) => ({ ...h, score: scoreCmd(h.command, queryWords) }));

  // Filter: strict threshold
  const filtered = scored.filter((h) => h.score < 0.4);

  // Sort: score → frequency → recency → alphabetical
  filtered.sort((a, b) => {
    const d = a.score - b.score;
    if (Math.abs(d) > 0.01) return d;
    const cd = b.count - a.count;
    if (cd !== 0) return cd;
    return a.command.localeCompare(b.command);
  });

  return filtered;
}
