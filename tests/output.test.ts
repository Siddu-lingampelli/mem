import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { print, useColor, esc, highlightCmd } from "../src/output.js";

describe("print", () => {
  const results = [
    { command: "docker compose up -d", score: 0, count: 1, recent: true, category: "exact" },
    { command: "docker compose down", score: 0.2, count: 2, recent: false, category: "fuzzy" },
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

// ── print grouped by category ─────────────────────────────────────────
describe("print grouped by category", () => {
  it("renders exact-only results without section headers", () => {
    const spy = vi.spyOn(console, "log");
    const results = [
      { command: "docker ps", score: 0, count: 1, recent: true, category: "exact" },
      { command: "docker compose", score: 0, count: 2, recent: false, category: "exact" },
    ];
    print(results, "docker");
    const output = spy.mock.calls.flatMap(c => String(c)).join(" ");
    expect(output).toContain("2 matches");
    expect(output).not.toContain("Similar");
    expect(output).not.toContain("Did you also mean?");
    spy.mockRestore();
  });

  it("renders mixed results with Similar section", () => {
    const spy = vi.spyOn(console, "log");
    const results = [
      { command: "docker ps", score: 0, count: 1, recent: true, category: "exact" },
      { command: "claude doctor", score: 0.05, count: 3, recent: false, category: "fuzzy" },
    ];
    print(results, "docker");
    const output = spy.mock.calls.flatMap(c => String(c)).join(" ");
    expect(output).toContain("2 matches");
    expect(output).toContain("Similar");
    spy.mockRestore();
  });

  it("renders 'Did you also mean?' for similar-category results", () => {
    const spy = vi.spyOn(console, "log");
    const results = [
      { command: "docker ps", score: 0, count: 1, recent: true, category: "exact" },
      { command: "hermes doctor", score: 0.25, count: 1, recent: false, category: "similar" },
    ];
    print(results, "docker");
    const output = spy.mock.calls.flatMap(c => String(c)).join(" ");
    expect(output).toContain("Did you also mean?");
    spy.mockRestore();
  });

  it("omits empty sections", () => {
    const spy = vi.spyOn(console, "log");
    const results = [
      { command: "docker ps", score: 0, count: 1, recent: true, category: "exact" },
    ];
    print(results, "docker");
    const output = spy.mock.calls.flatMap(c => String(c)).join(" ");
    expect(output).not.toContain("Similar");
    expect(output).not.toContain("Did you also mean?");
    spy.mockRestore();
  });
});

// ── esc ──────────────────────────────────────────────────────────────
describe("esc", () => {
  it("escapes the dot metacharacter", () => {
    expect(esc(".")).toBe("\\.");
  });
  it("escapes the star metacharacter", () => {
    expect(esc("*")).toBe("\\*");
  });
  it("escapes the plus metacharacter", () => {
    expect(esc("+")).toBe("\\+");
  });
  it("escapes the question mark metacharacter", () => {
    expect(esc("?")).toBe("\\?");
  });
  it("escapes the caret metacharacter", () => {
    expect(esc("^")).toBe("\\^");
  });
  it("escapes the dollar metacharacter", () => {
    expect(esc("$")).toBe("\\$");
  });
  it("escapes curly braces", () => {
    expect(esc("{")).toBe("\\{");
    expect(esc("}")).toBe("\\}");
  });
  it("escapes parentheses", () => {
    expect(esc("(")).toBe("\\(");
    expect(esc(")")).toBe("\\)");
  });
  it("escapes the pipe metacharacter", () => {
    expect(esc("|")).toBe("\\|");
  });
  it("escapes square brackets", () => {
    expect(esc("[")).toBe("\\[");
    expect(esc("]")).toBe("\\]");
  });
  it("escapes backslash", () => {
    expect(esc("\\")).toBe("\\\\");
  });
  it("escapes combined metacharacters in a string", () => {
    expect(esc("hello.world*test")).toBe("hello\\.world\\*test");
  });
  it("returns a plain string unchanged when it has no metacharacters", () => {
    expect(esc("hello")).toBe("hello");
    expect(esc("")).toBe("");
  });
  it("escapes all 14 regex metacharacters at once", () => {
    expect(esc(".*+?^${}()|[]\\")).toBe("\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\");
  });
});

// ── highlightCmd ─────────────────────────────────────────────────────
describe("highlightCmd", () => {
  const BOLD = "\x1b[1m";
  const MAGENTA = "\x1b[35m";
  const DIM = "\x1b[2m";
  const RESET = "\x1b[0m";

  beforeEach(() => {
    // Ensure useColor() returns true by default for these tests
    delete process.env.NO_COLOR;
    // isTTY restore is done at the describe level via savedIsTTY
  });

  // We saved isTTY before any test runs so we can restore it afterwards
  let savedIsTTY: boolean | undefined;
  beforeAll(() => {
    savedIsTTY = process.stdout.isTTY;
  });
  afterAll(() => {
    Object.defineProperty(process.stdout, "isTTY", {
      value: savedIsTTY,
      configurable: true,
      writable: true,
    });
  });

  function withTTY(value: boolean, fn: () => void) {
    Object.defineProperty(process.stdout, "isTTY", {
      value,
      configurable: true,
      writable: true,
    });
    try {
      fn();
    } finally {
      Object.defineProperty(process.stdout, "isTTY", {
        value: savedIsTTY,
        configurable: true,
        writable: true,
      });
    }
  }

  it("highlights a single matching word with BOLD+MAGENTA", () => {
    withTTY(true, () => {
      const result = highlightCmd("docker compose up", "docker");
      expect(result).toContain(`${BOLD}${MAGENTA}docker${RESET}`);
      expect(result).toContain(DIM);
    });
  });

  it("highlights multiple matching words", () => {
    withTTY(true, () => {
      const result = highlightCmd("docker compose up", "docker compose");
      expect(result).toContain(`${BOLD}${MAGENTA}docker${RESET}`);
      expect(result).toContain(`${BOLD}${MAGENTA}compose${RESET}`);
    });
  });

  it("returns dimmed text when no words match", () => {
    withTTY(true, () => {
      const result = highlightCmd("docker compose up", "xyzxyz");
      expect(result).toBe(`${DIM}docker compose up${RESET}`);
    });
  });

  it("returns dimmed text for empty query", () => {
    withTTY(true, () => {
      const result = highlightCmd("docker compose up", "");
      expect(result).toBe(`${DIM}docker compose up${RESET}`);
    });
  });

  it("returns dimmed text for star query", () => {
    withTTY(true, () => {
      const result = highlightCmd("docker compose up", "*");
      expect(result).toBe(`${DIM}docker compose up${RESET}`);
    });
  });

  it("returns dimmed text for 'all' keyword", () => {
    withTTY(true, () => {
      const result = highlightCmd("docker compose up", "all");
      expect(result).toBe(`${DIM}docker compose up${RESET}`);
    });
  });

  it("matches case-insensitively", () => {
    withTTY(true, () => {
      const result = highlightCmd("DOCKER COMPOSE UP", "docker");
      expect(result).toContain(`${BOLD}${MAGENTA}DOCKER${RESET}`);
    });
  });

  it("matches with mixed case query", () => {
    withTTY(true, () => {
      const result = highlightCmd("docker compose up", "DOCKER");
      expect(result).toContain(`${BOLD}${MAGENTA}docker${RESET}`);
    });
  });

  it("returns plain command without ANSI when useColor is false", () => {
    withTTY(false, () => {
      const result = highlightCmd("docker compose up", "docker");
      expect(result).toBe("docker compose up");
    });
  });

  it("handles query words shorter than 2 characters (no match)", () => {
    withTTY(true, () => {
      const result = highlightCmd("docker compose up", "a b");
      // Words "a" and "b" are filtered out (min length 2), so fallback to dim(cmd)
      expect(result).toBe(`${DIM}docker compose up${RESET}`);
    });
  });

  it("highlights word with the matched version, not input case", () => {
    withTTY(true, () => {
      const result = highlightCmd("git commit --amend", "amend");
      // "amend" should be highlighted
      expect(result).toContain(`${BOLD}${MAGENTA}amend${RESET}`);
      // The rest should be dimmed
      expect(result).toContain(DIM);
    });
  });

  it("splits query on punctuation into separate highlighted words", () => {
    withTTY(true, () => {
      // The dot in "file.test" is treated as a word separator, so "file"
      // and "test" are highlighted individually
      const result = highlightCmd("file.test.txt", "file.test");
      expect(result).toContain(`${BOLD}${MAGENTA}file${RESET}`);
      expect(result).toContain(`${BOLD}${MAGENTA}test${RESET}`);
    });
  });
});

// ── useColor ─────────────────────────────────────────────────────────
describe("useColor", () => {
  let savedIsTTY: boolean | undefined;
  let savedNoColor: string | undefined;

  beforeAll(() => {
    savedIsTTY = process.stdout.isTTY;
  });

  afterAll(() => {
    if (savedNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = savedNoColor;
    }
    Object.defineProperty(process.stdout, "isTTY", {
      value: savedIsTTY,
      configurable: true,
      writable: true,
    });
  });

  beforeEach(() => {
    savedNoColor = process.env.NO_COLOR;
  });

  afterEach(() => {
    if (savedNoColor === undefined) {
      delete process.env.NO_COLOR;
    } else {
      process.env.NO_COLOR = savedNoColor;
    }
  });

  function setTTY(val: boolean) {
    Object.defineProperty(process.stdout, "isTTY", {
      value: val,
      configurable: true,
      writable: true,
    });
  }

  it("returns false when NO_COLOR is set (regardless of isTTY)", () => {
    setTTY(true);
    process.env.NO_COLOR = "1";
    expect(useColor()).toBe(false);

    setTTY(false);
    expect(useColor()).toBe(false);
  });

  it("returns true when NO_COLOR is unset and isTTY is true", () => {
    delete process.env.NO_COLOR;
    setTTY(true);
    expect(useColor()).toBe(true);
  });

  it("returns false when NO_COLOR is unset and isTTY is false", () => {
    delete process.env.NO_COLOR;
    setTTY(false);
    expect(useColor()).toBe(false);
  });

  it("returns false when NO_COLOR is set to an empty string", () => {
    setTTY(true);
    process.env.NO_COLOR = "";
    // An empty string is not undefined, so useColor checks it and returns false
    expect(useColor()).toBe(false);
  });

  it("returns true when NO_COLOR is undefined and isTTY is true", () => {
    delete process.env.NO_COLOR;
    setTTY(true);
    expect(useColor()).toBe(true);
  });
});
