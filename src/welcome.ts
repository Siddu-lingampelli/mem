import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { colorize as c } from "./output.js";

const FLAG_FILE = join(homedir(), ".mem-welcome");
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";

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
  return existsSync(FLAG_FILE);
}

export function showWelcome(version: string = "1.2.5"): Promise<void> {
  const lines = renderWelcome(version);
  for (const l of lines) console.log(l);

  // ponytail: many terminals (MINGW64, msys, spawned subprocesses) report stdin
  // as a pipe even on a TTY — 'data' never fires. The original readSync blocked
  // forever on those; v2.2.3 patch removed the hang but the "Press Enter…" banner
  // misled users into waiting. Drop the prompt entirely — the banner is informational,
  // not a gate. The function stays async-typed so a future "Press any key" can
  // layer on without rippling into the caller signature in cli.ts.
  return Promise.resolve();

  try { writeFileSync(FLAG_FILE, "", "utf-8"); } catch { /* best-effort */ }
}
