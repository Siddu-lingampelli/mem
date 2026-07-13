import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock readHistory to return controlled data
const mockReadHistory = vi.fn();
vi.mock("../src/history.js", () => ({
  readHistory: (...args: any[]) => mockReadHistory(...args),
}));

// Mock useColor to avoid ANSI in output tests
vi.mock("../src/output.js", () => ({
  useColor: () => false,
  colorize: (t: string) => t,
}));

const { runStats } = await import("../src/stats.js");

describe("runStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prints 'No history found.' when history is empty", () => {
    mockReadHistory.mockReturnValue([]);

    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runStats(10);

    spy.mockRestore();
    expect(out.join("\n")).toContain("No history found.");
  });

  it("shows total and unique counts", () => {
    mockReadHistory.mockReturnValue([
      { command: "git status" },
      { command: "docker ps" },
      { command: "git status" }, // duplicate
      { command: "npm test" },
    ]);

    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runStats(10);

    spy.mockRestore();
    const output = out.join("\n");
    expect(output).toContain("4 commands");    // total
    expect(output).toContain("3 unique");      // after dedup (git status counted once)
    expect(output).toContain("mem stats");
  });

  it("shows top N commands sorted by frequency", () => {
    mockReadHistory.mockReturnValue([
      { command: "ls" },           // 1×
      { command: "git status" },   // 3× (three entries)
      { command: "docker ps" },    // 2×
      { command: "git status" },
      { command: "docker ps" },
      { command: "git status" },
    ]);

    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runStats(2); // top 2 only

    spy.mockRestore();
    const output = out.join("\n");

    // git status (3×) should be #1, docker ps (2×) should be #2
    expect(output).toContain("git status");
    expect(output).toContain("docker ps");
    expect(output).not.toContain("ls"); // excluded — only top 2
  });

  it("handles single entry gracefully", () => {
    mockReadHistory.mockReturnValue([
      { command: "git status" },
    ]);

    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runStats(10);

    spy.mockRestore();
    const output = out.join("\n");
    expect(output).toContain("1 commands");
    expect(output).toContain("1 unique");
    expect(output).toContain("git status");
  });

  it("respects the top parameter", () => {
    mockReadHistory.mockReturnValue(
      Array.from({ length: 20 }, (_, i) => ({ command: `cmd${i + 1}` }))
    );

    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runStats(5);

    spy.mockRestore();
    const output = out.join("\n");

    // Should only show 5 commands
    const cmdCount = (output.match(/\. cmd\d+/g) || []).length;
    expect(cmdCount).toBe(5);
  });

  it("renders bar charts for top commands", () => {
    mockReadHistory.mockReturnValue([
      { command: "git status" },
      { command: "docker ps" },
      { command: "npm test" },
    ]);

    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runStats(3);

    spy.mockRestore();
    const output = out.join("\n");

    // Bar characters should appear
    expect(output).toContain("█");
    // Each command should have a count shown
    expect(output).toContain("1");
  });
});
