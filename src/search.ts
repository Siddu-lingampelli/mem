import type { HistoryEntry, SearchHit } from "./types.js";

const ALL_KEYWORDS = ["all", "*", "everything"];

/** Commands mem itself produces — never return as search results. */
const SELF_CMDS = new Set(["mem", "mem search", "mem stats", "mem sync", "mem index"]);

/** Return true when a command is noise that should never appear in results. */
function isNoise(cmd: string): boolean {
  const c = cmd.trim().toLowerCase();
  if (SELF_CMDS.has(c)) return true;
  // Single char or pure punctuation
  if (c.length <= 1) return true;
  if (/^[^a-z0-9]+$/.test(c)) return true;
  return false;
}

/** Tokenise a command into lower-case alphanumeric tokens. */
function tokenise(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Score a command for a set of query words (0 = perfect, 1 = no match).
 *
 * Scoring hierarchy (per query word):
 *   0.00  exact token match ("git" in "git status")
 *   0.10  token is a prefix of query word ("doc" → "docker")
 *   0.15  query word is a prefix of token ("com" → "compose")
 *   0.25  token contains query word as substring ("ai" → "clAIude")
 *   0.35  query word matches command start ("get" → "Get-ChildItem")
 *   0.50  query word appears anywhere in the command string
 *   1.00  no match at all
 *
 * The final score is the average across all query words, clipped to [0, 1].
 */
function scoreCmd(command: string, queryWords: string[]): number {
  const lower = command.toLowerCase();
  const tokens = tokenise(lower);
  let totalPenalty = 0;

  for (const qw of queryWords) {
    // If any token exactly equals the query word → best possible.
    if (tokens.includes(qw)) {
      totalPenalty += 0;
      continue;
    }

    let best = 1;

    // Token prefix match: query word is a prefix of a token  ("com" → "compose")
    for (const tok of tokens) {
      if (tok.startsWith(qw) && qw.length >= 2) {
        best = Math.min(best, 0.15);
      }
    }

    // Query prefix match: token is a prefix of query word  ("doc" → "docker")
    if (best > 0.15) {
      for (const tok of tokens) {
        if (qw.startsWith(tok) && tok.length >= 2) {
          best = Math.min(best, 0.1);
        }
      }
    }

    // Substring inside a token  ("ai" in "clAIude")
    if (best > 0.15) {
      for (const tok of tokens) {
        if (tok.includes(qw) && qw.length >= 2) {
          best = Math.min(best, 0.25);
        }
      }
    }

    // Command starts with query word  ("get" → "Get-ChildItem")
    if (best > 0.35 && lower.startsWith(qw)) {
      best = Math.min(best, 0.35);
    }

    // Substring anywhere in full command
    if (best > 0.5 && lower.includes(qw)) {
      best = Math.min(best, 0.5);
    }

    totalPenalty += best;
  }

  return Math.min(totalPenalty / queryWords.length, 1);
}

/**
 * Deduplicate identical commands and collect stats.
 * Returns unique commands (newest first) with count and recency.
 */
function dedupeWithCounts(entries: HistoryEntry[]): SearchHit[] {
  const seen = new Map<string, { count: number; index: number }>();
  const total = entries.length;

  for (let i = 0; i < entries.length; i++) {
    const cmd = entries[i].command;
    const existing = seen.get(cmd);
    if (existing) {
      existing.count++;
    } else {
      seen.set(cmd, { count: 1, index: i });
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

  return hits.sort((a, b) => {
    const aIdx = seen.get(a.command)!.index;
    const bIdx = seen.get(b.command)!.index;
    return aIdx - bIdx;
  });
}

/**
 * Search history entries.
 *
 * - Empty / "all" → every unique command (deduped, newest-first, with counts)
 * - Otherwise → token-aware fuzzy search with strict relevance filtering
 */
export function search(entries: HistoryEntry[], query: string): SearchHit[] {
  const normalized = query.trim();

  if (normalized.length === 0 || ALL_KEYWORDS.includes(normalized.toLowerCase())) {
    return dedupeWithCounts(entries).filter((h) => !isNoise(h.command));
  }

  const queryWords = tokenise(normalized);
  if (queryWords.length === 0) {
    return dedupeWithCounts(entries).filter((h) => !isNoise(h.command));
  }

  const deduped = dedupeWithCounts(entries).filter((h) => !isNoise(h.command));

  const scored = deduped.map((h) => ({
    ...h,
    score: scoreCmd(h.command, queryWords),
  }));

  // Strict filter: only scores < 0.4 survive (was 0.7 — too loose)
  const filtered = scored.filter((h) => h.score < 0.4);

  // Sort by score, then frequency, then recency
  filtered.sort((a, b) => {
    const d = a.score - b.score;
    if (Math.abs(d) > 0.01) return d;
    const cd = b.count - a.count;
    if (cd !== 0) return cd;
    return a.command.localeCompare(b.command);
  });

  return filtered;
}
