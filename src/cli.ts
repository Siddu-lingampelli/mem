#!/usr/bin/env node

import { program, Command } from "commander";
import { readHistory } from "./history.js";
import { search } from "./search.js";
import { print, useColor } from "./output.js";
import { runBench } from "./bench.js";
import { hasSeenWelcome, showWelcome } from "./welcome.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";

const VERSION = "1.2.4";

function stripAnsi(text: string): string {
  // Handles simple SGR (\x1b[31m), multi-param (\x1b[1;31m),
  // 256-color (\x1b[38;5;231m), true-color (\x1b[38;2;255;0;0m),
  // and common non-SGR escape sequences (\x1b[K, \x1b[H, \x1b[?25l, etc.)
  return text.replace(/\x1b\[[0-9;:?]*[a-zA-Z]/g, "");
}

function paint(text: string): string {
  return useColor() ? text : stripAnsi(text);
}

let showAll = false;
let maxCount: number | undefined;

/** Parse a user-supplied integer, returning fallback on invalid input. */
function parseCount(val: string | undefined, fallback?: number): number | undefined {
  if (val === undefined || val.length === 0) return fallback;
  const n = parseInt(val, 10);
  return Number.isNaN(n) || n < 1 ? fallback : n;
}

function runSearch(query: string): void {
  try {
    const entries = readHistory();
    if (entries.length === 0) {
      console.error("No history found.");
      process.exit(1);
    }
    const results = search(entries, query);
    if (results.length === 0) {
      console.log("No matching commands found.");
      return;
    }
    print(results, query, showAll, maxCount);
  } catch (err) {
    console.error("Error reading history:", (err as Error).message);
    process.exit(1);
  }
}

// Custom help formatter
function customHelp(): string {
  const header = paint([
    `${BOLD}${CYAN}mem${RESET} v${VERSION}`,
    "",
    "Search your terminal history instantly."
  ].join("\n"));

  const usage = paint([
    `${DIM}Usage${RESET}`,
    `${BOLD}mem${RESET} <query>`,
    `${BOLD}mem${RESET} ${BOLD}search${RESET} <query>`
  ].join("\n"));

  const commands = paint([
    `${DIM}Commands${RESET}`,
    `${BOLD}search${RESET} <query>    Search your terminal history`,
    `${BOLD}bench${RESET}             Benchmark history parsing and search`,
    `${BOLD}index${RESET}             ${DIM}(coming in V2)${RESET}`,
    `${BOLD}sync${RESET}              ${DIM}(coming in V2)${RESET}`,
    `${BOLD}stats${RESET}             ${DIM}(coming in V2)${RESET}`
  ].join("\n"));

  const examples = paint([
    `${DIM}Examples${RESET}`,
    `${BOLD}mem${RESET} "docker compose"`,
    `${BOLD}mem${RESET} "git rebase -i"`,
    `${BOLD}mem search${RESET} "npm run build"`
  ].join("\n"));

  const options = paint([
    `${DIM}Options${RESET}`,
    `${BOLD}--all${RESET}            Show every match without truncation`,
    `${BOLD}-n, --max <n>${RESET}    Show at most N results`,
    `${BOLD}-V, --version${RESET}  output the version number`,
    `${BOLD}-h, --help${RESET}     display help for command`,
  ].join("\n"));

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
  .description("Search your terminal history")
  .action((query: string, opts: { all?: boolean; max?: string }) => {
    showAll = opts.all ?? false;
    maxCount = opts.max ? parseCount(opts.max) : undefined;
    runSearch(query);
  });

const benchCmd = new Command("bench");
benchCmd
  .description("Benchmark history parsing and search performance")
  .option("-l, --limit <n>", "History read limit", "50000")
  .action((opts: { limit?: string }) => {
    const limit = parseCount(opts.limit, 50000) ?? 50000;
    runBench(limit);
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
  .addCommand(stub("index"))
  .addCommand(stub("sync"))
  .addCommand(stub("stats"))
  .argument("[query]", "Search query")
  .option("--all", "Show every matching command without truncation")
  .option("-n, --max <n>", "Show at most N results")
  .action((query: string | undefined, opts: { all?: boolean; max?: string }) => {
    if (query === undefined) {
      if (!hasSeenWelcome()) {
        showWelcome(VERSION);
      }
      program.outputHelp();
      return;
    }
    showAll = opts.all ?? false;
    maxCount = opts.max ? parseCount(opts.max) : undefined;
    runSearch(query);
  });

// Override the default help information
program.helpInformation = () => paint(customHelp());

// Handle --version and -V with custom formatting via pre-parse scan.
// This runs before Commander processes subcommand args, so there's no
// hijacking risk — Commander never sees the flag.
program.exitOverride();
const idx = process.argv.indexOf("--version");
const idxShort = process.argv.indexOf("-V");
if (idx > 0 || idxShort > 0) {
  console.log(paint([
    `${CYAN}${BOLD}mem${RESET} ${DIM}v${VERSION}${RESET}`,
    `${DIM}Search your terminal history instantly.${RESET}`,
  ].join("\n")));
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
  if (
    code === "commander.missingArgument" ||
    code === "commander.unknownOption" ||
    code === "commander.unknownCommand" ||
    code === "commander.invalidArgument" ||
    code === "commander.optionMissingArgument" ||
    code === "commander.missingMandatoryOptionValue" ||
    code === "commander.conflictingOption" ||
    code === "commander.excessArguments"
  ) {
    console.error(paint(`${DIM}Error:${RESET} ${(e as Error).message}`));
    program.outputHelp();
    process.exit(1);
  }
  throw e;
}