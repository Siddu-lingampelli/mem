#!/usr/bin/env node

import { program, Command } from "commander";
import { readHistory } from "./history.js";
import { search } from "./search.js";
import { print, useColor } from "./output.js";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";

const VERSION = "1.1.0";

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[\d+m/g, "");
}

function paint(text: string): string {
  return useColor() ? text : stripAnsi(text);
}

let showAll = false;

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
    print(results, query, showAll);
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
  .description("Search your terminal history")
  .action((query: string) => runSearch(query));

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
  .addCommand(stub("index"))
  .addCommand(stub("sync"))
  .addCommand(stub("stats"))
  .argument("[query]", "Search query")
  .option("--all", "Show every matching command without truncation")
  .action((query: string | undefined, opts: { all?: boolean }) => {
    if (query === undefined) {
      program.outputHelp();
      return;
    }
    showAll = opts.all ?? false;
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
    code === "commander.missingArgumentForCommand"
  ) {
    console.error(paint(`${DIM}Error:${RESET} ${(e as Error).message}`));
    program.outputHelp();
    process.exit(1);
  }
  throw e;
}