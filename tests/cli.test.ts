import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mock external imports ───────────────────────────────────────────
const mockReadHistory = vi.fn();
const mockSearch = vi.fn();
const mockPrint = vi.fn();
const mockUseColor = vi.fn();

vi.mock("../src/history.js", () => ({
  readHistory: (...args: any[]) => mockReadHistory(...args),
}));

vi.mock("../src/search.js", () => ({
  search: (...args: any[]) => mockSearch(...args),
}));

vi.mock("../src/output.js", () => ({
  useColor: (...args: any[]) => mockUseColor(...args),
  print: (...args: any[]) => mockPrint(...args),
}));

const { parseCount, stripAnsi, paint, runSearch } = await import("../src/cli.js");

// ── parseCount ───────────────────────────────────────────────────────
describe("parseCount", () => {
  it("returns the parsed integer for a valid number string", () => {
    expect(parseCount("5")).toBe(5);
    expect(parseCount("42")).toBe(42);
    expect(parseCount("1")).toBe(1);
  });

  it("returns fallback for NaN input", () => {
    expect(parseCount("abc")).toBeUndefined();
    expect(parseCount("abc", 10)).toBe(10);
  });

  it("returns fallback for NaN input (truly non-numeric)", () => {
    expect(parseCount("xyz", 99)).toBe(99);
  });

  it("returns fallback for negative numbers", () => {
    expect(parseCount("-3")).toBeUndefined();
    expect(parseCount("-1", 10)).toBe(10);
  });

  it("returns fallback for zero", () => {
    expect(parseCount("0")).toBeUndefined();
    expect(parseCount("0", 7)).toBe(7);
  });

  it("returns fallback for undefined", () => {
    expect(parseCount(undefined)).toBeUndefined();
    expect(parseCount(undefined, 42)).toBe(42);
  });

  it("returns fallback for empty string", () => {
    expect(parseCount("")).toBeUndefined();
    expect(parseCount("", 8)).toBe(8);
  });

  it("handles trailing whitespace", () => {
    expect(parseCount("  5  ", 1)).toBe(5);
  });

  it("passes through large valid integers", () => {
    expect(parseCount("999999", 1)).toBe(999999);
  });
});

// ── stripAnsi ────────────────────────────────────────────────────────
describe("stripAnsi", () => {
  it("strips simple SGR codes (e.g. \\x1b[31m)", () => {
    expect(stripAnsi("\x1b[31mhello\x1b[0m")).toBe("hello");
    expect(stripAnsi("\x1b[32mOK\x1b[0m")).toBe("OK");
  });

  it("strips multi-param SGR codes (e.g. \\x1b[1;31m)", () => {
    expect(stripAnsi("\x1b[1;31mbold red\x1b[0m")).toBe("bold red");
    expect(stripAnsi("\x1b[1;32;45mcombined\x1b[0m")).toBe("combined");
  });

  it("strips 256-color SGR codes (\\x1b[38;5;Nm)", () => {
    expect(stripAnsi("\x1b[38;5;231mwhite\x1b[0m")).toBe("white");
    expect(stripAnsi("\x1b[48;5;52mbg\x1b[0m")).toBe("bg");
  });

  it("strips true-color SGR codes (\\x1b[38;2;R;G;Bm)", () => {
    expect(stripAnsi("\x1b[38;2;255;0;0mred\x1b[0m")).toBe("red");
    expect(stripAnsi("\x1b[38;2;0;255;0m\x1b[48;2;0;0;255mgreen on blue\x1b[0m")).toBe("green on blue");
  });

  it("strips non-SGR escape sequences (\\x1b[K, \\x1b[H, \\x1b[?25l, etc.)", () => {
    expect(stripAnsi("\x1b[K")).toBe("");
    expect(stripAnsi("\x1b[H")).toBe("");
    expect(stripAnsi("\x1b[2J")).toBe("");
    expect(stripAnsi("\x1b[?25l")).toBe("");
    expect(stripAnsi("\x1b[?25h")).toBe("");
    expect(stripAnsi("before\x1b[3Cafter")).toBe("beforeafter");
    expect(stripAnsi("\x1b[A\x1b[B\x1b[C\x1b[D")).toBe("");
  });

  it("strips sequences with colons (\\x1b[38:5:231m)", () => {
    expect(stripAnsi("\x1b[38:5:231mtext\x1b[0m")).toBe("text");
  });

  it("returns the original string when no ANSI codes are present", () => {
    expect(stripAnsi("hello world")).toBe("hello world");
    expect(stripAnsi("")).toBe("");
    expect(stripAnsi("no escapes here")).toBe("no escapes here");
  });

  it("strips mixed ANSI sequences", () => {
    const mixed = "\x1b[1m\x1b[36mcyan bold\x1b[0m \x1b[Kregular";
    expect(stripAnsi(mixed)).toBe("cyan bold regular");
  });
});

// ── paint ────────────────────────────────────────────────────────────
describe("paint", () => {
  beforeEach(() => {
    mockUseColor.mockReset();
  });

  it("returns text with ANSI codes when useColor() returns true", () => {
    mockUseColor.mockReturnValue(true);
    const input = "\x1b[32mhello\x1b[0m";
    expect(paint(input)).toBe(input);
  });

  it("strips ANSI codes when useColor() returns false", () => {
    mockUseColor.mockReturnValue(false);
    expect(paint("\x1b[32mhello\x1b[0m")).toBe("hello");
  });

  it("strips ANSI codes when useColor() returns undefined (falsy)", () => {
    mockUseColor.mockReturnValue(undefined as unknown as boolean);
    expect(paint("\x1b[1mBOLD\x1b[0m")).toBe("BOLD");
  });

  it("passes through plain text unchanged regardless of useColor", () => {
    mockUseColor.mockReturnValue(true);
    expect(paint("plain text")).toBe("plain text");

    mockUseColor.mockReturnValue(false);
    expect(paint("plain text")).toBe("plain text");
  });

  it("strips mixed ANSI combos when useColor() is false", () => {
    mockUseColor.mockReturnValue(false);
    expect(paint("\x1b[1;31;45mstyled\x1b[0m")).toBe("styled");
  });
});

// ── runSearch ────────────────────────────────────────────────────────
describe("runSearch", () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Also reset mock return values/implementations (clearAllMocks doesn't reset these)
    mockSearch.mockReset();
    mockReadHistory.mockReset();
    mockPrint.mockReset();
    mockUseColor.mockReset();
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy?.mockRestore();
    consoleErrorSpy?.mockRestore();
    consoleLogSpy?.mockRestore();
  });

  it("calls print with results, query, and default showAll/maxCount", () => {
    const entries = [{ command: "docker ps" }, { command: "git status" }];
    const results = [{ command: "docker ps", score: 0.2, count: 1, recent: true, category: "fuzzy" }];

    mockReadHistory.mockReturnValue(entries);
    mockSearch.mockReturnValue(results);

    runSearch("docker");

    expect(mockReadHistory).toHaveBeenCalledTimes(1);
    expect(mockSearch).toHaveBeenCalledWith(entries, "docker");
    expect(mockPrint).toHaveBeenCalledWith(results, "docker", false, undefined);
  });

  it("prints to console.error and exits when history is empty", () => {
    mockReadHistory.mockReturnValue([]);

    runSearch("anything");

    expect(consoleErrorSpy).toHaveBeenCalledWith("No history found.");
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(mockPrint).not.toHaveBeenCalled();
  });

  it("prints 'No matching commands found.' when search returns empty", () => {
    mockReadHistory.mockReturnValue([{ command: "docker ps" }]);
    mockSearch.mockReturnValue([]);

    runSearch("xyz");

    expect(consoleLogSpy).toHaveBeenCalledWith("No matching commands found.");
    expect(mockPrint).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("does not call process.exit on normal flow", () => {
    mockReadHistory.mockReturnValue([{ command: "docker ps" }]);
    mockSearch.mockReturnValue([{ command: "docker ps", score: 0, count: 1, recent: true, category: "exact" }]);

    runSearch("docker");

    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("passes through to print with correct query string", () => {
    mockReadHistory.mockReturnValue([{ command: "npm run build" }]);
    mockSearch.mockReturnValue([{ command: "npm run build", score: 0, count: 2, recent: false, category: "exact" }]);

    runSearch("npm build");

    expect(mockSearch).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ command: "npm run build" })]),
      "npm build",
    );
    expect(mockPrint).toHaveBeenCalledWith(
      expect.any(Array),
      "npm build",
      expect.any(Boolean),
      undefined,
    );
  });

  it("calls console.error and exits when readHistory throws", () => {
    mockReadHistory.mockImplementation(() => {
      throw new Error("permission denied");
    });

    runSearch("docker");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error reading history:",
      "permission denied",
    );
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
