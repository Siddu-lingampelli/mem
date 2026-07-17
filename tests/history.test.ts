import { describe, it, expect, vi, beforeEach } from "vitest";
import { readHistory, readPsReadLineHistory, detectEncoding } from "../src/history.js";

// Mock fs
vi.mock("fs", () => {
  const actual = vi.importActual("fs") as any;
  return {
    ...actual,
    readFileSync: vi.fn(),
    existsSync: vi.fn(),
  };
});

// Mock other history readers so they return [] when fallback is triggered
vi.mock("../src/bash-history.js", () => ({ readBashHistory: vi.fn(() => []) }));
vi.mock("../src/zsh-history.js", () => ({ readZshHistory: vi.fn(() => []) }));
vi.mock("../src/fish-history.js", () => ({ readFishHistory: vi.fn(() => []) }));

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

  it("returns empty array when readFileSync throws", () => {
    vi.mocked(readFileSync).mockImplementation(() => { throw new Error("read error"); });
    vi.mocked(existsSync).mockReturnValue(true);
    expect(readHistory()).toEqual([]);
  });
});

describe("detectEncoding", () => {
  it("detects UTF-8 BOM (EF BB BF)", () => {
    const buf = Buffer.from([0xEF, 0xBB, 0xBF, 0x61]);
    expect(detectEncoding(buf)).toBe("utf8");
  });

  it("detects UTF-16 LE BOM (FF FE)", () => {
    const buf = Buffer.from([0xFF, 0xFE, 0x61, 0x00]);
    expect(detectEncoding(buf)).toBe("utf16le");
  });

  it("defaults to utf-8 when no BOM is present", () => {
    const buf = Buffer.from("hello world", "utf-8");
    expect(detectEncoding(buf)).toBe("utf-8");
  });
});

describe("BOM handling", () => {
  it("strips leading U+FEFF BOM character from readHistory content", () => {
    const bom = Buffer.from([0xEF, 0xBB, 0xBF]); // UTF-8 BOM
    const content = Buffer.from("npm run build\ngit push\n", "utf-8");
    vi.mocked(readFileSync).mockReturnValue(Buffer.concat([bom, content]));

    const entries = readHistory();
    expect(entries).toHaveLength(2);
    // No command should contain the BOM character
    // Use ﻿ to check BOM character is absent from decoded commands
    const bomChar = String.fromCharCode(0xFEFF);
    expect(entries.every((e) => !e.command.includes(bomChar))).toBe(true);
    // Commands are newest-first
    expect(entries[0].command).toBe("git push");
    expect(entries[1].command).toBe("npm run build");
  });
});

describe("shell selection", () => {
  it("auto falls back to bash/zsh/fish when PSReadLine is missing", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(readHistory()).toEqual([]);
  });

  it("explicit powershell reads PSReadLine even when fallback readers are mocked empty", () => {
    vi.mocked(readFileSync).mockReturnValue("git status\nnpm test\n");
    const entries = readHistory(2000, "powershell");
    expect(entries).toHaveLength(2);
    expect(entries[0].command).toBe("npm test");
  });

  it("readPsReadLineHistory returns [] when file is absent", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(readPsReadLineHistory()).toEqual([]);
  });
});
