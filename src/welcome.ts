import { existsSync, writeFileSync } from "fs";
import { isatty } from "tty";
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
    c("Press Enter to continue...", DIM),
  ];
}

export function hasSeenWelcome(): boolean {
  return existsSync(FLAG_FILE);
}

export function showWelcome(version = "1.2.5"): void {
  const lines = renderWelcome(version);
  for (const l of lines) console.log(l);

  // ponytail: original `readSync` blocked silently when stdin was piped.
  // Only wait for a keypress when stdin is a real TTY; otherwise the welcome
  // text is enough — drop the read.
  if (isatty(0)) {
    try { process.stdin.read(1); } catch { /* best-effort */ }
  }

  try { writeFileSync(FLAG_FILE, "", "utf-8"); } catch { /* best-effort */ }
}
