import Fuse from "fuse.js";
import type { HistoryEntry, SearchResult } from "./types.js";

export function search(entries: HistoryEntry[], query: string): SearchResult[] {
  const normalized = query.trim();
  if (normalized.length === 0) {
    return [];
  }

  const fuse = new Fuse(entries, {
    keys: ["command"],
    includeScore: true,
    threshold: 0.6,
    minMatchCharLength: 2,
  });

  const results = fuse.search(normalized);

  return results.map((r) => ({
    command: r.item.command,
    score: r.score ?? 1,
  }));
}
