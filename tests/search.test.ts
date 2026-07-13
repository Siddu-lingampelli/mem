import { describe, it, expect } from "vitest";
import { search, preprocess } from "../src/search.js";
import type { HistoryEntry } from "../src/types.js";

function entry(command: string): HistoryEntry {
  return { command };
}

describe("search", () => {
  const entries: HistoryEntry[] = [
    entry("docker compose up -d"),
    entry("docker compose down"),
    entry("docker compose logs"),
    entry("npm run test"),
    entry("npm run build"),
    entry("git push origin main"),
    entry("git status"),
  ];

  it("finds matching commands", () => {
    const results = search(entries, "docker compose");
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results[0].command).toContain("docker compose");
  });

  it("fuzzy matches typos via Levenshtein", () => {
    const results = search(entries, "docer compose");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.command.includes("docker"))).toBe(true);
  });

  it("returns empty array for impossible query", () => {
    const results = search(entries, "zzzznonexistent");
    expect(results).toHaveLength(0);
  });

  it("returns all entries for whitespace-only query", () => {
    const results = search(entries, "   ");
    expect(results.length).toBe(entries.length);
  });

  it("returns all entries for empty query", () => {
    const results = search(entries, "");
    expect(results.length).toBe(entries.length);
  });

  it("returns all entries for 'all' keyword", () => {
    const results = search(entries, "all");
    expect(results.length).toBe(entries.length);
  });

  it("dedupes identical commands", () => {
    const dupes: HistoryEntry[] = [entry("git status"), entry("git status"), entry("git status")];
    const results = search(dupes, "git status");
    expect(results).toHaveLength(1);
  });

  it("scores better matches higher", () => {
    const results = search(entries, "git status");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].command).toBe("git status");
  });

  it("exact match returns distance-0 score", () => {
    const results = search(entries, "docker compose up -d");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].command).toBe("docker compose up -d");
    expect(results[0].score).toBe(0);
  });

  it("handles Levenshtein on tokens longer than 64 chars (_levBufSize guard)", () => {
    // Tokens >64 chars exercise the _levBufSize code path which allocates new arrays
    const tokenA = "a".repeat(65);
    const tokenB = "a".repeat(64) + "b"; // distance 1 from tokenA
    const longEntries = [entry(tokenA)];
    const results = search(longEntries, tokenB);
    // Fuzzy match with distance 1 → FUZZY_DIST1 = 0.05, below threshold
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].command).toBe(tokenA);
  });
});

describe("preprocess noise filtering (isNoise)", () => {
  it("filters out self-prefixed commands like 'mem search ...'", () => {
    const entries = [
      entry("mem search docker"),
      entry("mem stats"),
      entry("docker ps"),
    ];
    const result = preprocess(entries);
    expect(result).toHaveLength(1);
    expect(result[0].command).toBe("docker ps");
  });

  it("filters out single-character commands", () => {
    const entries = [entry("g"), entry("git status")];
    const result = preprocess(entries);
    expect(result).toHaveLength(1);
    expect(result[0].command).toBe("git status");
  });

  it("filters out non-alphanumeric commands", () => {
    const entries = [entry("!!"), entry("git push")];
    const result = preprocess(entries);
    expect(result).toHaveLength(1);
    expect(result[0].command).toBe("git push");
  });

  it("allows normal multi-word commands to pass through", () => {
    const entries = [entry("npm run build"), entry("docker compose up")];
    const result = preprocess(entries);
    expect(result).toHaveLength(2);
  });
});
