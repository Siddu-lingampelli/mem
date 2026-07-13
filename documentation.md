# MEM CLI — Terminal History Search Tool

**Version:** 1.2.9 · **v1.2.x (current)**  
**Binary:** `mem` · **Package:** `mem-terminal`  
**License:** MIT

---

## 🎯 Project Overview

**MEM** ("mem") is an ultra-fast terminal history search tool that searches your shell history instantly using keywords. Instead of scrolling through `history | grep` or mashing Ctrl+R, MEM lets you search across PowerShell, Bash, Zsh, and Fish history with fuzzy matching, deduplication, and relevance ranking.

### The Problem It Solves

- **Search speed:** Type `mem "docker"` and instantly find all Docker commands you've run
- **Command retrieval:** No more re-typing repetitive commands
- **Pattern discovery:** Quickly find commands matching complex patterns without perfect recall
- **Cross-shell support:** One tool for all your shells — PowerShell, Bash, Zsh, Fish
- **Security by default:** API keys and tokens in history are automatically masked on display

---

## 🚀 Technical Architecture

### Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Runtime | Node.js | 18+ | Cross-platform execution |
| Language | TypeScript | 5.7+ | Strict-typed, modern ES2022 |
| CLI Framework | Commander.js | ^13.0.0 | Argument parsing & help system |
| Search Engine | Custom Levenshtein | — | No external deps for search |
| Testing | Vitest | ^3.0.0 | Modern JavaScript testing framework |
| Build Tool | TypeScript Compiler | — | Type checking & compilation |

### Dependencies

**Production (1 dep):**
- `commander` ^13.0.0 — CLI argument parsing

**Development (3 deps):**
- `typescript` ^5.7.0 — Language compiler
- `tsx` ^4.19.0 — TypeScript execution for dev
- `vitest` ^3.0.0 — Test runner

### Project Structure

```
mem/
├── src/
│   ├── cli.ts              # CLI entry point, command handling, help system
│   ├── types.ts            # TypeScript interfaces (HistoryEntry, SearchHit)
│   ├── history.ts          # Primary history reader (PSReadLine), with Bash/Zsh/Fish fallback
│   ├── search.ts           # Custom fuzzy search engine with Levenshtein distance
│   ├── output.ts           # Formatted result display with ANSI colors + highlighting
│   ├── utils.ts            # PSReadLine history file path resolution
│   ├── bash-history.ts     # Bash (.bash_history) parser with HISTTIMEFORMAT support
│   ├── zsh-history.ts      # Zsh (.zsh_history) parser
│   ├── fish-history.ts     # Fish (fish_history) YAML-like parser
│   ├── secrets.ts          # API key / token masking on display
│   ├── stats.ts            # Statistics command (top commands, usage counts)
│   ├── bench.ts            # Benchmark command (parse + process + search timings)
│   ├── recent.ts           # Recent command (newest N commands, secret-masked)
│   └── welcome.ts          # First-run welcome screen
├── tests/
│   ├── history.test.ts     # PSReadLine history parsing tests
│   ├── search.test.ts      # Search algorithm tests
│   ├── bash-history.test.ts# Bash history parser tests
│   ├── zsh-history.test.ts # Zsh history parser tests
│   ├── fish-history.test.ts# Fish history parser tests
│   ├── output.test.ts      # Output formatting tests
│   ├── bench.test.ts       # Benchmark tests
│   ├── utils.test.ts       # Utility function tests
│   ├── welcome.test.ts     # Welcome screen tests
│   ├── stats.test.ts       # Statistics output, top-N, empty history, bar charts
│   ├── secrets.test.ts     # Secret masking for 30+ token patterns
│   └── recent.test.ts      # Recent command ordering, count, secret masking
├── dist/                   # Compiled JavaScript output (gitignored)
├── package.json            # Project manifest
├── README.md               # Quick-start documentation
├── documentation.md        # This file — full project documentation
└── tsconfig.json           # TypeScript configuration
```

---

## 🔧 How It Works — Technical Deep Dive

### 1. History File Detection & Reading

#### Primary: PSReadLine (PowerShell)

The primary history reader (`history.ts`) targets PSReadLine history files in this priority order:

1. `PSREADLINE_HISTORY_FILE` environment variable (if set)
2. `%USERPROFILE%/AppData/Roaming/Microsoft/Windows/PowerShell/PSReadLine/ConsoleHost_history.txt` — Windows PowerShell 5.1
3. `%USERPROFILE%/AppData/Roaming/Microsoft/PowerShell/PSReadLine/ConsoleHost_history.txt` — PowerShell 7+
4. `%USERPROFILE%/AppData/Roaming/Microsoft/PowerShell/PSReadLine/Visual Studio Code Host_history.txt` — VS Code integrated PowerShell

**Encoding auto-detection:**
- UTF-8 BOM (`EF BB BF`) → decoded as UTF-8
- UTF-16 LE BOM (`FF FE`) → decoded as UTF-16 LE
- No BOM → default UTF-8
- Leading BOM character (`U+FEFF`) stripped if present

**Reading algorithm:**
1. Get file path from env var or candidate list
2. Read entire file into Buffer
3. Detect BOM → decode with appropriate encoding
4. Split into lines, trim, filter empty
5. Return newest-first, capped at limit (default: 2000)

#### Fallback Chain

If no PSReadLine history file exists, the reader falls back through:

1. **Bash** (`bash-history.ts`): Reads `.bash_history` (Linux/macOS/Git Bash). Honors `HISTFILE` env var. Supports both plain mode (one command per line) and `HISTTIMEFORMAT` mode (lines prefixed with `#<epoch-timestamp>`). Multi-line commands in timestamp mode are detected and preserved.
2. **Zsh** (`zsh-history.ts`): Reads `.zsh_history` or `.histfile`. Honors `HISTFILE` env var. Parses the Zsh extended history format: `: <timestamp>:<duration>;<command>`.
3. **Fish** (`fish-history.ts`): Reads `fish_history` from `$XDG_DATA_HOME/fish/` or `~/.local/share/fish/`. Honors `XDG_DATA_HOME` env var. Parses the Fish YAML-like format with `- cmd:`, `when:`, and `paths:` fields, including multi-line commands.

### 2. Fuzzy Search Engine (`search.ts`)

MEM uses a **custom, zero-dependency search engine** (not Fuse.js) built on:

#### Preprocessing (`preprocess()`)
- **Deduplication**: Case-insensitive dedup of identical commands; each keeps a usage count
- **Noise filtering**: Filters out `mem`, `history`, `clear`, `cls`, `exit`, single-char commands, and non-alphanumeric-only commands
- **Tokenization**: Splits commands into lowercase alphanumeric tokens
- **Sorting**: Preserves original history order (newest-first)

#### Scoring (`scoreCmd()`)
Each query word is scored against each cached entry:

| Match Type | Penalty | Example |
|-----------|---------|---------|
| Exact token match | 0.0 | `compose` in `docker compose` |
| Levenshtein distance 1 | 0.05 | `docer` → `docker` |
| Levenshtein distance 2 | 0.12 | `docor` → `docker` |
| Token prefix match | 0.15 | `com` → `compose` |
| Query prefix match | 0.10 | `doc` → `docker` |
| Token substring | 0.25 | `ai` in `claim` |
| Command prefix | 0.35 | `git` in `git push` |
| Command global substring | 0.50 | `run` in `npm run build` |

**Levenshtein implementation:**
- Bounded to distance 2 (early exit on length gap > 2)
- Two-row DP with pre-allocated buffers (no allocations during search)
- Row-min early termination

#### Threshold & Sorting
- Entries with average score below 0.4 pass the filter
- Sorted by: score (epsilon 0.01) → frequency (desc) → alphabetical
- Empty query or `"all"` / `"*"` / `"everything"` keywords return all entries

#### Performance Architecture
`preprocess()` + `searchCached()` separation enables:
- One-time preprocessing of history entries
- Multiple queries against the same preprocessed data (used by `bench.ts`)
- O(n) per query with lightweight scoring

### 3. Output Formatting & Colors (`output.ts`)

#### ANSI Color System

| Escape Code | Usage |
|------------|-------|
| `\x1b[0m` | Reset |
| `\x1b[1m` | Bold (matched words) |
| `\x1b[2m` | Dim (separators, non-matching parts, metadata) |
| `\x1b[32m` | Green (match count header) |
| `\x1b[33m` | Yellow (empty-state suggestions) |
| `\x1b[35m` | Magenta (highlighted matched words) |
| `\x1b[36m` | Cyan (version number) |

#### Color control
- **`NO_COLOR`**: Any non-empty value suppresses all colors (per [no-color.org](https://no-color.org/))
- **TTY detection**: Colors off when stdout is not a TTY (e.g., piped to file)

#### Display behavior
- Default: shows top 20 matches with usage count and recency badge
- `--all` flag: shows every match without truncation
- `-n/--max <n>`: shows at most N results
- Empty results: offers suggestions (e.g., "Try: mem docker, mem git, mem npm")
- Multi-line commands: continuation lines indented
- Recency badge ("recent") shown when command appears in newest 25% of history

#### Secret Masking (`secrets.ts`)

When displaying results, known API key / token patterns are automatically masked:

| Pattern | Provider |
|---------|----------|
| `github_pat_*` | GitHub fine-grained PAT |
| `gh[pousr]_*` | GitHub classic tokens |
| `sk-ant-*` | Anthropic |
| `sk-*`, `sk_*` | OpenAI / API keys |
| `hf_*` | Hugging Face |
| `glpat-*` | GitLab PAT |
| `dapi*` | Databricks |
| `npm_*` | npm token |
| `AIza*` | Google API |
| `AKIA*`, `ASIA*` | AWS access keys |
| `eyJ*` | JWT tokens |
| `xox[bpoa]-*`, `xoxs-*` | Slack tokens |
| `whsec_*`, `sk_live_*`, `rk_live_*` | Stripe |
| `dopx_*` | DigitalOcean |
| `bot<digits>:*` | Telegram |
| `r8_*` | Replicate |
| `coy*` | Cohere |
| `BB*` | Bitbucket |
| Bearer / Authorization headers | Generic auth |
| URL query params (`?key=`, `?token=`, `?secret=`, etc.) | URL-based credentials |
| CLI flags (`--api-key`, `--token`, `--secret`, etc.) | CLI credentials |

Only the first 4+ characters of the secret are shown; the rest is replaced with `********`.

### 4. Command-Line Interface (`cli.ts`)

#### Architecture

Built on Commander.js with:
- **Custom help system**: Overrides Commander's default with a beautifully formatted ANSI-styled help page
- **Custom version handling**: Pre-parses `--version`/`-V` before Commander runs (to avoid help hijacking)
- **Overridden exit handling**: `exitOverride()` with typed error codes

#### Available Commands

| Command | Description | Status |
|---------|-------------|--------|
| `mem <query>` | Direct search (positional argument) | ✅ V1 |
| `mem search <query>` | Explicit search subcommand | ✅ V1 |
| `mem stats [-n/--top <n>]` | Show command usage statistics | ✅ V1.2.7 |
| `mem bench [-l/--limit <n>]` | Benchmark parse/process/search | ✅ V1.2.6 |
| `mem recent [-n/--max <n>]` | Show newest N commands (default 20), with secret masking | ✅ V1.2.8 |
| `mem index` | Indexed search | 🔜 V2 (stub) |
| `mem sync` | Cross-machine sync | 🔜 V2 (stub) |

#### Error Handling

| Scenario | Exit Code | Behavior |
|----------|-----------|----------|
| `--help` displayed | 0 | Clean exit |
| Missing argument / unknown option | 1 | Error message + help output |
| No history file found | 1 | "No history found." |
| File read error | 1 | "Error reading history: <message>" |

#### Welcome Screen (`welcome.ts`)

On first run (when no arguments given), MEM shows a welcome screen with:
- Version and tagline
- Quick start examples (`mem "docker"`, `mem "git"`)
- Supported shells (PowerShell, Bash, Zsh, Fish)
- Prompts to press Enter to continue

A flag file (`~/.mem-welcome`) prevents the welcome from showing again.

### 5. Statistics (`stats.ts`)

The `mem stats` command provides:
- **Summary**: Total commands and unique commands count
- **Top commands**: Sorted by frequency, with ASCII bar charts
- Example output:
  ```
  mem stats
  History  1,234 commands (567 unique)
  Top 10 commands
    1. git status                   45 ████████████████████
    2. docker compose up -d         32 ██████████████
    3. npm run build                28 ████████████
  ```

### 6. Benchmark (`bench.ts`)

The `mem bench` command measures performance:
- **Parse**: Time to read history file
- **Process**: Time to dedupe, tokenize, and index
- **Search**: Time to run 5 benchmark queries (git, docker, npm, ssh, node)
- **Total**: Aggregate timing

---

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Instant Search** | Fuzzy matching of command history with keyword input |
| **Case Insensitive** | Works with any capitalization |
| **Partial Matching** | Finds commands containing search terms |
| **Typo Tolerance** | Handles misspelled commands via Levenshtein distance |
| **Deduplication** | Identical commands merged with usage count |
| **Relevance Ranking** | Most relevant matches first (score → frequency → alpha) |
| **Rich Output** | ANSI-formatted results with word highlighting |
| **Secret Masking** | Automatic API key/token redaction on display |
| **Cross-Shell** | PowerShell, Bash, Zsh, Fish — auto-detected |
| **No Color Mode** | Full `NO_COLOR` spec compliance |
| **First-Run Welcome** | Helpful intro on initial launch |
| **Subcommands** | `mem search`, `mem stats`, `mem bench` |
| **Benchmarking** | Built-in performance measurement |
| **Encoding Detection** | Auto-detects UTF-8, UTF-16 LE BOM |
| **Statistics** | Command usage frequency analysis |

---

## 🛠️ Development & Testing

### Scripts

```bash
npm run build       # tsc — compile TypeScript to dist/
npm start           # node dist/cli.js — run compiled version
npm run dev         # tsx src/cli.ts — run with tsx (dev mode)
npm test            # vitest run — run all tests once
npm run test:watch  # vitest — watch mode
npm run prepublishOnly  # build before npm publish
```

### Test Suite

The test suite covers **12 test files** with comprehensive scenarios:

| Test File | What It Tests |
|-----------|--------------|
| `tests/history.test.ts` | PSReadLine parsing, empty lines, missing file, limit enforcement |
| `tests/search.test.ts` | Exact match, fuzzy match, empty/all keywords, dedup, scoring |
| `tests/bash-history.test.ts` | Plain mode, HISTTIMEFORMAT, CRLF, multiline, limit, error handling |
| `tests/zsh-history.test.ts` | Zsh format parsing, semicolons in commands, CRLF, limit |
| `tests/fish-history.test.ts` | Fish YAML format, multiline commands, paths blocks, limit |
| `tests/output.test.ts` | Empty results display, formatted match display |
| `tests/bench.test.ts` | Benchmark output or empty-state message |
| `tests/utils.test.ts` | Environment variable path resolution |
| `tests/welcome.test.ts` | Flag file detection, rendered content verification |
| `tests/stats.test.ts` | Statistics output, top-N, empty history, bar charts |
| `tests/secrets.test.ts` | Secret masking for 30+ token patterns, no false positives |
| `tests/recent.test.ts` | Recent command ordering, N param, secret masking |

### Override History File for Testing

```bash
# PowerShell
$env:PSREADLINE_HISTORY_FILE = ".\test_history.txt"
node dist/cli.js "docker"

# Bash
$env:HISTFILE = ".\test_bash_history.txt"
node dist/cli.js "ssh"

# Zsh
$env:HISTFILE = ".\test_zsh_history.txt"
node dist/cli.js "git"

# Fish
$env:XDG_DATA_HOME = ".\test_data"
node dist/cli.js "npm"
```

### TypeScript Configuration

```json
{
  "target": "ES2022",
  "module": "ESNext",
  "moduleResolution": "Bundler",
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "declaration": true,
  "sourceMap": true,
  "outDir": "./dist",
  "rootDir": "./src"
}
```

---

## 📋 Quick Usage Reference

### Search

```bash
mem "docker compose"        # Direct search
mem search "npm run build"  # Explicit subcommand
mem "git" --all             # Show all matches
mem "ssh" -n 5              # Show at most 5 matches
```

### Statistics

```bash
mem stats                   # Show top 10 commands
mem stats -n 20             # Show top 20 commands
```

### Benchmark

```bash
mem bench                   # Default (50k entry limit)
mem bench -l 100000         # Custom limit
```

### Recent

```bash
mem recent                  # Show last 20 commands
mem recent -n 5             # Show last 5 commands
mem recent --max 100        # Show last 100 commands
```

### Help & Version

```bash
mem --help                  # Show custom help
mem -h                      # Short help
mem --version               # Show version
mem -V                      # Short version
```

### No Arguments

```bash
mem                         # First run: welcome screen
                            # Subsequent: help output
```

---

## 📊 Version History

| Version | Date | Highlights |
|---------|------|------------|
| 1.0.0 | — | Initial release: PowerShell history search, fuzzy matching |
| 1.2.5 | — | First-run welcome screen |
| 1.2.6 | — | Benchmark command |
| 1.2.7 | — | Stats command, refined welcome |
| **1.2.8** | **Current** | **Recent command, secret masking on display** |

### V2 Roadmap

- **Indexed search** — faster for large histories (>10k entries)
- **Sync** — cross-machine history synchronization

---

## 👥 Target Users

- **Developers** — Re-typing repetitive commands → instant retrieval
- **DevOps Engineers** — Locating config/deploy commands → pattern matching
- **Data Scientists** — Finding analysis commands → fuzzy search
- **System Administrators** — Retrieving admin commands → cross-shell support
- **CI/CD Users** — Re-running build/test commands → quick rediscovery

---

## 📝 License

MIT — Copyright (c) 2026 Siddhartha Lingampalli

---

Built by [Siddhartha Lingampalli](https://github.com/Siddu-lingampelli).
