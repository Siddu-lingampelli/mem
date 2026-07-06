import type { SearchHit } from "./types.js";
import { maskSecrets } from "./secrets.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";

const MAX_SHOWN = 20;

export function useColor(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  return process.stdout.isTTY === true;
}

function applyDim(text: string) { return useColor() ? `${DIM}${text}${RESET}` : text; }
function bold(text: string) { return useColor() ? `${BOLD}${text}${RESET}` : text; }
function green(text: string) { return useColor() ? `${GREEN}${text}${RESET}` : text; }
function yellow(text: string) { return useColor() ? `${YELLOW}${text}${RESET}` : text; }

const SEP = applyDim("─".repeat(40));

export function print(results: SearchHit[], _query: string, showAll = false): void {
  void _query; // kept for API compatibility
  if (results.length === 0) {
    console.log("No matching commands found.");
    return;
  }

  // Mask secrets in results
  const masked = results.map((r) => ({ ...r, command: maskSecrets(r.command) }));

  const total = masked.length;
  const shown = showAll ? masked : masked.slice(0, MAX_SHOWN);

  // Header
  const suffix = total > MAX_SHOWN && !showAll
    ? `${applyDim(" — showing top ")}${MAX_SHOWN}${applyDim(", ")}${yellow(`${total} matches`)} ${applyDim(`(use `)}${bold(`--all`)}${applyDim(` to show all)`)}`
    : applyDim(` (${total} matches)`);
  console.log(`\n${bold(green(`${total}`))}${applyDim(" matches")}%s`, suffix);
  console.log(SEP);

  for (const hit of shown) {
    const freq = hit.count > 1
      ? applyDim(` • used ${hit.count}x`)
      : "";
    const recency = hit.recent ? applyDim(` • recent`) : "";

    console.log(`  ${bold(hit.command)}`);
    if (freq || recency) {
      console.log(`    ${freq}${freq && recency ? applyDim(` • `) : ""}${recency}`);
    }
  }

  console.log(SEP);
  console.log(`${applyDim(`  ${total} total commands`)}`);
}
