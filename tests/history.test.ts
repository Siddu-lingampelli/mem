import { describe, it, expect, vi, beforeEach } from "vitest";
import { readHistory } from "../src/history.js";

// Mock fs
vi.mock("fs", () => {
  const actual = vi.importActual("fs") as any;
  return {
    ...actual,
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  };
});

import { readFileSync, existsSync } from "fs";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(existsSync).mockReturnValue(true);
});

describe("readHistory", () => {
  it("parses PSReadLine format and returns newest first", () => {
    vi.mocked(readFileSync).mockReturnValue("npm run build\ngit push\nnpm test\ndocker compose up\n");

    const entries = readHistory();
    expect(entries).toHaveLength(4);
    expect(entries[0].command).toBe("docker compose up");
    expect(entries[3].command).toBe("npm run build");
  });

  it("skips blank lines", () => {
    vi.mocked(readFileSync).mockReturnValue("cmd1\n\ncmd2\n\n\ncmd3\n");

    const entries = readHistory();
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.command)).toEqual(["cmd3", "cmd2", "cmd1"]);
  });

  it("returns empty array when file is missing", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(readHistory()).toEqual([]);
  });

  it("limits to N entries", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `cmd${i + 1}`).join("\n");
    vi.mocked(readFileSync).mockReturnValue(lines);

    expect(readHistory(3)).toHaveLength(3);
  });
});
