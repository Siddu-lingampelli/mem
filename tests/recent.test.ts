import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadHistory = vi.fn();
vi.mock("../src/history.js", () => ({
  readHistory: (...args: any[]) => mockReadHistory(...args),
}));

vi.mock("../src/output.js", () => ({
  useColor: () => false,
  colorize: (t: string) => t,
}));

const { runRecent } = await import("../src/recent.js");

describe("runRecent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prints 'No history found.' when history is empty", () => {
    mockReadHistory.mockReturnValue([]);

    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runRecent(10);

    spy.mockRestore();
    expect(out.join("\n")).toContain("No history found.");
  });

  it("shows correct count in header", () => {
    mockReadHistory.mockReturnValue([
      { command: "git status" },
      { command: "docker ps" },
    ]);

    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runRecent(10);

    spy.mockRestore();
    const output = out.join("\n");
    expect(output).toContain("Last");
    expect(output).toContain("2 commands");
  });

  it("shows commands newest-first (already ordered by readHistory)", () => {
    mockReadHistory.mockReturnValue([
      { command: "npm run build" },
      { command: "docker compose up" },
      { command: "git commit" },
    ]);

    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runRecent(10);

    spy.mockRestore();
    const output = out.join("\n");

    // readHistory returns newest-first, so the commands appear in that order
    const idx1 = output.indexOf("npm run build");
    const idx2 = output.indexOf("docker compose up");
    const idx3 = output.indexOf("git commit");
    expect(idx1).toBeGreaterThan(-1);
    expect(idx2).toBeGreaterThan(idx1);
    expect(idx3).toBeGreaterThan(idx2);
  });

  it("respects the N parameter", () => {
    mockReadHistory.mockReturnValue(
      Array.from({ length: 10 }, (_, i) => ({ command: `cmd${i + 1}` }))
    );

    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runRecent(3);

    spy.mockRestore();
    const output = out.join("\n");
    const entryCount = (output.match(/\. cmd\d+/g) || []).length;
    expect(entryCount).toBe(3);
  });

  it("masks secrets in output", () => {
    mockReadHistory.mockReturnValue([
      { command: "export GITHUB_TOKEN=ghp_abc123def456ghi789jkl012mno345pqr678stu901" },
    ]);

    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runRecent(10);

    spy.mockRestore();
    const output = out.join("\n");
    expect(output).not.toContain("ghp_abc123def456ghi789jkl012mno345pqr678stu901");
    expect(output).toContain("********");
  });

  it("handles single entry gracefully", () => {
    mockReadHistory.mockReturnValue([
      { command: "git status" },
    ]);

    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((msg) => out.push(msg));

    runRecent(10);

    spy.mockRestore();
    const output = out.join("\n");
    expect(output).toContain("1 commands");
    expect(output).toContain("git status");
  });
});
