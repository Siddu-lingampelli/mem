import { describe, it, expect, vi } from "vitest";
import { print } from "../src/output.js";
import type { SearchResult } from "../src/types.js";

describe("print", () => {
  const results: SearchResult[] = [
    { command: "docker compose up -d", score: 0 },
    { command: "docker compose down", score: 0.2 },
  ];

  it("handles empty results", () => {
    const spy = vi.spyOn(console, "log");
    print([], "docker");
    expect(spy).toHaveBeenCalledWith("No matching commands found.");
    spy.mockRestore();
  });

  it("prints matching results", () => {
    const spy = vi.spyOn(console, "log");
    print(results, "docker");
    expect(spy).toHaveBeenCalled();
    const output = spy.mock.calls.flatMap((c) => String(c)).join(" ");
    expect(output).toContain("Found 2 matching commands");
    spy.mockRestore();
  });
});
