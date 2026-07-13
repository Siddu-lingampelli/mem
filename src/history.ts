import { readFileSync, existsSync } from "fs";
import type { HistoryEntry } from "./types.js";
import { getHistoryFilePath } from "./utils.js";
import { readBashHistory } from "./bash-history.js";
import { readZshHistory } from "./zsh-history.js";
import { readFishHistory } from "./fish-history.js";

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

export function readHistory(limit = 2000): HistoryEntry[] {
  const path = getHistoryFilePath();
  if (existsSync(path)) {
    let buffer;
    try { buffer = readFileSync(path); }
    catch {
      const bash = readBashHistory(limit);
      if (bash.length > 0) return bash;
      const zsh = readZshHistory(limit);
      if (zsh.length > 0) return zsh;
      return readFishHistory(limit);
    }
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
  }

  // Fallback chain: Bash → Zsh → Fish
  const bash = readBashHistory(limit);
  if (bash.length > 0) return bash;

  const zsh = readZshHistory(limit);
  if (zsh.length > 0) return zsh;

  return readFishHistory(limit);
}
