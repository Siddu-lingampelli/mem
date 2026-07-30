# Changelog

All notable changes to `mem-terminal` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.7] - 2026-07-30

### Added

- GitHub Actions CI matrix (lint, typecheck, test, build, pack dry-run) on Node 18 / 20 / 22 across Ubuntu, Windows, macOS.
- Dependabot config: weekly auto-PRs for npm and GitHub Actions.
- Issue templates: `bug_report.yml`, `feature_request.yml`, `shell_parser_request.yml`, `question.yml`.
- `SECURITY.md`: supported versions, vulnerability reporting process, disclosure timeline.
- `CONTRIBUTING.md`: dev setup, adding shell parsers and secret patterns, PR process.
- `vitest.config.ts` with coverage thresholds (80 % lines / functions / statements, 75 % branches).
- Coverage reporting via `@vitest/coverage-v8` with Codecov upload in CI.
- Prettier (`prettier --check` in CI) and `.editorconfig`.
- Badges in `README.md`: CI, Codecov, npm version, license.
- Secret pattern coverage extended: Vercel, Linear, PlanetScale, Cloudflare (`cf-` / `cf_`), Heroku, Twilio, and AWS secret keys (with `aws_secret_access_key=` context).
- `pwsh` alias accepted for `--shell powershell`; case-insensitive shell name matching.
- Test fixtures for all secret patterns updated to realistic 50+ char lengths to match real-world token formats.

### Changed

- Version is now resolved from `package.json` at runtime via `createRequire`, eliminating drift between `src/cli.ts` and the npm manifest.
- `preprocess` canonicalises the displayed command to lowercase on second occurrence so dedup merges `GIT STATUS` with `git status`.
- `isNoise` now normalises whitespace (`mem  search foo` matches the `mem search` prefix).
- `scoreCmd` no longer divides by zero when no token has a meaningful match.
- `detectEncoding` returns a single `'utf-8' | 'utf16le'` union (removed redundant `'utf8'` literal).
- Bash / Zsh / Fish history readers strip a leading UTF-8 BOM before parsing.

### Fixed

- `parseCount` now rejects `1.5`, `5e2`, `5abc`, `+5` (no more silent truncation).
- `parseShell` no longer silently falls back to `auto` for case-mismatched names.
- Discord token regex no longer false-matches `git checkout <sha>.<sha>.<sha>` or `1.0.0` version strings.
- `showWelcome` no longer follows a `~/.mem-welcome` symlink (was at risk of overwriting `~/.bashrc`).
- Secret pattern minimum body lengths raised to `{12-24,}` so `sk_finance`, `dapiformat`, `glpat-classic`, etc. are no longer masked.

## [2.2.6] - 2026-07-29

### Changed

- `src/ansi.ts` extracted from `src/output.ts` for clarity.
- Drop dead `?? 20` defensive fallback in `recent` command.
- Sync `docs/PROJECT.md` with v2.2.6.

## [2.2.6] - 2026-07-29

### Changed

- `src/ansi.ts` extracted from `src/output.ts` for clarity.
- Drop dead `?? 20` defensive fallback in `recent` command.
- Sync `docs/PROJECT.md` with v2.2.6.

## [2.2.5]

### Added

- First-run welcome screen (`mem` with no args on a fresh install).
- `mem recent -n N` command for newest N commands with secret masking.

## [2.2.x]

### Added

- Cross-shell history readers: Bash, Zsh, Fish, in addition to PSReadLine.
- `--shell <auto|powershell|bash|zsh|fish>` flag on every command.
- Custom help formatter (`mem --help`).
- `mem stats [-n N]` command with ASCII bar charts.
- `mem bench [-l N]` command for parse / process / search timings.

### Changed

- Search engine rewritten with token-aware scoring and bounded Levenshtein distance.
- Preprocessing split (`preprocess()` + `searchCached()`) so multiple queries share work.

## [1.2.8]

### Added

- `mem recent` command.
- Secret masking on display (GitHub, Stripe, OpenAI, AWS, Google, JWT, Slack, npm, and 20+ other formats).

## [1.2.7]

### Added

- `mem stats` command.

## [1.2.6]

### Added

- `mem bench` command.

## [1.2.5]

### Added

- First-run welcome screen.

## [1.0.0]

### Added

- PowerShell / PSReadLine history search.
- Fuzzy matching with Levenshtein distance.
- Case-insensitive deduplication with usage counts.
- ANSI-coloured output with word highlighting.
- UTF-8 / UTF-16 LE BOM detection.
