# mem

[![CI](https://github.com/Siddu-lingampelli/mem/actions/workflows/ci.yml/badge.svg)](https://github.com/Siddu-lingampelli/mem/actions/workflows/ci.yml)
[![codecov](https://codecov.io/gh/Siddu-lingampelli/mem/branch/main/graph/badge.svg)](https://codecov.io/gh/Siddu-lingampelli/mem)
[![npm version](https://badge.fury.io/js/mem-terminal.svg)](https://www.npmjs.com/package/mem-terminal)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node: ≥18](https://img.shields.io/badge/node-%E2%89%A518-blue.svg)](https://nodejs.org)

Never lose a terminal command again. Search your PowerShell, Bash, Zsh, or Fish
history instantly using keywords. No cloud. No setup.

```bash
mem "docker compose"
# → 3 matches
#   docker compose up -d    • recent
#   docker compose down     • used 2×
#   docker compose logs
```

## Table of contents

- [Install](#install)
- [Quick start](#quick-start)
- [Commands](#commands)
  - [`mem search` / `mem "..."`](#mem-search--mem-)
  - [`mem stats`](#mem-stats)
  - [`mem recent`](#mem-recent)
  - [`mem bench`](#mem-bench)
  - [`mem doctor`](#mem-doctor)
- [Cross-shell history](#cross-shell-history)
- [Security & secret masking](#security--secret-masking)
- [Exit codes](#exit-codes)
- [Environment](#environment)
- [How it works](#how-it-works)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Install

Requires **Node.js 18+**.

```bash
npm install -g mem-terminal
```

Verify:

```bash
mem --version
# mem v2.2.10
```

A welcome banner prints on the first bare `mem` run; a flag file
(`~/.mem-welcome`) prevents it from re-firing.

## Quick start

```bash
mem "docker compose"        # direct search
mem search "npm run build"  # explicit subcommand
mem stats                   # command usage statistics
mem bench                   # benchmark history parsing & search
mem recent                  # show the 20 most recent commands
mem doctor                  # diagnose environment + mask self-test
mem --help                  # full help
```

## Commands

### `mem search` / `mem "..."`

Results are deduplicated, ranked by relevance, with usage frequency and recency:

```bash
mem "git"
# → 16 matches (showing top 20)
#   git status              • used 12× • recent
#   git push origin main    • used 8×
#   git commit -m "fix"
```

Use `--all` to show every match or `-n / --max` for a custom limit:

```bash
mem "git" --all                # show all matches
mem "docker" -n 5              # show only 5 results
```

### `mem stats`

```bash
mem stats                      # top 10 most-used commands
mem stats -n 20                # top 20 with ASCII bar charts
# History  1,234 commands (567 unique)
# Top 10 commands
#   1. git status                   45 ████████████████████
#   2. docker compose up -d         32 ██████████████
#   3. npm run build                28 ████████████
```

### `mem recent`

```bash
mem recent                     # last 20 commands
mem recent -n 5                # last 5 commands
mem recent --max 100           # last 100 commands
```

### `mem bench`

```bash
mem bench                      # measure parse / process / search
mem bench -l 100000            # with custom history limit
```

### `mem doctor`

Diagnose your environment. Useful when filing a bug report.

```bash
mem doctor                     # human-readable table
mem doctor --json               # machine-readable report
# Exit codes: 0 = all ok, 1 = at least one fail, 2 = only warnings
```

Checks:

- **Node.js** version (warns if below 18)
- **Platform** (darwin / linux / win32)
- **Home directory**
- **PSReadLine** history path (size, encoding, age)
- **Bash / Zsh / Fish** history paths
- **Mask self-test** — synthesises 5 realistic-length secrets and verifies each is masked
- **Search smoke** — round-trips an empty array through the preprocessor
- **Welcome flag** — checks `~/.mem-welcome` for symlink status

Paste the output into your GitHub issue so the maintainer can immediately see
your platform, history-file state, and whether the mask self-test passes.

## Cross-shell history

By default `mem` reads your **PowerShell / PSReadLine** history (the most
common on Windows). If you use **Bash**, **Zsh**, or **Fish** (e.g. Git Bash
on Windows), pick the source shell explicitly so `mem` reads the log you
actually run:

```bash
mem search "git" --shell bash    # read .bash_history
mem search "git" --shell zsh     # read .zsh_history
mem search "git" --shell fish    # read fish_history
mem stats        --shell bash
mem recent       --shell zsh
mem bench        --shell fish
mem doctor       --shell bash
```

`--shell` accepts `auto` (default — PSReadLine, then Bash → Zsh → Fish
fallback), `powershell` / `pwsh`, `bash`, `zsh`, `fish` (case-insensitive).
On Windows, Git Bash rewrites `/tmp/...` paths to `C:/Users/.../Temp/...`, so
export `HISTFILE` with a Windows-style path (or use `--shell`) to target a
specific log.

> Note: the `--shell` flag lives on the **subcommands** (`search`, `stats`,
> `bench`, `recent`, `doctor`). For a bare `mem "query"` the shell is always
> `auto`.

## Security & secret masking

Secrets in your history are automatically masked on every display path. Only
the first 4+ characters are shown; the rest is replaced with `********`.
Respects `NO_COLOR` env var (per [no-color.org](https://no-color.org/)).

Masked patterns (non-exhaustive; 30+ total):

- **Source hosts:** `github_pat_…`, `ghp_…`, `gho_…`, `glpat-…` (GitLab)
- **AI providers:** `sk-ant-…` (Anthropic), `sk-…` (OpenAI), `hf_…` (HuggingFace), `r8_…` (Replicate)
- **Payment:** `sk_live_…`, `sk_test_…`, `whsec_…`, `rk_live_…`, `rk_test_…` (Stripe)
- **Cloud:** `AKIA…` / `ASIA…` (AWS), `AIza…` (Google), `dapi…` (Databricks), `dopx_…` (DigitalOcean), `cf-…` / `cf_…` (Cloudflare), `vercel_…`, `pscale_tkn_…`
- **Messaging:** Slack tokens (`xoxb-`, `xoxp-`, `xoxa-`, `xoxs-`), Telegram bot tokens, Discord bot tokens
- **Auth:** Bearer tokens, `Authorization:` headers, `x-api-key:`, JWT (`eyJ…`)
- **CLI flags:** `--api-key`, `--token`, `--secret`, `--password` values
- **URL params:** `?key=`, `?token=`, `?secret=`, `?password=`
- **Contextual:** AWS secret access keys masked only when paired with the `aws_secret_access_key=` env-var name (no false positives on bare 40-char base64)

Philosophy: **a false positive is a cosmetic annoyance; a missed secret is a
leak.** We err on the side of masking.

## Exit codes

| Scenario                                      | Code |
| --------------------------------------------- | ---- |
| Help / version displayed                      | 0    |
| Search returned at least one match            | 0    |
| Search found nothing                          | 0    |
| No history file found                         | 1    |
| History read error                            | 1    |
| Missing argument / unknown option             | 1    |
| `mem doctor`: all checks pass                 | 0    |
| `mem doctor`: at least one `fail`             | 1    |
| `mem doctor`: at least one `warn` (no `fail`) | 2    |

## Environment

| Variable                  | Shell      | Effect                             |
| ------------------------- | ---------- | ---------------------------------- |
| `PSREADLINE_HISTORY_FILE` | PowerShell | Override PSReadLine history path   |
| `HISTFILE`                | Bash / Zsh | Override history file path         |
| `XDG_DATA_HOME`           | Fish       | Override fish history location     |
| `NO_COLOR`                | all        | Any set value disables ANSI colors |

## How it works

Reads your PSReadLine history (`ConsoleHost_history.txt`), Bash
(`.bash_history`), Zsh (`.zsh_history`), or Fish (`fish_history`),
newest-first — auto-detects which file exists, with graceful fallback
between shells.

- **Encoding:** Auto-detects UTF-8 BOM, UTF-16 LE BOM, or plain UTF-8
- **Search:** Token-aware fuzzy matching with bounded Levenshtein distance (≤4 chars)
- **Ranking:** Relevance score → usage frequency → alphabetical
- **Deduplication:** Case-insensitive; identical commands merged with usage count
- **Noise filtering:** Self-commands (`mem`, `history`) and single-char commands filtered
- **Masking:** Every command shown by `search`, `stats`, `recent`, `doctor` passes through `maskSecrets()` before render

## Development

```bash
npm install
npm run build     # tsc → dist/
npm run dev       # tsx src/cli.ts (hot reload)
npm start         # node dist/cli.js
npm test          # vitest run (14 test files, 236 tests)
npm run lint      # prettier --check
npm run format    # prettier --write
npm run typecheck # tsc --noEmit
npm run coverage  # vitest run --coverage (80 % / 75 % thresholds)
```

Override history file for testing (PowerShell):

```powershell
$env:PSREADLINE_HISTORY_FILE = ".\test_history.txt"
node dist/cli.js "docker"

$env:HISTFILE = ".\test_bash_history.txt"
node dist/cli.js "ssh"
```

Project layout:

```
src/        # 16 TypeScript files — Commander CLI, history readers, search engine, masker
tests/      # 14 TypeScript files — 236 tests, 1 platform-skipped
docs/       # Documentation website (static HTML/CSS/JS, served by GitHub Pages)
.github/    # Issue templates, Dependabot config, CI workflow
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Includes:

- How to add a new shell parser
- How to add a new secret pattern (with false-positive protection tests)
- PR process (lint + typecheck + test + build must all pass)

By participating you agree to abide by the project's
[CODE_OF_CONDUCT](./CODE_OF_CONDUCT.md) (standard Contributor Covenant).

## License

MIT — see [LICENSE](./LICENSE).

---

Built by [Siddhartha Lingampalli](https://github.com/Siddu-lingampelli).
