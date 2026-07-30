#!/usr/bin/env node

import { createRequire } from "node:module";
import { program, Command } from "commander";
import { readHistory, shellLabel, type ShellSource } from "./history.js";
import { search } from "./search.js";
import { print, useColor } from "./output.js";
import { runBench } from "./bench.js";
import { runStats } from "./stats.js";
import { runRecent } from "./recent.js";
import { hasSeenWelcome, showWelcome } from "./welcome.js";
import { RESET, BOLD, DIM, CYAN } from "./ansi.js";

// Resolve the package version from package.json so the binary and the
// npm registry can never drift. Both the require handle and the lookup
// are wrapped so that a missing or malformed package.json falls back
// cleanly instead of throwing at module load time (which would break
// every test that imports this file).
function readVersion(): string {
  try {
    const requirePkg = createRequire(import.meta.url);
    const pkg = requirePkg("../package.json") as { version?: string };
    const v = pkg.version;
    // Treat empty string the same as missing — `??` only catches null/undefined.
    return v && v.length > 0 ? v : "0.0.0";
  } catch {
    return "0.0.0";
  }
}
const VERSION = readVersion();

export function stripAnsi(text: string): string {
  // Handles simple SGR (\x1b[31m), multi-param (\x1b[1;31m),
  // 256-color (\x1b[38;5;231m), true-color (\x1b[38;2;255;0;0m),
  // and common non-SGR escape sequences (\x1b[K, \x1b[H, \x1b[?25l, etc.)
  return text.replace(/\x1b\[[0-9;:?]*[a-zA-Z]/g, "");
}

export function paint(text: string): string {
  return useColor() ? text : stripAnsi(text);
}

/** Parse a user-supplied integer, returning fallback on invalid input.
 *  Rejects decimals, scientific notation, and trailing garbage — `parseInt`
 *  silently truncates these, which would surprise users typing `--max 1.5`
 *  expecting an error and getting 1. */
export function parseCount(val: string | undefined, fallback?: number): number | undefined {
  if (val === undefined || val.length === 0) return fallback;
  // Trim surrounding whitespace (CLI users often type `--max  5`), then
  // require strict digits-only. Rejects decimals, scientific notation,
  // leading signs, and trailing garbage — parseInt would silently
  // truncate these.
  const trimmed = val.trim();
  if (!/^[0-9]+$/.test(trimmed)) return fallback;
  const n = parseInt(trimmed, 10);
  return n < 1 ? fallback : n;
}

/** Parse a --shell flag value into a ShellSource, defaulting to "auto".
 *  Accepts any casing (`Bash`, `ZSH`, `pwsh`) since users naturally mix them. */
export function parseShell(val: string | undefined): ShellSource {
  const allowed: Record<string, ShellSource> = {
    auto: "auto",
    powershell: "powershell",
    pwsh: "powershell",
    bash: "bash",
    zsh: "zsh",
    fish: "fish",
  };
  if (val) {
    const key = val.toLowerCase();
    if (key in allowed) return allowed[key];
  }
  return "auto";
}

export function runSearch(
  query: string,
  showAll = false,
  maxCount?: number,
  shell: ShellSource = "auto",
): void {
  try {
    const entries = readHistory(2000, shell);
    if (entries.length === 0) {
      console.error("No history found.");
      process.exit(1);
    }
    const results = search(entries, query);
    if (results.length === 0) {
      console.log("No matching commands found.");
      return;
    }
    print(results, query, showAll, maxCount, undefined, shellLabel(shell));
  } catch (err) {
    console.error("Error reading history:", (err as Error).message);
    process.exit(1);
  }
}

// Custom help formatter
function customHelp(): string {
  const header = paint(
    [`${BOLD}${CYAN}mem${RESET} v${VERSION}`, "", "Search your terminal history instantly."].join(
      "\n",
    ),
  );

  const usage = paint(
    [
      `${DIM}Usage${RESET}`,
      `${BOLD}mem${RESET} <query>`,
      `${BOLD}mem${RESET} ${BOLD}search${RESET} <query>`,
    ].join("\n"),
  );

  const commands = paint(
    [
      `${DIM}Commands${RESET}`,
      `${BOLD}search${RESET} <query>    Search your terminal history`,
      `${BOLD}stats${RESET}             Show command usage statistics`,
      `${BOLD}bench${RESET}             Benchmark history parsing and search`,
      `${BOLD}recent${RESET} [-n N]     Show newest N commands (default 20)`,
      `${BOLD}index${RESET}             ${DIM}(coming in V2)${RESET}`,
      `${BOLD}sync${RESET}              ${DIM}(coming in V2)${RESET}`,
    ].join("\n"),
  );

  const examples = paint(
    [
      `${DIM}Examples${RESET}`,
      `${BOLD}mem${RESET} "docker compose"`,
      `${BOLD}mem${RESET} "git rebase -i"`,
      `${BOLD}mem search${RESET} "npm run build"`,
    ].join("\n"),
  );

  const options = paint(
    [
      `${DIM}Options${RESET}`,
      `${BOLD}--all${RESET}            Show every match without truncation`,
      `${BOLD}-n, --max <n>${RESET}    Show at most N results`,
      `${BOLD}--shell <name>${RESET}  Source shell (auto|powershell|bash|zsh|fish)`,
      `${BOLD}-V, --version${RESET}  output the version number`,
      `${BOLD}-h, --help${RESET}     display help for command`,
    ].join("\n"),
  );

  return `${header}

${usage}

${commands}

${examples}

${options}`;
}

const searchCmd = new Command("search");
searchCmd
  .argument("<query>", "Search query")
  .option("--all", "Show every matching command without truncation")
  .option("-n, --max <n>", "Show at most N results")
  .option("--shell <name>", "Source shell: auto | powershell | bash | zsh | fish", "auto")
  .enablePositionalOptions()
  .description("Search your terminal history")
  .action((query: string, opts: { all?: boolean; max?: string; shell?: string }) => {
    runSearch(
      query,
      opts.all ?? false,
      opts.max ? parseCount(opts.max) : undefined,
      parseShell(opts.shell),
    );
  });

const benchCmd = new Command("bench");
benchCmd
  .description("Benchmark history parsing and search performance")
  .option("-l, --limit <n>", "History read limit", "50000")
  .option("--shell <name>", "Source shell: auto | powershell | bash | zsh | fish", "auto")
  .enablePositionalOptions()
  .action((opts: { limit?: string; shell?: string }) => {
    const limit = parseCount(opts.limit, 50000) ?? 50000;
    runBench(limit, parseShell(opts.shell));
  });

const statsCmd = new Command("stats");
statsCmd
  .description("Show history statistics (top commands, usage counts)")
  .option("-n, --top <n>", "Number of top commands", "10")
  .option("--shell <name>", "Source shell: auto | powershell | bash | zsh | fish", "auto")
  .action((opts: { top?: string; shell?: string }) => {
    const n = parseInt(opts.top ?? "10", 10);
    runStats(Number.isNaN(n) || n < 1 ? 10 : n, parseShell(opts.shell));
  });

const recentCmd = new Command("recent");
recentCmd
  .description("Show newest N commands")
  .option("-n, --max <n>", "Number of recent commands", "20")
  .option("--shell <name>", "Source shell: auto | powershell | bash | zsh | fish", "auto")
  .action((opts: { max?: string; shell?: string }) => {
    runRecent(opts.max ? parseCount(opts.max, 20) : 20, parseShell(opts.shell));
  });

// Stub commands for V2 preview
function stub(name: string): Command {
  const cmd = new Command(name);
  cmd.description(`${name} command (coming in V2)`);
  cmd.action(() => {
    console.error(`'mem ${name}' is coming in V2. Only 'mem search' is available in V1.`);
    process.exit(1);
  });
  return cmd;
}

program
  .name("mem")
  .addCommand(searchCmd)
  .addCommand(benchCmd)
  .addCommand(statsCmd)
  .addCommand(recentCmd)
  .addCommand(stub("index"))
  .addCommand(stub("sync"))
  .argument("[query]", "Search query")
  .option("--all", "Show every matching command without truncation")
  .option("-n, --max <n>", "Show at most N results")
  .action(async (query: string | undefined, opts: { all?: boolean; max?: string }) => {
    if (query === undefined) {
      if (!hasSeenWelcome()) {
        await showWelcome(VERSION);
        return;
      }
      program.outputHelp();
      return;
    }
    runSearch(query, opts.all ?? false, opts.max ? parseCount(opts.max) : undefined);
  });

// Only run CLI startup when executed directly (not when imported for testing)
import { fileURLToPath } from "url";
import { resolve, relative } from "path";
const isMain =
  process.argv[1] && relative(resolve(process.argv[1]), fileURLToPath(import.meta.url)) === "";

if (isMain) {
  // Override the default help information
  program.helpInformation = () => paint(customHelp());

  // Handle --version and -V with custom formatting via pre-parse scan.
  program.exitOverride();
  const idx = process.argv.indexOf("--version");
  const idxShort = process.argv.indexOf("-V");
  if (idx > 0 || idxShort > 0) {
    console.log(
      paint(
        [
          `${CYAN}${BOLD}mem${RESET} ${DIM}v${VERSION}${RESET}`,
          `${DIM}Search your terminal history instantly.${RESET}`,
        ].join("\n"),
      ),
    );
    process.exit(0);
  }

  // Suppress Commander's help-throws-after-display noise
  try {
    program.parse();
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code;
    if (code === "commander.helpDisplayed") {
      process.exit(0);
    }
    // Any other Commander error (unknown option, missing argument, etc.)
    // surfaces here; show the message and exit non-zero.
    console.error(paint(`${DIM}Error:${RESET} ${(e as Error).message}`));
    program.outputHelp();
    process.exit(1);
  }
}
