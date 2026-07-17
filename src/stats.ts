import { readHistory, shellLabel, type ShellSource } from "./history.js";
import { preprocess } from "./search.js";
import { colorize as c } from "./output.js";
import { maskSecrets } from "./secrets.js";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const YELLOW = "\x1b[33m";

export function runStats(top = 10, shell: ShellSource = "auto"): void {
  const entries = readHistory(2000, shell);
  if (entries.length === 0) {
    console.log("No history found.");
    return;
  }

  const cached = preprocess(entries);
  const total = entries.length;
  const unique = cached.length;

  // Sort by count descending, take top N
  const sorted = [...cached].sort((a, b) => b.count - a.count || a.command.localeCompare(b.command));
  const shown = sorted.slice(0, top);

  console.log(`\n${c(`mem stats`, BOLD)}`);

  // Summary line
  console.log(`${c("History", DIM)}  ${total.toLocaleString()} commands (${unique.toLocaleString()} unique)`);
  if (shell !== "auto") console.log(`${c("Shell", DIM)}   ${shellLabel(shell)}`);

  // Top commands
  console.log(`\n${c("Top", DIM)} ${c(String(top), YELLOW)} ${c("commands", DIM)}`);
  const rankW = String(top).length;
  const maxCount = shown[0]?.count ?? 0;
  const barW = 20;

  for (let i = 0; i < shown.length; i++) {
    const e = shown[i];
    const rank = String(i + 1).padStart(rankW);
    const barLen = Math.round((e.count / maxCount) * barW);
    const bar = c("█".repeat(Math.max(1, barLen)), DIM);
    const count = c(String(e.count), YELLOW);
    const cmd = maskSecrets(e.command);
    console.log(`  ${c(rank, DIM)}. ${cmd.padEnd(30)} ${count} ${bar}`);
  }

  console.log();
}
