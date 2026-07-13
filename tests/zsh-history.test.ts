import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock("fs", () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
}));

vi.mock("os", () => ({ homedir: () => "/home/user" }));

const { readZshHistory, getZshHistoryPath } = await import("../src/zsh-history.js");

describe("getZshHistoryPath", () => {
  beforeEach(() => { vi.clearAllMocks(); delete process.env.HISTFILE; });

  it("returns HISTFILE path when set and exists", () => {
    process.env.HISTFILE = "/custom/zsh_history";
    mockExistsSync.mockReturnValue(true);
    expect(getZshHistoryPath()).toBe("/custom/zsh_history");
  });

  it("returns empty string when no file exists", () => {
    mockExistsSync.mockReturnValue(false);
    expect(getZshHistoryPath()).toBe("");
  });
});

describe("readZshHistory", () => {
  beforeEach(() => { vi.clearAllMocks(); delete process.env.HISTFILE; });

  it("returns empty when no history file", () => {
    mockExistsSync.mockReturnValue(false);
    expect(readZshHistory()).toEqual([]);
  });

  it("parses zsh format newest-first (file is oldest-first)", () => {
    mockExistsSync.mockReturnValue(true);
    // File order: oldest first (git status oldest, npm test newest)
    mockReadFileSync.mockReturnValue(Buffer.from(
      ": 98:0;git status\n: 99:0;docker ps\n: 100:0;npm test",
      "utf-8"
    ));
    const result = readZshHistory(10);
    expect(result).toHaveLength(3);
    expect(result[0].command).toBe("npm test");
    expect(result[1].command).toBe("docker ps");
    expect(result[2].command).toBe("git status");
  });

  it("handles semicolons in command text", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(Buffer.from(
      ': 99:0;git commit -m "fix; done"\n: 100:0;echo "a;b;c"',
      "utf-8"
    ));
    const result = readZshHistory(10);
    expect(result).toHaveLength(2);
    expect(result[0].command).toBe('echo "a;b;c"');
    expect(result[1].command).toBe('git commit -m "fix; done"');
  });

  it("respects limit", () => {
    mockExistsSync.mockReturnValue(true);
    const lines = Array.from({ length: 5 }, (_, i) => `: ${i}:0;cmd${i}`);
    mockReadFileSync.mockReturnValue(Buffer.from(lines.join("\n"), "utf-8"));
    expect(readZshHistory(2)).toHaveLength(2);
  });

  it("handles CRLF line endings", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(Buffer.from(
      ": 98:0;git status\r\n: 99:0;docker ps\r\n: 100:0;npm test",
      "utf-8"
    ));
    const result = readZshHistory(10);
    expect(result[0].command).toBe("npm test");
    expect(result[1].command).toBe("docker ps");
  });

  it("returns empty array when readFileSync throws", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => { throw new Error("read error"); });
    expect(readZshHistory()).toEqual([]);
  });
});
