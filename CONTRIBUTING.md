# Contributing to `mem`

Thanks for your interest. This guide covers local setup, the test suite, and
how to extend `mem` with a new shell parser or a new secret pattern.

## Development Setup

Requirements: Node.js ≥ 18, npm.

```bash
git clone https://github.com/Siddu-lingampelli/mem-pro.git
cd mem-pro
npm install
npm run dev -- "docker"      # runs src/cli.ts via tsx
npm test                     # 236 tests across 14 files
npm run lint                 # prettier check
npm run typecheck            # tsc --noEmit
npm run coverage             # vitest --coverage (text + html + lcov)
```

The package is an ESM (`"type": "module"`). All source is TypeScript under
`src/`, compiled to `dist/` by `tsc`. Tests live alongside in `tests/` and
are run via Vitest.

## Code Style

We use Prettier (config in `.prettierrc.json`) with `printWidth: 100`,
`trailingComma: "all"`, and LF line endings. `npm run format` rewrites the
codebase; `npm run lint` only checks. CI fails if formatting drifts.

EditorConfig (`.editorconfig`) is the source of truth for indent style and
final newlines — configure your editor to honor it.

## Project Layout

```
src/
  cli.ts          CLI entry, command parsing
  search.ts       Fuzzy search engine + Levenshtein
  history.ts      PSReadLine reader + shell router
  bash-history.ts Bash parser
  zsh-history.ts  Zsh parser
  fish-history.ts Fish parser
  output.ts       Result formatting + ANSI
  secrets.ts      API-key / token masking
  stats.ts        mem stats command
  bench.ts        mem bench command
  recent.ts       mem recent command
  welcome.ts      First-run welcome screen
  ansi.ts         Color constants
  types.ts        Shared interfaces
  utils.ts        PSReadLine path resolution
tests/            Vitest specs, one per module
```

## Adding a Shell Parser

`mem` supports `auto | powershell | bash | zsh | fish` via `--shell`. To add
a new one (e.g. `nu`, `tcsh`):

1. **Create `src/<shell>-history.ts`** exporting a single function:

   ```ts
   export function readShellHistory(limit: number): HistoryEntry[];
   ```

   The function must:
   - Locate the history file (`process.env.HISTFILE`, then standard paths).
   - Decode bytes with BOM detection if needed (`UTF-8`/`UTF-16 LE`).
   - Return entries **newest-first**, capped at `limit`.
   - Strip empty lines and never throw on missing files — return `[]`.

   Use the existing `bash-history.ts` as a template. The `HistoryEntry`
   interface lives in `src/types.ts`.

2. **Wire the parser into `src/history.ts`:**

   - Add the shell name to the `ShellSource` type.
   - Add a branch in `readHistory()` that routes to your parser.
   - Add a label to `shellLabel()`.

3. **Add CLI options** in `src/cli.ts` — every subcommand has a `--shell`
   option. Update each one with the new shell name.

4. **Write tests** in `tests/<shell>-history.test.ts`. Cover:
   - Plain mode
   - Extended / timestamp mode (if applicable)
   - CRLF endings
   - Multi-line commands
   - Limit enforcement
   - Missing file → empty array

5. **Document** in `README.md` and `docs/index.html` under "Cross-shell".

## Adding a Secret Pattern

`mem` masks known token formats in every output command. The pattern table
lives in `src/secrets.ts`.

Rules:

- **Order matters.** More specific patterns must come before generic ones
  (`sk-ant-` before `sk-`).
- **Capture the visible prefix** in group 1 and use `$1********` for the
  mask. The first 4+ chars of the secret are kept for identification;
  the rest is replaced.
- Use `\b` word boundaries on both ends.
- Err toward masking — a false positive is cosmetic, a miss is a leak.

```ts
{ re: /\b(myprovider_[A-Za-z0-9]{4})[A-Za-z0-9_-]+/g, mask: "$1********" }
```

Then add a test in `tests/secrets.test.ts`:

```ts
expect(mask("myprovider_abcdef1234567890")).toBe("myprovider_abcdef********");
```

And a **non-masking test** for a similar-looking but unrelated string to
guard against false positives.

## Tests

- Run `npm test` to execute the full suite once.
- Run `npm run test:watch` for TDD.
- Coverage is reported to `./coverage/` via `npm run coverage`.

All PRs must pass:

- `npm run lint`
- `npm run typecheck`
- `npm test`

CI runs these on Node 18, 20, and 22 across Ubuntu, Windows, and macOS —
see `.github/workflows/ci.yml`.

## Pull Requests

1. Fork and create a branch from `main`.
2. Make your change with tests.
3. Run the three checks above.
4. Push and open a PR.
5. The PR description should answer:
   - **What** does this change?
   - **Why** is it needed?
   - **How** did you test it?
   - Any **breaking changes**?

For substantial changes, open an issue first to discuss.

## Commit Messages

Conventional Commits are encouraged but not enforced:

```
feat(search): add token-boundary scoring
fix(secrets): tighten Discord token regex
docs(readme): clarify --shell flag on Windows
chore(deps): bump commander to 13.1
```

## Releases

See [RELEASING.md](./RELEASING.md). Maintainers cut releases; contributors
don't need to worry about this.

## Reporting Bugs / Requesting Shells

Use the [issue templates](../../issues/new/choose) — they're designed to
collect the platform, shell, and history-file details we need to reproduce
the report. Security issues: see [SECURITY.md](./SECURITY.md).
