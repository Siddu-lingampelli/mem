import type { HistoryEntry, SearchHit } from "./types.js";

const ALL_KEYWORDS = ["all", "*", "everything"];

/**
 * Tokenise a command into lower-case alphanumeric tokens.
 */
function tokenise(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Compute a simple relevance score (0 = perfect, 1 = no match).
 * Token-aware: the query "com" will rank "docker compose" higher than
 * "Get-Command" because the token match is longer relative to the token
 * and appears after a word boundary, but still works for substring hits.
 */
function scoreCmd(command: string, queryWords: string[]): number {
  const lower = command.toLowerCase();
  const tokens = tokenise(command);
  let totalPenalty = 0;

  for (const qw of queryWords) {
    // Try exact token match first (fuzzy already caught by Fuse earlier)
    let best = 1;

    // 1) Full token match
    for (const tok of tokens) {
      if (tok === qw) { best = Math.min(best, 0); break; }
    }

    // 2) Token starts with query word  (com → compose: 0.15)
    if (best > 0) {
      for (const tok of tokens) {
        if (tok.startsWith(qw) && tok.length > qw.length) {
          best = Math.min(best, 0.15);
        }
      }
    }

    // 3) Query word starts with token (doc → docker: 0.25)
    if (best > 0) {
      for (const tok of tokens) {
        if (qw.startsWith(tok) && qw.length > tok.length) {
          best = Math.min(best, 0.25);
        }
      }
    }

    // 4) Substring inside any token  (ai → claude: 0.45)
    if (best > 0) {
      for (const tok of tokens) {
        if (tok.includes(qw)) {
          best = Math.min(best, 0.45);
        }
      }
    }

    // 5) Substring anywhere in command (weak)
    if (best > 0 && lower.includes(qw)) {
      best = Math.min(best, 0.6);
    }

    totalPenalty += best;
  }

  return totalPenalty / queryWords.length;
}

/**
 * Deduplicate identical commands and collect stats.
 * Returns entries unique by command, newest first, with count and recency.
 */
function dedupeWithCounts(entries: HistoryEntry[]): SearchHit[] {
  const seen = new Map<string, { count: number; index: number; firstIndex: number }>();
  const total = entries.length;

  // Count and track positions — first occurrence wins for newest ordering
  for (let i = 0; i < entries.length; i++) {
    const cmd = entries[i].command;
    const existing = seen.get(cmd);
    if (existing) {
      existing.count++;
    } else {
      seen.set(cmd, { count: 1, index: i, firstIndex: i });
    }
  }

  const recentCutoff = Math.floor(total * 0.25);
  const hits: SearchHit[] = [];
  for (const [command, meta] of seen) {
    hits.push({
      command,
      score: 1,
      count: meta.count,
      recent: meta.index <= recentCutoff,
    });
  }

  // Sort by first occurrence (newest first since entries are newest-first)
  return hits.sort((a, b) => {
    const aIdx = seen.get(a.command)!.index;
    const bIdx = seen.get(b.command)!.index;
    return aIdx - bIdx;
  });
}

export function search(entries: HistoryEntry[], query: string): SearchHit[] {
  const normalized = query.trim();

  // "all" / empty → show every unique command (deduped, newest-first, with counts)
  if (normalized.length === 0 || ALL_KEYWORDS.includes(normalized.toLowerCase())) {
    return dedupeWithCounts(entries).map((h) => ({ ...h, score: 1 }));
  }

  const queryWords = tokenise(normalized);
  if (queryWords.length === 0) {
    return dedupeWithCounts(entries).map((h) => ({ ...h, score: 1 }));
  }

  // Score each unique command
  const deduped = dedupeWithCounts(entries);
  const scored = deduped.map((h) => ({
    ...h,
    score: scoreCmd(h.command, queryWords),
  }));

  // Filter: keep score < 0.7 (catch substring / token-prefix matches but reject noise)
  const filtered = scored.filter((h) => h.score < 0.7);

  // Sort by score (lower = better), then by count (more frequent first), then by recency
  filtered.sort((a, b) => {
    const d = a.score - b.score;
    if (Math.abs(d) > 0.01) return d;
    const cd = b.count - a.count;
    if (cd !== 0) return cd;
    return a.command.localeCompare(b.command);
  });

  return filtered;
}
