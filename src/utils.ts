import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";

/**
 * Candidate history file locations, in priority order.
 * Covers Windows PowerShell 5.1, PowerShell 7+, and VS Code's integrated
 * PowerShell host. The first existing file wins.
 * NOTE: Bash (.bash_history) is NOT listed here — it is handled by the
 * readBashHistory() fallback in history.ts, which has proper HISTTIMEFORMAT
 * and multiline command support.
 */
const CANDIDATES: string[] = [
  // Windows PowerShell 5.1 — default
  "AppData/Roaming/Microsoft/Windows/PowerShell/PSReadLine/ConsoleHost_history.txt",
  // PowerShell 7+ (pwsh) — default
  "AppData/Roaming/Microsoft/PowerShell/PSReadLine/ConsoleHost_history.txt",
  // VS Code integrated terminal running PowerShell
  "AppData/Roaming/Microsoft/PowerShell/PSReadLine/Visual Studio Code Host_history.txt",
];

/**
 * Returns the path to the first existing history file.
 * Honors PSREADLINE_HISTORY_FILE if set and non-empty (used for tests/overrides).
 * Falls back to the PowerShell 7 location when no file exists yet, so the
 * caller can decide how to respond (e.g. "No history found").
 */
export function getHistoryFilePath(): string {
  const envPath = process.env.PSREADLINE_HISTORY_FILE;
  if (envPath && envPath.length > 0) {
    return envPath;
  }

  const home = homedir();
  for (const candidate of CANDIDATES) {
    const full = join(home, candidate);
    if (existsSync(full)) {
      return full;
    }
  }

  // Nothing found yet — return the most common default so the caller can error gracefully.
  return join(home, CANDIDATES[1]);
}

/**
 * Returns candidate Zsh history paths.
 * Checks HISTFILE env var first, then default locations.
 */
export function getZshHistoryPaths(): string[] {
  const histFile = process.env.HISTFILE;
  if (histFile && histFile.length > 0 && existsSync(histFile)) {
    return [histFile];
  }
  const home = homedir();
  return [join(home, ".zsh_history"), join(home, ".histfile")];
}

/**
 * Returns candidate Fish history paths.
 * Checks XDG_DATA_HOME first, then default location.
 */
export function getFishHistoryPaths(): string[] {
  const xdg = process.env.XDG_DATA_HOME;
  if (xdg && xdg.length > 0) {
    return [join(xdg, "fish/fish_history"), join(homedir(), ".local/share/fish/fish_history")];
  }
  return [join(homedir(), ".local/share/fish/fish_history")];
}
