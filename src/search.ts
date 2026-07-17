import type { HistoryEntry, SearchHit, MatchCategory } from "./types.js";

export const ALL_KEYWORDS = ["all", "*", "everything"];

const SELF_PREFIXES = ["mem ", "mem search ", "mem stats ", "mem sync ", "mem index "];
const EXACT_NOISE = new Set(["mem", "history", "clear", "cls", "exit"]);

/** Scoring constants — penalty values (lower=better) */
const PENALTY = {
  FUZZY_DIST1: 0.05,
  FUZZY_DIST2: 0.12,
  TOKEN_PREFIX: 0.15,
  QUERY_PREFIX: 0.1,
  TOKEN_SUBSTR: 0.25,
  CMD_PREFIX: 0.35,
  CMD_GLOBAL: 0.5,
  THRESHOLD: 0.4,
  SORT_EPSILON: 0.01,
} as const;

/** Derive a display category from the aggregate score. */
function matchCategory(score: number): MatchCategory {
  if (score === 0) return "exact";
  if (score <= PENALTY.FUZZY_DIST2) return "fuzzy";
  return "similar";
}

function isNoise(cmd: string): boolean {
  const c = cmd.trim().toLowerCase();
  for (const p of SELF_PREFIXES) { if (c.startsWith(p)) return true; }
  if (EXACT_NOISE.has(c)) return true;
  if (c.length <= 1) return true;
  if (/^[^a-z0-9]+$/.test(c)) return true;
  return false;
}

function tokenise(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Bounded Levenshtein: length-gap exit + two-row DP + row-min exit.
 * Uses pre-allocated buffers sized for any reasonable command token (≤64 chars).
 */
const _levBufSize = 64;
const _levPrev = new Array(_levBufSize);
const _levCurr = new Array(_levBufSize);

function levenshteinBounded(a: string, b: string, maxDist = 2): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  if (a.length > b.length) { const t = a; a = b; b = t; }
  const m = a.length;
  if (m === 0) return b.length > maxDist ? maxDist + 1 : b.length;

  const usingPool = m < _levBufSize;
  const prev = usingPool ? _levPrev : new Array(m + 1);
  const curr = usingPool ? _levCurr : new Array(m + 1);
  for (let i = 0; i <= m; i++) prev[i] = i;

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    let rowMin = j;
    for (let i = 1; i <= m; i++) {
      const v = a[i - 1] === b[j - 1]
        ? prev[i - 1]
        : 1 + Math.min(prev[i], curr[i - 1], prev[i - 1]);
      curr[i] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > maxDist) return maxDist + 1;
    for (let i = 0; i <= m; i++) prev[i] = curr[i];
  }
  return prev[m];
}

/** Pre-tokenised entry with usage info. */
export interface CachedEntry {
  command: string;
  /** Lowercased full command (cached for scoring). */
  commandLower: string;
  tokens: string[];
  count: number;
  index: number;
}

/**
 * Preprocess history entries: dedupe, tokenise, filter noise, sort.
 * Do this ONCE when entries don't change, then call searchCached().
 */
export function preprocess(entries: HistoryEntry[]): CachedEntry[] {
  const seen = new Map<string, CachedEntry>();
  for (let i = 0; i < entries.length; i++) {
    const cmd = entries[i].command;
    const key = cmd.toLowerCase(); // case-insensitive dedup
    const existing = seen.get(key);
    if (existing) { existing.count++; }
    else {
      seen.set(key, {
        command: cmd,
        commandLower: key,
        tokens: tokenise(cmd),
        count: 1,
        index: i,
      });
    }
  }
  const result: CachedEntry[] = [];
  for (const e of seen.values()) { if (!isNoise(e.command)) result.push(e); }
  return result.sort((a, b) => a.index - b.index);
}

/** Score command tokens against query words (0=perfect, 1=none). */
function scoreCmd(commandLower: string, tokens: string[], queryWords: string[]): number {
  let total = 0;
  for (const qw of queryWords) {
    if (qw.length < 2) { continue; }

    let best = 1;

    // Single pass over tokens — uses Math.min so better scores never overwritten
    for (const tok of tokens) {
      if (tok.length < 2) continue;

      if (tok === qw) { best = 0; break; }

      // Substring inside a token: "ai" in "claim" (weakest, check first)
      if (qw.length <= tok.length && tok.length >= 3 && tok.includes(qw)) best = Math.min(best, PENALTY.TOKEN_SUBSTR);

      // Token prefix: "com" → "compose"
      if (tok.startsWith(qw)) best = Math.min(best, PENALTY.TOKEN_PREFIX);

      // Fuzzy Levenshtein (only for 4+ char query words)
      if (qw.length >= 4) {
        const d = levenshteinBounded(qw, tok, 2);
        if (d <= 1) best = Math.min(best, PENALTY.FUZZY_DIST1);
        else if (d <= 2) best = Math.min(best, PENALTY.FUZZY_DIST2);
      }

      // Query prefix: "doc" → "docker" (strongest token check)
      if (qw.startsWith(tok)) best = Math.min(best, PENALTY.QUERY_PREFIX);

      if (best <= PENALTY.QUERY_PREFIX) break;
    }

    // Command-level fallbacks (full command string)
    if (commandLower.startsWith(qw)) best = Math.min(best, PENALTY.CMD_PREFIX);
    if (qw.length >= 3 && commandLower.includes(qw)) best = Math.min(best, PENALTY.CMD_GLOBAL);

    total += best;
  }
  return total / queryWords.length;
}

/** Build all-entries-as-hits for empty / all-keyword queries. */
function allAsHits(cached: CachedEntry[], rc: number): SearchHit[] {
  return cached.map(e => ({ command: e.command, score: 1, category: "exact" as const, count: e.count, recent: e.index < rc }));
}

/**
 * Score and rank pre-processed entries against a query.
 * Prefer preprocess() + searchCached() over search() when searching
 * multiple queries against the same entry set.
 */
export function searchCached(
  cached: CachedEntry[],
  totalEntryCount: number,
  query: string,
  topN?: number,
): SearchHit[] {
  const normalized = query.trim();
  const rc = Math.max(1, Math.floor(totalEntryCount * 0.25));

  // Empty / "all" keyword → return everything
  if (normalized.length === 0 || ALL_KEYWORDS.includes(normalized.toLowerCase())) {
    return allAsHits(cached, rc);
  }

  const queryWords = tokenise(normalized);
  if (queryWords.length === 0) {
    return allAsHits(cached, rc);
  }

  // Single pass: score every entry, collect those below threshold
  const scored: SearchHit[] = [];
  for (const entry of cached) {
    const score = scoreCmd(entry.commandLower, entry.tokens, queryWords);
    if (score < PENALTY.THRESHOLD) {
      scored.push({ command: entry.command, score, category: matchCategory(score), count: entry.count, recent: entry.index < rc });
    }
  }

  // Sort: score (epsilon) → frequency → alphabetical
  scored.sort((a, b) => {
    const d = a.score - b.score;
    if (Math.abs(d) > PENALTY.SORT_EPSILON) return d;
    const cd = b.count - a.count;
    if (cd !== 0) return cd;
    return a.command.localeCompare(b.command);
  });

  if (topN !== undefined) scored.length = Math.min(scored.length, topN);
  return scored;
}

/** Convenience wrapper: preprocess + searchCached in one call. */
export function search(entries: HistoryEntry[], query: string, topN?: number): SearchHit[] {
  return searchCached(preprocess(entries), entries.length, query, topN);
}
