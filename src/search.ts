import Fuse from "fuse.js";
import type { HistoryEntry, SearchResult } from "./types.js";

const ALL_KEYWORDS = ["all", "*", "everything"];

/**
 * Search history entries. Empty/whitespace/all-keyword query returns all
 * unique entries (newest-first). Otherwise runs fuzzy search and dedupes results.
 */
export function search(entries: HistoryEntry[], query: string): SearchResult[] {
  const normalized = query.trim().toLowerCase();

  // "all" / "*" → list every unique command
  if (normalized.length === 0 || ALL_KEYWORDS.includes(normalized)) {
    return dedupe(entries.map((e) => ({ command: e.command, score: 1 })));
  }

  const fuse = new Fuse(entries, {
    keys: ["command"],
    includeScore: true,
    threshold: 0.3, // tighter: only close matches (was 0.6 = too loose)
    minMatchCharLength: 2,
    ignoreLocation: false,
  });

  const results = fuse.search(normalized);
  return dedupe(results.map((r) => ({ command: r.item.command, score: r.score ?? 1 })));
}

/** Remove duplicate commands, keeping the first (newest) occurrence. */
function dedupe(items: { command: string; score: number }[]): SearchResult[] {
  const seen = new Set<string>();
  const out: SearchResult[] = [];
  for (const item of items) {
    if (seen.has(item.command)) continue;
    seen.add(item.command);
    out.push({ command: item.command, score: item.score });
  }
  return out;
}
