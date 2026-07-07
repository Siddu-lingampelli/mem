import type { HistoryEntry, SearchHit } from "./types.js";

export const ALL_KEYWORDS = ["all", "*", "everything"];

const SELF_PREFIXES = ["mem ", "mem search ", "mem stats ", "mem sync ", "mem index "];
const EXACT_NOISE = new Set(["mem", "history", "clear", "cls", "exit"]);

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

/** Bounded Levenshtein: length-gap exit + two-row DP + row-min exit. */
function levenshteinBounded(a: string, b: string, maxDist = 2): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  if (a.length > b.length) { const t = a; a = b; b = t; }
  const m = a.length;
  if (m === 0) return b.length > maxDist ? maxDist + 1 : b.length;
  const prev = new Array(m + 1);
  const curr = new Array(m + 1);
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
    const existing = seen.get(cmd);
    if (existing) { existing.count++; }
    else { seen.set(cmd, { command: cmd, tokens: tokenise(cmd), count: 1, index: i }); }
  }
  const result: CachedEntry[] = [];
  for (const e of seen.values()) { if (!isNoise(e.command)) result.push(e); }
  return result.sort((a, b) => a.index - b.index);
}

/** Build token → entry-idx index for fast candidate lookup. */
function buildTokenIndex(cached: CachedEntry[]): Map<string, number[]> {
  const idx = new Map<string, number[]>();
  for (let i = 0; i < cached.length; i++) {
    for (const tok of cached[i].tokens) {
      if (tok.length < 2) continue;
      let list = idx.get(tok);
      if (!list) { list = []; idx.set(tok, list); }
      list.push(i);
    }
  }
  return idx;
}

/** Score command tokens against query words (0=perfect, 1=none). */
function scoreCmd(tokens: string[], queryWords: string[]): number {
  let total = 0;
  for (const qw of queryWords) {
    if (qw.length < 2) { continue; }
    if (tokens.includes(qw)) { continue; }
    let best = 1;
    for (const tok of tokens) {
      if (tok.length < 2) continue;
      if (best > 0.12 && qw.length >= 4) {
        const d = levenshteinBounded(qw, tok, 2);
        if (d === 0) { best = 0; break; }
        if (d <= 1) best = 0.05;
        if (d <= 2 && best > 0.12) best = 0.12;
      }
      if (best > 0.12 && tok.startsWith(qw)) { best = 0.15; }
      if (best > 0.1 && qw.startsWith(tok)) { best = 0.1; }
      if (best > 0.1 && tok.length >= 3 && tok.includes(qw)) { best = 0.25; }
      if (best <= 0.1) break;
    }
    total += best;
  }
  return total / queryWords.length;
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
): SearchHit[] {
  const normalized = query.trim();

  if (normalized.length === 0 || ALL_KEYWORDS.includes(normalized.toLowerCase())) {
    const rc = Math.floor(totalEntryCount * 0.25);
    return cached.map(e => ({ command: e.command, score: 1, count: e.count, recent: e.index < rc }));
  }

  const queryWords = tokenise(normalized);
  if (queryWords.length === 0) {
    const rc = Math.floor(totalEntryCount * 0.25);
    return cached.map(e => ({ command: e.command, score: 1, count: e.count, recent: e.index < rc }));
  }

  // Build token index and find candidate entry indices
  const tokenIndex = buildTokenIndex(cached);
  const candidates = new Set<number>();

  for (const qw of queryWords) {
    if (qw.length < 2) continue;
    const exact = tokenIndex.get(qw);
    if (exact) { for (const idx of exact) candidates.add(idx); }
    for (const [tok, indices] of tokenIndex) {
      if (tok === qw) continue;
      if (tok.startsWith(qw) || qw.startsWith(tok) || (qw.length >= 3 && tok.includes(qw))) {
        for (const idx of indices) candidates.add(idx);
      }
    }
  }

  // Command-level fallback (startsWith/includes on full command)
  for (let i = 0; i < cached.length; i++) {
    if (candidates.has(i)) continue;
    const lower = cached[i].command.toLowerCase();
    for (const qw of queryWords) {
      if (qw.length >= 2 && (lower.startsWith(qw) || (qw.length >= 3 && lower.includes(qw)))) {
        candidates.add(i);
        break;
      }
    }
  }

  const rc = Math.floor(totalEntryCount * 0.25);
  const scored: SearchHit[] = [];

  for (const idx of candidates) {
    const e = cached[idx];
    const score = scoreCmd(e.tokens, queryWords);
    if (score < 0.4) {
      scored.push({ command: e.command, score, count: e.count, recent: e.index < rc });
    }
  }

  // Fallback: score all (catches fuzzy-only matches like "dcoker")
  if (scored.length === 0) {
    for (const e of cached) {
      const score = scoreCmd(e.tokens, queryWords);
      if (score < 0.4) {
        scored.push({ command: e.command, score, count: e.count, recent: e.index < rc });
      }
    }
  }

  scored.sort((a, b) => {
    const d = a.score - b.score;
    if (Math.abs(d) > 0.01) return d;
    const cd = b.count - a.count;
    if (cd !== 0) return cd;
    return a.command.localeCompare(b.command);
  });

  return scored;
}

/** Convenience wrapper: preprocess + searchCached in one call. */
export function search(entries: HistoryEntry[], query: string): SearchHit[] {
  return searchCached(preprocess(entries), entries.length, query);
}
