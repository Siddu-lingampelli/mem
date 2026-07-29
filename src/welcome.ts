import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { colorize as c } from "./output.js";
import { BOLD, DIM, CYAN, GREEN } from "./ansi.js";

function flagFile(): string {
  return join(homedir(), ".mem-welcome");
}

// In-memory memo: survives within a process even if the flag write fails
// (read-only HOME, permission denied, sandbox). Keeps the welcome from
// re-firing for the rest of this invocation when we can't persist.
let shownThisProcess = false;

/** Render the first-run welcome. */
function renderWelcome(version: string): string[] {
  const w = 36;
  const pad = (s: string) => c("│ " + s + " ".repeat(Math.max(0, w - 1 - s.length)) + "│", DIM);

  return [
    "",
    c("┌" + "─".repeat(w) + "┐", CYAN),
    pad(c(`mem v${version}`, BOLD)),
    pad("Never lose a terminal command."),
    c("└" + "─".repeat(w) + "┘", CYAN),
    "",
    c("Quick Start", BOLD),
    `  ${c("mem", CYAN)} "docker"`,
    `  ${c("mem", CYAN)} "git"`,
    "",
    c("Supports", BOLD),
    `  ${c("✓", GREEN)} PowerShell`,
    `  ${c("✓", GREEN)} Bash`,
    `  ${c("✓", GREEN)} Zsh`,
    `  ${c("✓", GREEN)} Fish`,
    "",
    `${c("Run", DIM)} ${c("mem --help", CYAN)} ${c("anytime.", DIM)}`,
    "",
  ];
}

export function hasSeenWelcome(): boolean {
  return shownThisProcess || existsSync(flagFile());
}

/** Test-only: clear the in-process memo so a single vitest worker can
 *  re-run welcome scenarios deterministically across tests, regardless of
 *  declaration order or `--shuffle`. Has no effect in production code. */
export function resetWelcomeState(): void {
  shownThisProcess = false;
}

export function showWelcome(version: string): Promise<void> {
  if (shownThisProcess) return Promise.resolve();
  shownThisProcess = true;

  const lines = renderWelcome(version);
  for (const l of lines) console.log(l);

  // Persist the flag so subsequent bare `mem` invocations don't re-fire.
  // Best-effort: on read-only HOME / sandbox / permission denied, the
  // in-memory memo above still suppresses the banner for the rest of this
  // process.
  try {
    writeFileSync(flagFile(), "", "utf-8");
  } catch {
    // No diagnostic; the welcome already printed and won't repeat this run.
  }

  // Async-typed so a future "Press any key" gate can layer on without
  // rippling into the caller signature in cli.ts.
  return Promise.resolve();
}

