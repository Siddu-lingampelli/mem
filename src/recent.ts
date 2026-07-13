import { readHistory } from "./history.js";
import { maskSecrets } from "./secrets.js";
import { colorize as c } from "./output.js";

const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

export function runRecent(n = 20): void {
  const entries = readHistory();
  if (entries.length === 0) {
    console.log("No history found.");
    return;
  }

  const count = Math.min(n, entries.length);
  console.log(`\n${c("mem recent", BOLD)}`);
  console.log(`${c("Last", DIM)} ${c(String(count), BOLD)} ${c("commands", DIM)}\n`);

  const padW = String(count).length;
  for (let i = 0; i < count; i++) {
    const cmd = maskSecrets(entries[i].command);
    const idx = c(String(i + 1).padStart(padW), DIM);
    console.log(`  ${idx}. ${cmd}`);
  }

  console.log();
}
