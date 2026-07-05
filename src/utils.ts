import { homedir } from "os";
import { join } from "path";

/**
 * Returns the path to the PSReadLine history file.
 * Checks the env var first (if set and non-empty), then tries
 * PowerShell 7 location, then falls back to Windows PowerShell 5.1.
 */
export function getHistoryFilePath(): string {
  const envPath = process.env.PSREADLINE_HISTORY_FILE;
  if (envPath && envPath.length > 0) {
    return envPath;
  }

  const home = homedir();
  return join(home, "AppData", "Roaming", "Microsoft", "PowerShell", "PSReadLine", "ConsoleHost_history.txt");
}
