import { readFileSync, existsSync } from "fs";
import type { HistoryEntry } from "./types.js";
import { getHistoryFilePath } from "./utils.js";
import { readBashHistory } from "./bash-history.js";
import { readZshHistory } from "./zsh-history.js";
import { readFishHistory } from "./fish-history.js";

/**
 * Supported shell data sources. "auto" (default) prefers PSReadLine when
 * present and falls back through Bash → Zsh → Fish. Explicit shell names
 * skip PSReadLine entirely, so users on Windows who use Git Bash, Zsh, or
 * Fish can read the log they're actually using.
 */
export type ShellSource = "auto" | "powershell" | "bash" | "zsh" | "fish";

export function shellLabel(s: ShellSource): string {
  if (s === "powershell") return "pwsh";
  if (s === "bash") return "bash";
  if (s === "zsh") return "zsh";
  if (s === "fish") return "fish";
  return "auto";
}

/**
 * Detects BOM (Byte Order Mark) in buffer and returns the appropriate encoding.
 * Returns the correct encoding for UTF-8 BOM, UTF-16 LE BOM, or defaults to utf-8.
 */
export function detectEncoding(buffer: Buffer): "utf-8" | "utf8" | "utf16le" {
  // UTF-8 BOM: EF BB BF
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return "utf8";
  }
  // UTF-16 LE BOM: FF FE
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return "utf16le";
  }
  return "utf-8";
}

export function readPsReadLineHistory(limit = 2000): HistoryEntry[] {
  const path = getHistoryFilePath();
  if (!existsSync(path)) return [];
  try {
    const buffer = readFileSync(path);
    const encoding = detectEncoding(buffer);
    let raw = buffer.toString(encoding);
    if (raw.charCodeAt(0) === 0xFEFF) raw = raw.slice(1);
    const lines = raw.split(/\r?\n/);

    const entries: HistoryEntry[] = [];
    for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
      const cmd = lines[i].trim();
      if (cmd.length > 0) {
        entries.push({ command: cmd });
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Resolve which parser to use and run it.
 *
 *  - Explicit shell names bypass PSReadLine (fixes the case where a Windows
 *    user with Git Bash, Zsh, or Fish always got the PSReadLine history no
 *    matter what they exported in HISTFILE).
 *  - `auto`: try PSReadLine; if it yields nothing (absent file, locked,
 *    parsing error) walk the Bash → Zsh → Fish fallback chain.
 */
export function readHistory(limit = 2000, shell: ShellSource = "auto"): HistoryEntry[] {
  if (shell === "powershell") return readPsReadLineHistory(limit);
  if (shell === "bash") return readBashHistory(limit);
  if (shell === "zsh") return readZshHistory(limit);
  if (shell === "fish") return readFishHistory(limit);

  // auto: try PSReadLine first, walk Bash → Zsh → Fish when it finds
  // nothing (absent file, locked, parsing error, or genuinely empty).
  const ps = readPsReadLineHistory(limit);
  if (ps.length > 0) return ps;

  const bash = readBashHistory(limit);
  if (bash.length > 0) return bash;
  const zsh = readZshHistory(limit);
  if (zsh.length > 0) return zsh;
  return readFishHistory(limit);
}
