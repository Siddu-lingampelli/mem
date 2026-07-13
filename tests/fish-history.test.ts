import { describe, it, expect, vi, beforeEach } from "vitest";

const mockExistsSync = vi.fn();
const mockReadFileSync = vi.fn();

vi.mock("fs", () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
}));

vi.mock("os", () => ({ homedir: () => "/home/user" }));

const { readFishHistory, getFishHistoryPath } = await import("../src/fish-history.js");

describe("getFishHistoryPath", () => {
  beforeEach(() => { vi.clearAllMocks(); delete process.env.XDG_DATA_HOME; });

  it("returns xdg path when set and exists", () => {
    process.env.XDG_DATA_HOME = "/custom/xdg";
    mockExistsSync.mockReturnValue(true);
    const result = getFishHistoryPath();
    // Platform-agnostic: check filename and path segments
    expect(result.endsWith("fish_history") || result.endsWith("fish\\fish_history")).toBe(true);
    expect(result).toContain("custom");
    expect(result).toContain("xdg");
  });

  it("returns empty when no file exists", () => {
    mockExistsSync.mockReturnValue(false);
    expect(getFishHistoryPath()).toBe("");
  });
});

describe("readFishHistory", () => {
  beforeEach(() => { vi.clearAllMocks(); delete process.env.XDG_DATA_HOME; });

  it("returns empty when no history file", () => {
    mockExistsSync.mockReturnValue(false);
    expect(readFishHistory()).toEqual([]);
  });

  it("parses fish YAML format newest-first (file is oldest-first)", () => {
    mockExistsSync.mockReturnValue(true);
    // File order: oldest first (git status oldest, npm test newest)
    mockReadFileSync.mockReturnValue(Buffer.from(
      '- cmd: git status\n  when: 98\n- cmd: docker ps\n  when: 99\n- cmd: npm test\n  when: 100',
      "utf-8"
    ));
    const result = readFishHistory(10);
    expect(result).toHaveLength(3);
    expect(result[0].command).toBe("npm test");
    expect(result[1].command).toBe("docker ps");
    expect(result[2].command).toBe("git status");
  });

  it("handles multiline commands", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(Buffer.from(
      '- cmd: git status\n  when: 99\n- cmd: for i in 1 2 3\n  echo $i\n  end\n  when: 100',
      "utf-8"
    ));
    const result = readFishHistory(10);
    expect(result).toHaveLength(2);
    expect(result[0].command).toContain("echo $i");
    expect(result[1].command).toBe("git status");
  });

  it("skips paths blocks", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(Buffer.from(
      '- cmd: docker ps\n  when: 99\n- cmd: git status\n  when: 100\n  paths:\n    - /home/user/project',
      "utf-8"
    ));
    const result = readFishHistory(10);
    expect(result).toHaveLength(2);
    expect(result[0].command).toBe("git status");
    expect(result[1].command).toBe("docker ps");
  });

  it("respects limit", () => {
    mockExistsSync.mockReturnValue(true);
    const lines = Array.from({ length: 5 }, (_, i) => `- cmd: cmd${i}\n  when: ${i}`);
    mockReadFileSync.mockReturnValue(Buffer.from(lines.join("\n"), "utf-8"));
    expect(readFishHistory(2)).toHaveLength(2);
  });

  it("returns empty array when readFileSync throws", () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => { throw new Error("read error"); });
    expect(readFishHistory()).toEqual([]);
  });
});
