import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { HistoryEntry } from "./types.js";

/**
 * Candidate Fish history file locations.
 * Checks XDG_DATA_HOME first, then default location.
 */
export function getFishHistoryPath(): string {
  const xdg = process.env.XDG_DATA_HOME;
  if (xdg && xdg.length > 0) {
    const candidate = join(xdg, "fish/fish_history");
    if (existsSync(candidate)) return candidate;
  }

  const home = homedir();
  const defaultPath = join(home, ".local/share/fish/fish_history");
  if (existsSync(defaultPath)) return defaultPath;

  return "";
}

/**
 * Parse Fish history YAML-like content into HistoryEntry[].
 * Format:
 *   - cmd: command text
 *     when: 1234567890
 *     paths:
 *       - /some/path
 */
function parseFishHistory(content: string, limit: number): HistoryEntry[] {
  const lines = content.split(/\r?\n/);
  const commands: string[] = [];
  let currentCmd: string | null = null;

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Start of a new entry
    const cmdMatch = trimmed.match(/^-\s+cmd:\s*(.*)$/);
    if (cmdMatch) {
      if (currentCmd !== null && currentCmd.length > 0) {
        commands.push(currentCmd.trim());
      }
      currentCmd = cmdMatch[1];
      continue;
    }

    // Timestamp or path line — skip, but commit current command
    if (/^\s+when:\s*\d+/.test(trimmed) || /^\s+paths?:/.test(trimmed)) {
      if (currentCmd !== null && currentCmd.length > 0) {
        commands.push(currentCmd.trim());
        currentCmd = null;
      }
      continue;
    }

    // Continuation of multi-line command (indented text without a key)
    if (currentCmd !== null && /^\s+\S/.test(trimmed)) {
      currentCmd += "\n" + trimmed.trim();
      continue;
    }
  }

  // Flush last entry
  if (currentCmd !== null && currentCmd.length > 0) {
    commands.push(currentCmd.trim());
  }

  // Newest-first, respect limit
  const entries: HistoryEntry[] = [];
  for (let i = commands.length - 1; i >= 0 && entries.length < limit; i--) {
    entries.push({ command: commands[i] });
  }

  return entries;
}

export function readFishHistory(limit = 2000): HistoryEntry[] {
  const path = getFishHistoryPath();
  if (!path) return [];

  try {
    const buffer = readFileSync(path);
    const raw = buffer.toString("utf-8");
    return parseFishHistory(raw, limit);
  } catch {
    return [];
  }
}
