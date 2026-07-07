import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { HistoryEntry } from "./types.js";

/**
 * Candidate .bash_history file locations, in priority order.
 * Covers Linux, macOS, Git Bash on Windows.
 */
const CANDIDATES: string[] = [
  ".bash_history",
  ".sh_history",
];

/** Regex: ASCII-only digits (avoid \d matching Unicode digits). */
const TS_RE = /^#[0-9]{8,}\s*$/;

/**
 * Returns the first existing .bash_history path.
 * Honors HISTFILE env var if set.
 */
export function getBashHistoryPath(): string {
  const histFile = process.env.HISTFILE;
  if (histFile && histFile.length > 0 && existsSync(histFile)) {
    return histFile;
  }

  const home = homedir();

  for (const candidate of CANDIDATES) {
    const full = join(home, candidate);
    if (existsSync(full)) {
      return full;
    }
  }

  return "";
}

/**
 * Parse .bash_history content into HistoryEntry[].
 * Uses per-line detection for HISTTIMEFORMAT (lines starting with #<epoch>)
 * instead of a fragile 30-line heuristic.
 */
function parseBashHistory(content: string, limit: number): HistoryEntry[] {
  const lines = content.split(/\r?\n/);
  const commands: string[] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (TS_RE.test(line)) {
      // Timestamp line — flush current entry, start new one
      if (current !== null) {
        const cmd = current.join("\n").trim();
        if (cmd.length > 0) commands.push(cmd);
      }
      current = []; // enters "timestamp mode" — subsequent lines are one entry
    } else if (current !== null) {
      // In timestamp mode: accumulate as part of current entry
      current.push(line);
    } else {
      // Plain mode: each line is a separate command
      const trimmed = line.trim();
      if (trimmed.length > 0) commands.push(trimmed);
    }
  }

  // Flush last entry (timestamp mode)
  if (current !== null && current.length > 0) {
    const cmd = current.join("\n").trim();
    if (cmd.length > 0) commands.push(cmd);
  }

  // Newest-first, respect limit
  const entries: HistoryEntry[] = [];
  for (let i = commands.length - 1; i >= 0 && entries.length < limit; i--) {
    entries.push({ command: commands[i] });
  }

  return entries;
}

export function readBashHistory(limit = 2000): HistoryEntry[] {
  const path = getBashHistoryPath();
  if (!path) return [];

  try {
    const buffer = readFileSync(path);
    const raw = buffer.toString("utf-8");
    return parseBashHistory(raw, limit);
  } catch {
    return [];
  }
}
