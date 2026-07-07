import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fs before importing bash-history
const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock("fs", () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
}));

// Mock os homedir
vi.mock("os", () => ({
  homedir: () => "/home/user",
}));

const { readBashHistory, getBashHistoryPath } = await import("../src/bash-history.js");

describe("getBashHistoryPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HISTFILE;
  });

  it("returns HISTFILE path when env var is set and file exists", () => {
    process.env.HISTFILE = "/custom/history.txt";
    mockExistsSync.mockReturnValue(true);
    const result = getBashHistoryPath();
    expect(result).toBe("/custom/history.txt");
  });

  it("returns empty string when no file exists", () => {
    mockExistsSync.mockReturnValue(false);
    const result = getBashHistoryPath();
    expect(result).toBe("");
  });
});

describe("readBashHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.HISTFILE;
  });

  it("returns empty array when no history file exists", () => {
    mockExistsSync.mockReturnValue(false);
    const result = readBashHistory();
    expect(result).toEqual([]);
  });

  it("returns empty array on read error", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => { throw new Error("EACCES"); });
    const result = readBashHistory();
    expect(result).toEqual([]);
  });

  it("parses plain mode (one command per line) newest-first", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(Buffer.from("git status\ndocker ps\nnpm test", "utf-8"));
    const result = readBashHistory(10);
    expect(result).toHaveLength(3);
    expect(result[0].command).toBe("npm test");
    expect(result[1].command).toBe("docker ps");
    expect(result[2].command).toBe("git status");
  });

  it("parses HISTTIMEFORMAT mode (lines prefixed with #<epoch>)", () => {
    mockExistsSync.mockReturnValue(true);
    const content = [
      "#1712345678",
      "git commit -m 'fix'",
      "#1712345680",
      "docker compose up -d",
      "#1712345690",
      "for i in 1 2; do\n  echo $i\ndone",
    ].join("\n");
    mockReadFileSync.mockReturnValue(Buffer.from(content, "utf-8"));
    const result = readBashHistory(10);
    expect(result).toHaveLength(3);
    expect(result[0].command).toContain("for i in 1 2");
    expect(result[1].command).toBe("docker compose up -d");
    expect(result[2].command).toBe("git commit -m 'fix'");
  });

  it("respects limit parameter", () => {
    mockExistsSync.mockReturnValue(true);
    // 5 lines → 5 entries
    const content = Array.from({ length: 5 }, (_, i) => `cmd${i + 1}`).join("\n");
    mockReadFileSync.mockReturnValue(Buffer.from(content, "utf-8"));
    const result = readBashHistory(3);
    expect(result).toHaveLength(3);
    expect(result[0].command).toBe("cmd5");
    expect(result[1].command).toBe("cmd4");
    expect(result[2].command).toBe("cmd3");
  });

  it("skips empty lines in plain mode", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(Buffer.from("git status\n\n\nls\n", "utf-8"));
    const result = readBashHistory(10);
    expect(result).toHaveLength(2);
    expect(result[0].command).toBe("ls");
    expect(result[1].command).toBe("git status");
  });

  it("handles CRLF line endings", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(Buffer.from("git status\r\ndocker ps\r\nnpm test", "utf-8"));
    const result = readBashHistory(10);
    expect(result).toHaveLength(3);
    // No trailing \r on any command
    expect(result[0].command).toBe("npm test");
    expect(result[1].command).toBe("docker ps");
    expect(result[2].command).toBe("git status");
  });

  it("parses mixed format: first non-timestamp lines as plain mode, then timestamp lines trigger boundary detection", () => {
    mockExistsSync.mockReturnValue(true);
    const content = [
      "git status",          // plain
      "docker ps",           // plain
      "#1712345678",         // first timestamp → switches to boundary mode
      "echo hello",
      "#1712345680",
      "echo world",
    ].join("\n");
    mockReadFileSync.mockReturnValue(Buffer.from(content, "utf-8"));
    const result = readBashHistory(10);
    // In per-line detection mode, first two are plain, last 4 are timestamp-mode
    // The timestamp lines mark entry boundaries
    expect(result).toHaveLength(4);
    // newest first
    expect(result[0].command).toBe("echo world");
    expect(result[1].command).toBe("echo hello");
    expect(result[2].command).toBe("docker ps");
    expect(result[3].command).toBe("git status");
  });

  it("does not match non-timestamp # lines as entry boundaries", () => {
    mockExistsSync.mockReturnValue(true);
    const content = [
      "git status",
      "#1234",  // too few digits (only 4) — not a timestamp
      "docker ps",
    ].join("\n");
    mockReadFileSync.mockReturnValue(Buffer.from(content, "utf-8"));
    const result = readBashHistory(10);
    // All lines in plain mode — #1234 is just a comment/command
    expect(result).toHaveLength(3);
    expect(result[0].command).toBe("docker ps");
    expect(result[1].command).toBe("#1234");
    expect(result[2].command).toBe("git status");
  });
});
