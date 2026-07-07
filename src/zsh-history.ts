import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { HistoryEntry } from "./types.js";

/**
 * Candidate Zsh history file locations.
 * Honors HISTFILE env var, then tries defaults.
 */
const CANDIDATES: string[] = [
  ".zsh_history",
  ".histfile",
];

/** Regex: matches ": <digits>:<digits>;<cmd>" */
const ZSH_LINE_RE = /^:\s*\d+:\d+;(.*)$/;

/**
 * Returns the first existing Zsh history path.
 * Honors HISTFILE env var if set.
 */
export function getZshHistoryPath(): string {
  const histFile = process.env.HISTFILE;
  if (histFile && histFile.length > 0 && existsSync(histFile)) {
    return histFile;
  }

  const home = homedir();
  for (const candidate of CANDIDATES) {
    const full = join(home, candidate);
    if (existsSync(full)) return full;
  }

  return "";
}

/**
 * Parse Zsh history content into HistoryEntry[].
 * Format: : <timestamp>:<duration>;<command>
 */
function parseZshHistory(content: string, limit: number): HistoryEntry[] {
  const lines = content.split(/\r?\n/);
  const commands: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = ZSH_LINE_RE.exec(trimmed);
    if (match) {
      const cmd = match[1].trim();
      if (cmd.length > 0) commands.push(cmd);
    } else {
      // Line doesn't match zsh format — treat as raw command
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

export function readZshHistory(limit = 2000): HistoryEntry[] {
  const path = getZshHistoryPath();
  if (!path) return [];

  try {
    const buffer = readFileSync(path);
    const raw = buffer.toString("utf-8");
    return parseZshHistory(raw, limit);
  } catch {
    return [];
  }
}
