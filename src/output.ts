import type { SearchHit } from "./types.js";
import { maskSecrets } from "./secrets.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const MAGENTA = "\x1b[35m";

const MAX_SHOWN = 20;

export function useColor(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  return process.stdout.isTTY === true;
}

function colorize(text: string, code: string) { return useColor() ? `${code}${text}${RESET}` : text; }
const dim = (s: string) => colorize(s, DIM);
const bold = (s: string) => colorize(s, BOLD);
const green = (s: string) => colorize(s, GREEN);

const SEP = dim("─".repeat(40));

/** Escape regex metacharacters. */
function esc(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Build a highlighting regex from query words (case-insensitive). */
function highlightCmd(cmd: string, query: string): string {
  const q = query.trim().toLowerCase();
  if (!q || q === "all" || q === "*") return cmd;
  const words = q.split(/[^a-z0-9]+/).filter(Boolean).filter(w => w.length >= 2);
  if (words.length === 0) return cmd;
  const pattern = words.map(w => `(${esc(w)})`).join("|");
  const re = new RegExp(pattern, "gi");
  if (!useColor()) return cmd.replace(re, "$1");
  return cmd.replace(re, `${MAGENTA}$1${RESET}`);
}

export function print(results: SearchHit[], query: string, showAll = false): void {
  if (results.length === 0) {
    console.log("No matching commands found.");
    return;
  }

  const masked = results.map((r) => ({ ...r, command: maskSecrets(r.command) }));
  const total = masked.length;
  const shown = showAll ? masked : masked.slice(0, MAX_SHOWN);

  // Header
  const suffix = total > MAX_SHOWN && !showAll
    ? dim(` — showing top ${MAX_SHOWN}`)
    : "";
  console.log(`\n${green(`${total}`)}${dim(" matches")}${suffix}`);

  if (total > MAX_SHOWN && !showAll) {
    console.log(dim(`  use --all to show all`));
  }

  console.log(SEP);

  for (const hit of shown) {
    const hl = highlightCmd(hit.command, query);
    console.log(`  ${bold(hl)}`);

    const parts: string[] = [];
    if (hit.count > 1) parts.push(`${hit.count}×`);
    if (hit.recent) parts.push("recent");
    if (parts.length) console.log(`    ${dim(parts.join(" • "))}`);
  }

  console.log(SEP);
}
