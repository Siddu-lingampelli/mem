import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { HistoryEntry } from "./types.js";

/**
 * Candidate .bash_history file locations, in priority order.
 * Covers Linux, macOS, Git Bash on Windows, and WSL.
 */
const CANDIDATES: string[] = [
  // Linux / macOS / Git Bash default
  ".bash_history",
  // Alternative bash configs
  ".sh_history",
];

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
 * Handles HISTTIMEFORMAT (lines starting with #<timestamp>)
 * and multiline commands.
 */
function parseBashHistory(content: string, limit: number): HistoryEntry[] {
  const lines = content.split("\n");
  const commands: string[] = [];

  let hasTimestamps = false;
  // Heuristic: check first 30 lines for timestamp pattern
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    if (/^#\d{8,}$/.test(lines[i].trim())) {
      hasTimestamps = true;
      break;
    }
  }

  if (hasTimestamps) {
    // Timestamp mode: lines prefixed with #<epoch> start a new entry
    let currentEntry: string[] = [];
    for (const line of lines) {
      if (/^#\d{8,}$/.test(line.trim())) {
        if (currentEntry.length > 0) {
          const cmd = currentEntry.join("\n").trim();
          if (cmd.length > 0) commands.push(cmd);
        }
        currentEntry = [];
      } else {
        currentEntry.push(line);
      }
    }
    // Last entry
    if (currentEntry.length > 0) {
      const cmd = currentEntry.join("\n").trim();
      if (cmd.length > 0) commands.push(cmd);
    }
  } else {
    // Plain mode: each non-empty line is a command
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 0) commands.push(trimmed);
    }
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

  const buffer = readFileSync(path);
  // .bash_history is always UTF-8, no BOM
  const raw = buffer.toString("utf-8");
  return parseBashHistory(raw, limit);
}
