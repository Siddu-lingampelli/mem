import { describe, it, expect, vi } from "vitest";
import { print } from "../src/output.js";
import type { SearchResult } from "../src/types.js";

describe("print", () => {
  const results: SearchResult[] = [
    { command: "docker compose up -d", score: 0, count: 1, recent: true },
    { command: "docker compose down", score: 0.2, count: 2, recent: false },
  ];

  it("handles empty results", () => {
    const spy = vi.spyOn(console, "log");
    print([], "docker");
    expect(spy).toHaveBeenCalled();
    const msgs = spy.mock.calls.flatMap((c) => String(c)).join(" ");
    expect(msgs).toContain("No matching commands");
    expect(msgs).toContain("Try: mem");
    spy.mockRestore();
  });

  it("prints matching results", () => {
    const spy = vi.spyOn(console, "log");
    print(results, "docker");
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.flatMap((c) => String(c)).join(" ");
    expect(output).toContain("2 matches");
    spy.mockRestore();
  });
});
