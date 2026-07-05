import type { SearchResult } from "./types.js";

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const MAGENTA = "\x1b[35m";

export function useColor(): boolean {
  if (process.env.NO_COLOR !== undefined) return false;
  return process.stdout.isTTY === true;
}

function color(text: string) {
  return `${MAGENTA}${text}${RESET}`;
}

export function dim(text: string) {
  return `${DIM}${text}${RESET}`;
}

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHighlightRegex(query: string): RegExp | null {
  const trimmed = query.trim();
  if (trimmed.length === 0) return null;

  const pattern = trimmed.split(/\s+/).filter(Boolean).map(escapeRegExp).join("|");
  if (pattern.length === 0) return null;

  return new RegExp(`(${pattern})`, "gi");
}

function highlight(command: string, regex: RegExp | null): string {
  if (!regex) return command;
  if (useColor()) {
    return command.replace(regex, color("$1"));
  }
  return command;
}

export function print(results: SearchResult[], query: string): void {
  if (results.length === 0) {
    console.log("No matching commands found.");
    return;
  }

  const MAX = 50;
  const shown = results.slice(0, MAX);

  const plural = results.length === 1 ? "command" : "commands";
  const more = results.length > MAX ? ` (showing first ${MAX})` : "";
  console.log(`\nFound ${results.length} matching ${plural}${more}\n`);

  const regex = buildHighlightRegex(query);
  const applyDim = useColor() ? dim : (s: string) => s;
  const sep = applyDim("--------------------------------");

  for (let i = 0; i < shown.length; i++) {
    const r = shown[i];
    const rank = applyDim(`${i + 1}.`);
    const hl = highlight(r.command, regex);

    console.log(`${rank}\n\n${hl}`);
    console.log(`${sep}\n`);
  }
}
