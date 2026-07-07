import type { SearchHit } from "./types.js";
import { maskSecrets } from "./secrets.js";
import { ALL_KEYWORDS } from "./search.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[32m";
const MAGENTA = "\x1b[35m";
const YELLOW = "\x1b[33m";

const MAX_SHOWN = 20;

export function useColor(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  return process.stdout.isTTY === true;
}

function colorize(text: string, code: string) { return useColor() ? `${code}${text}${RESET}` : text; }
const dim = (s: string) => colorize(s, DIM);
const green = (s: string) => colorize(s, GREEN);
const yellow = (s: string) => colorize(s, YELLOW);

const SEP = dim("─".repeat(40));

/** Escape regex metacharacters. */
function esc(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlight matched words in a command.
 * Returns string with ANSI codes: matched words get BOLD+MAGENTA,
 * the rest of the command is dim.
 */
function highlightCmd(cmd: string, query: string): string {
  const q = query.trim().toLowerCase();
  if (!q || q === "*" || ALL_KEYWORDS.includes(q)) return useColor() ? dim(cmd) : cmd;

  const words = q.split(/[^a-z0-9]+/).filter(Boolean).filter(w => w.length >= 2);
  if (words.length === 0) return useColor() ? dim(cmd) : cmd;

  const pattern = words.map(w => `(${esc(w)})`).join("|");
  const re = new RegExp(pattern, "gi");

  if (!useColor()) return cmd.replace(re, "$&");

  // Split into matched and unmatched segments
  const parts: string[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cmd)) !== null) {
    if (match.index > last) {
      parts.push(dim(cmd.slice(last, match.index)));
    }
    parts.push(`${BOLD}${MAGENTA}${match[0]}${RESET}`);
    last = re.lastIndex;
  }
  if (last < cmd.length) {
    parts.push(dim(cmd.slice(last)));
  }
  return parts.join("");
}

export function print(
  results: SearchHit[],
  query: string,
  showAll = false,
  max?: number,
  durationMs?: number,
  shellSource?: string,
): void {
  if (results.length === 0) {
    const q = query.trim().toLowerCase();
    if (q && q !== "all" && q !== "*") {
      console.log(yellow("No matching commands."));
      console.log(dim(`  Try: mem "${q.slice(0, 12)}"`));
      // Suggest common nearby commands
      const sugg = ["docker", "git", "npm", "cd", "ls", "ssh", "curl", "node"];
      const filtered = sugg.filter(s => s.includes(q[0]) || q.includes(s[0]));
      const picks = filtered.length > 0 ? filtered.slice(0, 3) : sugg.slice(0, 3);
      console.log(dim(`  Try: ${picks.map(s => `mem "${s}"`).join(", ")}`));
    } else {
      console.log("No history found.");
    }
    return;
  }

  const masked = results.map((r) => ({ ...r, command: maskSecrets(r.command) }));
  const total = masked.length;
  const limit = showAll ? total : (max ?? MAX_SHOWN);
  const shown = masked.slice(0, limit);

  // Header with timing
  const headerParts = [`${green(`${total}`)}${dim(" matches")}`];
  if (durationMs !== undefined) {
    headerParts.push(dim(`${durationMs}ms`));
  }
  const suffix = total > limit && !showAll
    ? dim(` — showing top ${limit}`)
    : "";
  console.log(`\n${headerParts.join(" • ")}${suffix}`);

  if (total > limit && !showAll) {
    console.log(dim(`  use --all to show all`));
  }

  console.log(SEP);

  for (const hit of shown) {
    const hl = highlightCmd(hit.command, query);
    // Indent continuation lines for multi-line commands
    const lines = hl.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const prefix = i === 0 ? "  " : "    ";
      console.log(`${prefix}${lines[i]}`);
    }

    const parts: string[] = [];
    if (hit.count > 1) parts.push(`${hit.count}×`);
    if (shellSource) parts.push(shellSource);
    if (hit.recent) parts.push("recent");
    if (parts.length) console.log(`    ${dim(parts.join(" • "))}`);
  }

  console.log(SEP);
}
