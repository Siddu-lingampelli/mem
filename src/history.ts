import { readFileSync, existsSync } from "fs";
import type { HistoryEntry } from "./types.js";
import { getHistoryFilePath } from "./utils.js";

/**
 * Detects BOM (Byte Order Mark) in buffer and returns the appropriate encoding.
 * Returns the correct encoding for UTF-8 BOM, UTF-16 LE BOM, or defaults to utf-8.
 */
function detectEncoding(buffer: Buffer): "utf-8" | "utf8" | "utf16le" {
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
  if (!existsSync(path)) {
    return [];
  }

  const buffer = readFileSync(path);
  const encoding = detectEncoding(buffer);
  const raw = buffer.toString(encoding);
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
