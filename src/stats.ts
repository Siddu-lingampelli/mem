import { readHistory } from "./history.js";
import { preprocess } from "./search.js";
import { useColor } from "./output.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const YELLOW = "\x1b[33m";

function c(t: string, code: string) { return useColor() ? `${code}${t}${RESET}` : t; }

export function runStats(top = 10): void {
  const entries = readHistory();
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
    console.log(`  ${c(rank, DIM)}. ${e.command.padEnd(30)} ${count} ${bar}`);
  }

  console.log();
}
