# mem

Search your terminal history instantly.

`mem` reads your PowerShell history and lets you search it instantly — no more
scrolling through `history | grep` or mashing `Ctrl+R`.

```bash
$ mem "docker compose"
Found 3 matching commands

  1.  docker compose up -d
  2.  docker compose down
  3.  docker compose logs
```

## Demo

![mem demo](https://raw.githubusercontent.com/anthropic/mem/main/docs/demo.gif)

> Drop a 15-second GIF here showing `mem "docker compose"` finding matches.
> People understand the project instantly from one GIF. *(placeholder)*

## Install

```bash
npm install -g mem
```

That's it.

## Usage

```bash
mem "docker compose"
mem "git rebase -i"
mem search "npm run build"
```

Run `mem` or `mem --help` to see all commands.

## Commands

| Command          | Description                              |
| ---------------- | ---------------------------------------- |
| `mem <query>`    | Search your history (shorthand)          |
| `mem search <q>` | Search your history                       |
| `mem index`      | Index history for faster search *(V2)*   |
| `mem sync`       | Sync history across machines *(V2)*      |
| `mem stats`      | Show history statistics *(V2)*           |

## Why mem?

Developers run the same commands over and over — `docker`, `git`, `npm run build`.
Instead of retyping or guessing, just search what you've already run.

## Requirements

- Windows + PowerShell (PSReadLine history)
- Node.js 18+
- TypeScript 5.7+ (for development)

## Roadmap

- **V1** ✅ — PowerShell history search, fuzzy matching
- **V2** — `index` cache, `sync`, `stats`, Bash/Zsh/Fish support

## Contributing

```bash
npm install      # install deps
npm run build    # compile
npm test         # run tests
```

mem is **MIT licensed**.
