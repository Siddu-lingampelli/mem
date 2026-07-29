# mem-terminal — Complete Project Reference

> **Single source of truth for the `mem` CLI.** Verified against source as of v2.2.6 (commit `7fd1f83`). Every number, path, and signature below was read from the code or `npm pack --dry-run`, not assumed.

---

## 1. What `mem` is

`mem` (npm package **`mem-terminal`**, v2.2.6) is a fast, zero-config Node.js CLI that searches your shell history across **PowerShell (PSReadLine), Bash, Zsh, and Fish**. Type a keyword → get every command you ever ran that matches, fuzzy-tolerant, ranked by relevance. Secrets in the output are masked automatically.

- **One production dependency** (`commander`). Everything else (search engine, secret masking, parsers, ANSI output) is hand-rolled.
- **Zero cloud, zero setup.** Reads local history files; writes one tiny flag file.
- **MIT licensed**, author Siddhartha Lingampalli.
- **Install:** `npm install -g mem-terminal`

---

## 2. Verified project footprint

| Metric | Value | How verified |
|---|---|---|
| Version | `2.2.6` | `package.json` |
| Node engine | `>=18` | `package.json` `engines.node` |
| Binary | `bin: { "mem": "dist/cli.js" }` | `package.json` |
| Prod deps | `commander ^13.0.0` | `package.json` |
| Dev deps | `@types/node`, `typescript ^5.7`, `tsx ^4.19`, `vitest ^3.0` | `package.json` |
| Source files | 15 `.ts` | `src/` listing (ansi.ts added v2.2.6) |
| Test files | 13 `.ts` | `tests/` listing |
| Source LoC | ~1,380 | `wc -l src/*.ts` (ansi.ts added v2.2.6) |
| Test LoC | 1,961 | `wc -l tests/*.ts` |
| Total LoC | ~3,341 | `wc -l` |
| Tests passing | **202 / 202** in ~1.2s | `npx vitest run` |
| npm pack | 45 files, 103,758 bytes | `npm pack --dry-run --json` |
| `dist/` size | 124K | `du` |
| Published files | `dist/`, `README.md`, `LICENSE` | `package.json` `files` + `.npmignore` |
| Commits on `main` | 54 | `git log` count |
| ANSI color codes used | `\x1b[0,1,2,31,32,33,35,36m` | grep across `src/` |

### Test count by file (verified)

| File | Tests |
|---|---|
| `cli.test.ts` | 33 |
| `output.test.ts` | 37 |
| `search.test.ts` | 17 |
| `secrets.test.ts` | 58 |
| `history.test.ts` | 12 |
| `bash-history.test.ts` | 11 |
| `fish-history.test.ts` | 8 |
| `zsh-history.test.ts` | 8 |
| `recent.test.ts` | 6 |
| `stats.test.ts` | 6 |
| `welcome.test.ts` | 4 |
| `utils.test.ts` | 1 |
| `bench.test.ts` | 1 |
| **Total** | **202** |

---

## 3. Directory map

```
mem-pro/
├── src/                      # 15 TypeScript modules (~1,380 LoC)
│   ├── cli.ts          (229) # Entry point, Commander wiring, custom help/version
│   ├── search.ts       (208) # preprocess() + searchCached(), bounded Levenshtein
│   ├── output.ts       (185) # ANSI rendering, NO_COLOR/TTY gating, grouped display
│   ├── secrets.ts      (120) # 25 regex patterns → 40+ token types masked
│   ├── bash-history.ts  (94) # Plain + HISTTIMEFORMAT multiline parser
│   ├── fish-history.ts  (91) # YAML-like parser, multiline, paths blocks
│   ├── history.ts       (88) # PSReadLine reader + BOM detection + shell router
│   ├── zsh-history.ts   (78) # Extended-history `: ts:dur;cmd` parser
│   ├── welcome.ts       (69) # First-run banner + flag-file + in-process memo
│   ├── bench.ts         (49) # 5 fixed queries, reuses preprocessed cache
│   ├── stats.ts         (48) # Top-N with ASCII bar charts
│   ├── utils.ts         (44) # PSReadLine candidate path resolver
│   ├── recent.ts        (28) # Newest N, secret-masked
│   ├── ansi.ts           (8) # Shared ANSI escape constants (new v2.2.6)
│   └── types.ts         (21) # HistoryEntry, SearchHit, MatchCategory
├── tests/                    # 13 test files (1,961 LoC, 202 tests)
├── dist/                     # Compiled output (gitignored, 124K)
├── docs/                     # Vercel static landing site (untracked)
│   ├── index.html     (26.7K)
│   ├── styles.css     (11.5K)
│   ├── script.js       (8.4K)
│   └── _chk.py               # html sanity checker
├── .claude/                  # Claude Code config (untracked)
│   ├── settings.json         # graphify hook guards
│   └── settings.local.json   # permission allowlist
├── package.json              # manifest
├── package-lock.json
├── tsconfig.json             # strict, ES2022, ESNext, bundler resolution
├── vercel.json               # static-site config (outputDirectory: docs)
├── CLAUDE.md                 # graphify instructions
├── README.md                 # user-facing quickstart
├── documentation.md         # long-form docs (older)
├── LICENSE                   # MIT, © 2026 Siddhartha Lingampalli
├── .gitignore                # node_modules, dist, .tgz, .env, .vercel
└── .npmignore                # excludes tests/docs/.claude/tsconfig from pack
```

---

## 4. How it works — end to end

```
User runs:  mem "docker"

cli.ts
  └─ isMain guard (fileURLToPath) → runs only when executed, not imported
  └─ pre-parse --version/-V → custom formatting, exit 0
  └─ program.parse()
       └─ positional "query" → runSearch(query, showAll, maxCount, shell="auto")
                                (mem search <q> hits the same runSearch)

runSearch() ── cli.ts:44
  ├─ readHistory(limit=2000, shell) ─────── history.ts:72  (shell router)
  │     ├─ shell=="powershell" → readPsReadLineHistory  (history.ts:40)
  │     ├─ shell=="bash"       → readBashHistory        (bash-history.ts:83)
  │     ├─ shell=="zsh"        → readZshHistory          (zsh-history.ts:67)
  │     ├─ shell=="fish"       → readFishHistory        (fish-history.ts:80)
  │     └─ shell=="auto"      → PSReadLine → Bash → Zsh → Fish fallback
  │           (each returns newest-first HistoryEntry[], limit-capped)
  │
  ├─ search(entries, query) ─────────────── search.ts:206
  │     ├─ preprocess(entries) ─────────── search.ts:90
  │     │     ├─ case-insensitive dedupe (count++)
  │     │     ├─ tokenize (lowercase, [^a-z0-9]+ split)
  │     │     ├─ noise filter (mem/history/clear/cls/exit, ≤1 char, non-alnum)
  │     │     └─ sort preserving original index
  │     │     → CachedEntry[] (command, commandLower, tokens, count, index)
  │     │
  │     └─ searchCached(cached, totalEntryCount, query) ── search.ts:164
  │           ├─ empty / "all"/*/"everything" → return everything as hits
  │           ├─ scoreCmd per entry (bounded Levenshtein, prefix/substr checks)
  │           ├─ filter score < 0.4 threshold
  │           ├─ sort: score(ε=0.01) → frequency desc → alpha
  │           └─ → SearchHit[] {command, score, category, count, recent}
  │
  └─ print(results, query, showAll, max, undefined, shellLabel) ── output.ts:83
        ├─ maskSecrets each command ── secrets.ts:114
        ├─ split into Exact / Similar / "Did you also mean?" groups
        ├─ highlightCmd matched words (BOLD+MAGENTA), dim the rest
        ├─ metadata line: 12×  •  pwsh  •  recent
        └─ header: "3 matches" (+ " — showing top 20" if truncated)
```

**The preprocessing split is the key optimization.** `preprocess()` runs once; `searchCached()` is O(n) per query and reusable. `bench` exploits this to run 5 queries over one cached set.

---

## 5. The search engine (`search.ts`)

### Scoring penalty table (lower = better; verified from `PENALTY` const)

| Match type | Penalty | Example |
|---|---|---|
| Exact token match | 0.0 | `compose` in `docker compose` |
| Fuzzy, Levenshtein dist 1 | 0.05 | `docer` → `docker` |
| Fuzzy, Levenshtein dist 2 | 0.12 | `docor` → `docker` |
| Token prefix match | 0.15 | `com` → `compose` |
| Query prefix match | 0.10 | `doc` → `docker` |
| Token substring | 0.25 | `ai` in `claim` |
| Command prefix | 0.35 | `git` in `git push` |
| Command global substring | 0.50 | `run` in `npm run build` |
| **Threshold (pass filter)** | **0.4** | — |
| Sort epsilon | 0.01 | — |

`category` is derived from score: `0` → `"exact"`; `>0 and ≤0.12` → `"fuzzy"`; else `"similar"`.

### Bounded Levenshtein — the perf trick (`search.ts:49`)

- Swift-exits when `|a.length − b.length| > maxDist` (returns `maxDist + 1`, i.e. "no match").
- Two-row DP (`_levPrev`, `_levCurr`) sized **64 chars each at module load** — **zero per-call allocation** for tokens ≤64 chars.
- Row-min early termination: if the whole row's minimum exceeds `maxDist`, bail immediately.
- Only invoked for query words ≥4 chars.

### Recency

`recent: boolean` = the entry's original `index < floor(totalEntryCount × 0.25)`, floored at 1 for tiny histories. Top quarter of the history by recency gets the "recent" badge.

---

## 6. History reading — 4 shells

Every reader is **idempotent, newest-first, limit-capped**, and swallows read errors (returns `[]`). Encoding is auto-detored.

### PowerShell / PSReadLine (`history.ts` + `utils.ts`)

Path priority (`getHistoryFilePath`):
1. `$PSREADLINE_HISTORY_FILE` env var (if set, non-empty)
2. `%USERPROFILE%\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt` (WinPS 5.1)
3. `%USERPROFILE%\AppData\Roaming\Microsoft\PowerShell\PSReadLine\ConsoleHost_history.txt` (PS 7+ / pwsh)
4. `%USERPROFILE%\AppData\Roaming\Microsoft\PowerShell\PSReadLine\Visual Studio Code Host_history.txt` (VS Code host)
5. First none exist → returns PS 7+ default so caller can error gracefully.

`detectEncoding(buffer)`: UTF-8 BOM (`EF BB BF`) → `"utf8"`; UTF-16 LE BOM (`FF FE`) → `"utf16le"`; else `"utf-8"`. Leading `U+FEFF` stripped.

### Bash (`bash-history.ts`)

- Honors `$HISTFILE`, then tries `~/.bash_history`, `~/.sh_history`.
- Per-line `HISTTIMEFORMAT` detection via `^#[0-9]{8,}\s*$` (digit-only, avoids `\d` matching Unicode digits).
- **Multiline commands in timestamp mode preserved.** In plain mode, one line = one command.

### Zsh (`zsh-history.ts`)

- Honors `$HISTFILE`, then `~/.zsh_history`, `~/.histfile`.
- Format `: <ts>:<dur>;<cmd>` via `^:\s*\d+:\d+;(.*)$`. Non-matching lines kept as raw commands.
- Semicolons inside commands handled (regex is anchored at start).

### Fish (`fish-history.ts`)

- `$XDG_DATA_HOME/fish/fish_history`, else `~/.local/share/fish/fish_history`.
- YAML-like `- cmd:` / `when:` / `paths:` parsing, multiline continuation support.

### Router (`history.ts:72` `readHistory`)

```
shell = "powershell"|"bash"|"zsh"|"fish" → that reader only  (explicit bypasses PSReadLine)
shell = "auto" → PSReadLine; if empty → Bash → Zsh → Fish
```

Explicit shells bypass PSReadLine intentionally — fixes a Windows + Git Bash user always getting PowerShell history despite `$HISTFILE`.

---

## 7. Secret masking (`secrets.ts`)

`maskSecrets(input)` runs **25 regex patterns** in order (most specific first) and replaces the secret body with `********`, keeping only the first 4+ chars. Philosophy: **false positive = cosmetic; missed secret = leak**, so it errs toward masking.

### 11 categories covered (verified from comments)

| Category | Examples |
|---|---|
| GitHub | `github_pat_****`, `ghp_/gho_/ghs_/ghr_/ghu_****` |
| Stripe | `whsec_`, `sk_live_`, `sk_test_`, `rk_live_`, `rk_test_` |
| AI/ML | Anthropic `sk-ant-*`, OpenAI `sk-*`/`sk_*`, HuggingFace `hf_`, Replicate `r8_`, Cohere `coy*` |
| Git hosting | GitLab `glpat-`, Bitbucket `BB*` (28-char suffix) |
| Cloud | Databricks `dapi`, Google `AIza`, AWS `AKIA`/`ASIA` (12-char suffix), DigitalOcean `dopx_` |
| Messaging | Slack `xox[bpoa]-`/`xoxs-`, Slack webhook URLs, Telegram `bot<digits>:`, Discord `<id>.<ts>.<hmac>` |
| Package registries | npm `npm_` |
| JWT/JWS | `eyJ*` (base64-url start) |
| Auth headers | `Bearer <tok>`, `x-api-key:`, `Authorization: <scheme> <tok>` |
| URL query creds | `?key=`, `?token=`, `?secret=`, `?apikey=`, `?api_key=`, `?password=`, `?ask=`, `?dgai=` |
| CLI flag creds | `--api-key`, `--token`, `--secret`, `--password`, `--passwd`, `--ask`, `--dgai` |

Applied at **every display path**: `output.ts print()`, `recent.ts`, `stats.ts`. Never stored — only masked on the way out.

---

## 8. Output rendering (`output.ts`)

- **Color gate (`useColor`):** `NO_COLOR` env var set (any value) → off; else `process.stdout.isTTY === true`. Non-TTY (piped) → plain text.
- **ANSI palette:** reset `[0m`, bold `[1m`, dim `[2m`, red `[31m`, green `[32m`, yellow `[33m`, magenta `[35m`, cyan `[36m`.
- **`highlightCmd`:** regex-escapes query words, matches case-insensitively, wraps hits in `BOLD+MAGENTA`, dims the remainder. Empty/`*`/all-keyword → just dim the whole command.
- **Grouped display (`print`):**
  - `Exact` → `Similar` → `Did you also mean?` (last group dedupes by first word, max 5 shown).
  - Each line prefixed `  ` (continuation lines `    `).
  - Metadata per hit: `12×` (if count>1) `• pwsh` (if shell known) `• recent` (if recent) — all dimmed.
  - Header: green count `• dim "matches"` (+ `— showing top N` when truncated, + `Xms` if duration given).
  - Truncation hint: `use --all to show all`.

### Empty-state suggestions (`print`, query non-empty, zero results)

Prints `No matching commands.` + `Try: mem "<q[:12]>"`, then picks from hardcoded list `["docker","git","npm","cd","ls","ssh","curl","node"]` filtered by 2-char prefix overlap — comment in source flags this as a candidate for richer future logic.

---

## 9. CLI surface (`cli.ts`)

### Commands (verified)

| Command | Flags | Behavior |
|---|---|---|
| `mem <query>` | `--all` `-n/--max <n>` | Direct search via `runSearch` |
| `mem search <query>` | `--all` `-n/--max <n>` `--shell <s>` | Same `runSearch`, explicit shell |
| `mem stats` | `-n/--top <n>` (def 10) `--shell <s>` | Top commands + bar charts |
| `mem bench` | `-l/--limit <n>` (def 50000) `--shell <s>` | Parse/process/search timing |
| `mem recent` | `-n/--max <n>` (def 20) `--shell <s>` | Newest N, secret-masked |
| `mem index` | — | **Stub** → stderr "coming in V2", exit 1 |
| `mem sync` | — | **Stub** → stderr "coming in V2", exit 1 |
| (no args) | — | First run → welcome; else help |

`--shell` values: `auto` (default) `powershell` `bash` `zsh` `fish`. Lives **only on subcommands**, not bare `mem <query>` (always `auto`).

### Startup mechanics

- **`isMain` guard** (`fileURLToPath(import.meta.url) === resolve(process.argv[1])`) — so `cli.ts` is importable for tests without auto-running.
- **Custom help** via `program.helpInformation = () => paint(customHelp())` — overrides Commander's default with ANSI box.
- **Custom `--version`/`-V`** pre-parsed before `program.parse()` to dodge Commander's help-on-version hijack.
- **`exitOverride()`** + typed catch: `commander.helpDisplayed` → exit 0; any other → error + help + exit 1.

### Exported helpers (used by tests)

`stripAnsi`, `paint`, `parseCount(val, fallback?)`, `parseShell(val)`, `runSearch(query, showAll?, maxCount?, shell?)`.

`parseCount` rejects `NaN` and `< 1`, returning the fallback. Note: an earlier draft used `parseCount(opts.max, 20) ?? 20` — the trailing `?? 20` was dead defensive code (`parseCount` already returns the fallback), removed in v2.2.6.

---

## 10. Welcome screen (`welcome.ts`)

First-run boxed banner (`┌────┐` box, w=36) showing version + tagline + quickstart examples + shell checkmarks + `Run mem --help anytime`.

- **Persistence:** writes empty `~/.mem-welcome` flag file (best-effort — try/catch, no diagnostic).
- **In-process memo** (`shownThisProcess`): if the flag write fails (read-only HOME, sandbox, permission denied), the banner still won't re-fire for the rest of that process.
- **`hasSeenWelcome()` = `shownThisProcess || existsSync(FLAG_FILE)`.**
- Returns `Promise<void>` (synchronous body) — signature preserved so a future "press any key" gate can layer on without changing call sites.

History note (in source comments): v2.2.3–2.2.4 removed a "Press Enter to continue" prompt that hung on non-TTY stdin (MINGW64/msys/spawned processes).

---

## 11. Stats, bench, recent

### `stats.ts` (`runStats(top=10, shell)`)

- Prefix summary: `History  N commands (M unique)`, `Shell <label>` if non-auto.
- Top N sorted by `count` desc, alpha tiebreak.
- ASCII bar: `█` × `ceil((count/maxCount) × 20)`, min 1.
- `mem stats -n 20` widens to top 20.

### `bench.ts` (`runBench(limit=50000, shell)`)

Measures 3 phases via `performance.now()`:
1. **Parse** — `readHistory`
2. **Process** — `preprocess`
3. **Search** — 5 queries `["git","docker","npm","ssh","node"]` against the **same cached** set (no re-preprocess)
4. Reports `Total = parse+process+search`.

### `recent.ts` (`runRecent(n=20, shell)`)

Newest `min(n, entries.length)` commands, **secret-masked**, numbered, dim index. Header `mem recent` / `Last N commands`.

---

## 12. Config files

### `package.json` (verified fields)

```jsonc
{
  "name": "mem-terminal",
  "version": "2.2.5",
  "type": "module",
  "bin": { "mem": "dist/cli.js" },
  "engines": { "node": ">=18" },
  "scripts": {
    "build": "tsc",
    "start": "node dist/cli.js",
    "dev": "tsx src/cli.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build"
  },
  "dependencies": { "commander": "^13.0.0" },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "vitest": "^3.0.0"
  },
  "files": ["dist", "README.md", "LICENSE"]
}
```

### `tsconfig.json`

Strict, ES2022 target, ESNext modules, Bundler resolution. `declaration: true`, `sourceMap: true`. `noUnusedLocals` + `noUnusedParameters` + `noImplicitAny` enforced. `outDir: ./dist`, `rootDir: ./src`. Tests excluded (`exclude: ["dist", "tests"]`).

### `vercel.json`

Static-site config for the `docs/` landing page — `outputDirectory: docs`, `cleanUrls: true`, `trailingSlash: false`, **no build/install commands**. Has no relationship to the published npm package (`files` excludes `docs/`).

### `.gitignore` / `.npmignore`

- **`.gitignore`:** `node_modules/`, `dist/`, `*.tgz`, `.env`, `.vercel`
- **`.npmignore`:** `tests/`, `docs/`, `.claude/`, `*.tgz`, `.git/`, `.gitignore`, `tsconfig.json`, `documentation.md` — keeps the 45-file pack to ~100KB.

### `.claude/` (untracked)

- `settings.json` — PreToolUse hook guards routing Bash/Grep/Read through `graphify.EXE`.
- `settings.local.json` — permission allowlist (npm, git, vitest, node, etc.).

---

## 13. Vercel static site (`docs/`)

A standalone marketing/docs page (not part of the CLI binary). Single-page app:
- `index.html` (26.7K) — sections: Overview, Install, Quick Start, Search, Cross-shell, Stats, Recent, Bench, How it works, Search engine, Secret masking, Ranking, CLI flags, Commands, Environment, Changelog, Development, Deploy, Testing, Overlay.
- `styles.css` (11.5K) — theme, sidebar, scroll-spy.
- `script.js` (8.4K) — sidebar nav, scroll-spy, copy buttons, mobile nav, search.
- `_chk.py` — sanity checker for broken HTML tags.
- Inline SVG favicon (a cyan `m` on dark).

Deployed via `vercel.json`. Untracked in git.

---

## 14. Development

```bash
npm install              # deps
npm run build            # tsc → dist/
npm start                # node dist/cli.js
npm run dev              # tsx src/cli.ts (no build)
npm test                 # vitest run — 202 tests
npm run test:watch       # vitest watch
npm pack --dry-run       # inspect the 45-file bundle
npm install -g .         # install locally
```

### Override history for testing

```powershell
$env:PSREADLINE_HISTORY_FILE = ".\test_history.txt"
$env:HISTFILE = ".\test_bash_history.txt"     # bash / zsh
$env:XDG_DATA_HOME = ".\test_data"            # fish
node dist/cli.js "docker"
```

---

## 15. Version history (from git log)

| Version | Commit | Highlights |
|---|---|---|
| 1.0.0 | — | Initial PowerShell history search + fuzzy matching |
| 1.1.x–1.2.3 | `2645b5b`→`fc1f185` | Zsh + Fish support; **preprocess/searchCached** optimization (bench 172ms→96ms, single query 33ms→14ms); `mem bench` |
| 1.2.6 | `74a5046` | Benchmark command |
| 1.2.7 | `a3cd3c0` | `mem stats` |
| 1.2.8 | `3d27dd1` | `mem recent` + secret masking on display; code-review fixes |
| 1.2.9 | `29f572e` | Fallback chain, isMain guard, module state, shared colorize |
| **1.3.0** | `b2126f7` | **Match category labels (Exact / Similar / Did you also mean?)** |
| 1.3.1 | `c5f9158` | Bug fix round 3 |
| 2.2.1 | `d5d7daa` | Version bump for npm publish |
| 2.2.2 | `5b5234d` | Fix silent welcome on non-TTY stdin |
| 2.2.3 | `d42896f` | Restore welcome pause for keypress on real TTYs |
| 2.2.4 | `c3f4855` | Drop misleading "Press Enter to continue" prompt |
| **2.2.5** | `35383a7` | Cleanup: drop redundant await, kill fake async surface |
| **2.2.6** | `7fd1f83` | **docs site + welcome state-reset fix; ansi.ts extracted; dead `?? 20` removed** (current HEAD) |

**V2 roadmap:** indexed search (faster for >10k histories), cross-machine sync (both `index`/`sync` are stubs).

---

## 16. Strengths, verified

1. **Minimal surface** — one prod dep, 1.3K LoC of source, ~100KB packed.
2. **Strict TS** — `noUnusedLocals`/`Parameters`/`noImplicitAny` prevent dead code and implicit any.
3. **Tested** — 202 tests across all 4 shells, 25 secret patterns, category grouping, CLI parsing.
4. **Correct encoding handling** — UTF-8/UTF-16 LE BOM auto-detect.
5. **Fast search** — bounded Levenshtein with pre-allocated buffers, module-level, zero per-call alloc for ≤64-char tokens.
6. **Security-by-default** — secrets masked on every display path, never stored.
7. **Portable** — cross-shell auto-detection with explicit override; honors standard env vars (`HISTFILE`, `XDG_DATA_HOME`, `PSREADLINE_HISTORY_FILE`).
8. **Testable** — `isMain` guard makes `cli.ts` import-safe; helpers (`stripAnsi`, `paint`, `parseCount`, `parseShell`) exported for direct unit testing.

---

## 17. Observations and improvement candidates (not requested, for reference)

- `output.ts` empty-state suggestion list is hardcoded to 8 common commands — source comment flags it as a candidate for drawing from preprocessed top-N instead.
- `cli.ts` `runRecent`: `parseCount(opts.max, 20) ?? 20` — trailing `?? 20` was dead defensive (`parseCount` already returns the fallback). Removed in v2.2.6.
- `welcome.ts` `showWelcome` is `async`-typed with a synchronous body — intentional forward hook for a future keypress gate; currently never awaited meaningfully.
- `secrets.ts` Bitbucket pattern (`BB…`, 28-char suffix) and Discord pattern (3-dot format) are length-anchored — could miss tokens outside those exact lengths, but match real formats.
- `vercel.json` + `docs/` are untracked; consider committing (with a `site/` note) or documenting they're deploy-only and excluded from the npm pack.
- Per `CLAUDE.md`, a `graphify-out/` knowledge graph is referenced but **does not exist yet** — `graphify update .` would generate it. `docs/PROJECT.md` (this file) supersedes that for now.

---

## 18. Single-command verification cheatsheet

```bash
npm test                          # expect: 13 files, 202 tests, 0 failures, ~1.2s
npm pack --dry-run --json | grep  # expect: 45 entries
node dist/cli.js --version        # mem v2.2.6
node dist/cli.js --help           # custom ANSI help
node dist/cli.js "git"            # search your live history
node dist/cli.js stats -n 10      # top 10 + bar charts
node dist/cli.js recent -n 5      # last 5 commands
node dist/cli.js bench            # parse/process/search timing
git log --oneline | wc -l         # expect: 54
```

---

*Verified 2026-07-29 against source at commit `7fd1f83` (v2.2.6). File: `docs/PROJECT.md`.*
