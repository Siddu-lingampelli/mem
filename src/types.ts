/** Categorises how a result matched the query. */
export type MatchCategory = "exact" | "fuzzy" | "similar";

export interface HistoryEntry {
  command: string;
}

export interface SearchHit {
  command: string;
  /** 0..1, lower = better relevance (Fuse-compatible convention). */
  score: number;
  /** How this result matched the query. */
  category: MatchCategory;
  /** Number of times this exact command was executed. */
  count: number;
  /** True when the most recent use is in the newest 25% of the history file. */
  recent: boolean;
}

/** Backward-compat alias used by tests. */
export type SearchResult = SearchHit;
