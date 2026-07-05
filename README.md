# mem

Never lose a terminal command again. Search your PowerShell history instantly using keywords and fuzzy search. No cloud. No setup.

```bash
mem "docker compose"
# → Found 3 matching commands
#   1. docker compose up -d
#   2. docker compose down
#   3. docker compose logs
```

## Install

```bash
npm install -g @siddu-lingampelli/mem
```

## Usage

```bash
mem "docker compose"        # direct search
mem search "docker compose" # explicit subcommand
mem --help                  # show help
mem --version               # show version
```

Fuzzy matching works with typos, partial words, and any case:

```bash
mem "docer"          # fuzzy → finds docker
mem "DOCKER"         # case insensitive
mem " docker "       # spaces trimmed
mem ""               # → friendly error
```

## How it works

Reads your PSReadLine history (`ConsoleHost_history.txt`), newest-first.
Detects UTF-8 and UTF-16 LE BOM automatically.
Searches with Fuse.js (threshold 0.6, min match length 2).
Formats results with ANSI highlights (respects `NO_COLOR` env var).

**Search engine config:**

```typescript
const fuse = new Fuse(entries, {
  keys: ["command"],
  includeScore: true,
  threshold: 0.6,
  minMatchCharLength: 2,
});
```

## Requirements

- Windows + PowerShell (PSReadLine history)
- Node.js 18+

## Roadmap

- **V1** ✅ — PowerShell history search, fuzzy matching
- **V2** — Indexed search, Bash/Zsh/Fish support, sync, stats

## Development

```bash
npm install
npm run build     # tsc
npm test          # vitest run (13 tests)
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
