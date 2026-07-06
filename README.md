# mem

Never lose a terminal command again. Search your PowerShell history instantly using keywords. No cloud. No setup.

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
mem "git" --all             # show all 172 results
mem search "npm run build"  # explicit subcommand
mem --help                  # show help
mem --version               # show version
```

Results are deduped, ranked by relevance, with usage frequency and recency:

```bash
mem "git"
# → 16 matches (showing top 20)
#   git status              • used 12x • recent
#   git push origin main    • used 8x
#   git commit -m "fix"
```

Use `--all` to see every match without truncation.

## How it works

Reads your PSReadLine history (`ConsoleHost_history.txt`), newest-first.
Detects UTF-8 and UTF-16 LE BOM automatically.
Token-aware search with strict relevance ranking.
Respects `NO_COLOR` env var.

## Security

API keys and tokens in history are automatically masked on display:
- `github_pat_****`, `ghp_****`, `sk-****`, `AIza****`
- Authorization headers, Bearer tokens, AWS keys, JWTs

## Requirements

- Windows + PowerShell (PSReadLine history)
- Node.js 18+

## Roadmap

- **V1** ✅ — PowerShell history search, deduped results, counts
- **V2 (current)** ✅ — Token-aware ranking, `--all` flag, secret masking
- **V3** — Bash/Zsh/Fish support, indexed search, sync

## Development

```bash
npm install
npm run build     # tsc
npm test          # vitest run (15 tests)
npm run dev       # tsx src/cli.ts
```

Override history file for testing:

```bash
$env:PSREADLINE_HISTORY_FILE = ".\test_history.txt"
node dist/cli.js "docker"
```

## License

MIT — see [LICENSE](LICENSE).

---

Built by [Siddhartha Lingampalli](https://github.com/Siddu-lingampelli).
