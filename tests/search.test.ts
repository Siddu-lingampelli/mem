import { describe, it, expect } from "vitest";
import { search } from "../src/search.js";
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
});
