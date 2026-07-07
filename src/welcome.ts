import { existsSync, writeFileSync, readSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { useColor } from "./output.js";

const FLAG_FILE = join(homedir(), ".mem-welcome");
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";

function c(t: string, code: string) { return useColor() ? `${code}${t}${RESET}` : t; }

/** Render the welcome box with centered text. */
function renderWelcome(version: string): string[] {
  const w = 38; // interior width
  const L = (s: string) => c("│ " + s + " ".repeat(Math.max(0, w - 1 - s.length)) + "│", DIM);

  const lines = [
    "",
    c("╭" + "─".repeat(w + 2) + "╮", CYAN),
    L(c(`mem v${version}`, BOLD)),
    L(""),
    L("Search your terminal history"),
    L("instantly."),
    c("╰" + "─".repeat(w + 2) + "╯", CYAN),
    "",
    c("Quick Start", BOLD),
    `  ${c("mem", CYAN)} "docker"`,
    `  ${c("mem", CYAN)} "git"`,
    `  ${c("mem", CYAN)} "npm"`,
    "",
    c("Help", BOLD),
    `  ${c("mem", CYAN)} --help`,
    "",
    c("Supported", BOLD),
    `  ${c("✓", GREEN)} PowerShell`,
    `  ${c("✓", GREEN)} Bash`,
    `  ${c("✓", GREEN)} Zsh`,
    `  ${c("✓", GREEN)} Fish`,
    "",
    c("Press Enter to continue...", DIM),
  ];
  return lines;
}

/** Has the welcome screen been shown before? */
export function hasSeenWelcome(): boolean {
  return existsSync(FLAG_FILE);
}

/** Show the first-run welcome screen and wait for Enter. */
export function showWelcome(version = "1.2.5"): void {
  const lines = renderWelcome(version);
  for (const l of lines) console.log(l);

  // Synchronously wait for a single Enter press
  try {
    const buf = Buffer.alloc(1);
    readSync(process.stdin.fd, buf, 0, 1, null);
  } catch {
    // stdin unavailable (piped, non-TTY), just continue
  }

  // Mark as seen
  try { writeFileSync(FLAG_FILE, "", "utf-8"); } catch { /* best-effort */ }
}
