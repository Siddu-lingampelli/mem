# mem

Never lose a terminal command again. Search your PowerShell, Bash, Zsh, or Fish history instantly using keywords. No cloud. No setup.

```bash
mem "docker compose"
# → 3 matches
#   docker compose up -d    • recent
#   docker compose down     • used 2x
#   docker compose logs
```

## Install

```bash
npm install -g mem-terminal
```

## Usage

```bash
mem "docker compose"        # direct search
mem search "npm run build"  # explicit search subcommand
mem stats                   # show command usage statistics
mem bench                   # benchmark history parsing & search
mem recent                  # show the 20 most recent commands
mem --help                  # show help
mem --version               # show version
```

### Search

Results are deduped, ranked by relevance, with usage frequency and recency:

```bash
mem "git"
# → 16 matches (showing top 20)
#   git status              • used 12x • recent
#   git push origin main    • used 8x
#   git commit -m "fix"
```

Use `--all` to see every match or `-n/--max` to set a custom limit:

```bash
mem "git" --all                # show all matches
mem "docker" -n 5              # show only 5 results
```

### Statistics

```bash
mem stats                      # top 10 most-used commands
mem stats -n 20                # top 20 with ASCII bar charts
# History  1,234 commands (567 unique)
# Top 10 commands
#   1. git status                   45 ████████████████████
```

### Recent

```bash
mem recent                     # last 20 commands
mem recent -n 5                # last 5 commands
mem recent --max 100           # last 100 commands
```

### Benchmark

```bash
mem bench                      # measure parse/process/search speed
mem bench -l 100000            # with custom history limit
```

## How it works

Reads your PSReadLine history (`ConsoleHost_history.txt`), Bash (`.bash_history`), Zsh (`.zsh_history`), or Fish (`fish_history`), newest-first — auto-detects which file exists, with graceful fallback between shells.

- **Encoding:** Auto-detects UTF-8 BOM, UTF-16 LE BOM, or plain UTF-8
- **Search:** Token-aware fuzzy matching with Levenshtein distance scoring
- **Ranking:** Relevance score → usage frequency → alphabetical
- **Deduplication:** Identical commands merged with usage count
- **Noise filtering:** Self-commands (`mem`, `history`) and single-char commands filtered

## Security

Secrets in your history are automatically masked on display:

- **Tokens:** `github_pat_****`, `ghp_****`, `gho_****`, `sk-****`, `sk_****`, `sk-ant-****`, `hf_****`, `glpat-****`, `npm_****`, `r8_****`, `coy****`
- **Cloud keys:** `AKIA****` (AWS), `AIza****` (Google), `dapi****` (Databricks), `dopx_****` (DigitalOcean)
- **Payment:** `sk_live_****`, `sk_test_****`, `whsec_****` (Stripe)
- **Auth:** Bearer tokens, Authorization headers, JWT tokens, `x-api-key`
- **Messaging:** Slack tokens (`xoxb-`, `xoxp-`, `xoxs-`), Telegram bot tokens, Discord bot tokens
- **CLI flags:** `--api-key`, `--token`, `--secret` values
- **URL params:** `?key=`, `?token=`, `?secret=`, `?password=` in URLs

Only the first 4+ characters are shown; the rest is replaced with `********`.
Respects `NO_COLOR` env var (per [no-color.org](https://no-color.org/)).

## Requirements

- Node.js 18+
- PowerShell, Bash, Zsh, or Fish — any shell with a history file

## Roadmap

- **V1.3.0 (current)** ✅ — Cross-shell history search (PowerShell, Bash, Zsh, Fish), fuzzy matching with Levenshtein, relevance ranking, deduplication, **match category labels** (Exact / Similar / Did you also mean?), secret masking (40+ patterns), `stats` (usage frequency + bar charts), `bench` (performance metrics), `recent` (last N commands), welcome screen, `--all`/`-n` flags, `NO_COLOR` compliance, BOM detection
- **V2 (planned)** — Indexed search, cross-machine sync

## Development

```bash
npm install
npm run build     # tsc
npm test          # vitest run (13 test files, 191 tests)
npm run dev       # tsx src/cli.ts
```

Override history file for testing (PowerShell):

```bash
$env:PSREADLINE_HISTORY_FILE = ".\test_history.txt"
node dist/cli.js "docker"

# Or override Bash history:
$env:HISTFILE = ".\test_bash_history.txt"
node dist/cli.js "ssh"
```

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Siddhartha Lingampalli](https://github.com/Siddu-lingampelli).
