import { describe, it, expect, vi } from "vitest";
import { runBench } from "../src/bench.js";

describe("bench", () => {
  it("outputs benchmark metrics or empty-state message", () => {
    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runBench(100);

    spy.mockRestore();
    const output = out.join("\n");
    // Either shows metrics (History / Parser / Search / Total) or "No history found"
    const isValid =
      output.includes("No history found") ||
      (output.includes("History") &&
        output.includes("Parser") &&
        output.includes("Search") &&
        output.includes("Total"));
    expect(isValid).toBe(true);
  });
});
