# Releasing `mem-terminal`

Step-by-step checklist for cutting a new release. **Maintainers only.**
Run through every step — if any fails, fix before continuing.

## Prerequisites

- npm account with publish access to `mem-terminal`.
- Logged in locally: `npm whoami` should print your username.
- 2FA configured on your npm account (publish requires `--otp`).
- Clean `main` branch: `git status` is empty.
- Local Node matches CI matrix (≥ 18).

## Pre-Release

- [ ] All intended changes are merged to `main` via PR.
- [ ] CI on the merge commit is green: lint, typecheck, test, build, pack.
- [ ] No open security issues at `high` or `critical` severity.
- [ ] Local sanity check:

  ```bash
  git checkout main
  git pull --rebase origin main
  npm ci
  npm run lint
  npm run typecheck
  npm test
  npm run coverage
  npm run build
  ```

## Bump the Version

`mem-terminal` follows **Semantic Versioning**:

| Change kind                 | Bump                    |
| --------------------------- | ----------------------- |
| Bug fix, internal refactor  | `2.2.6 → 2.2.7` (patch) |
| Backward-compatible feature | `2.2.6 → 2.3.0` (minor) |
| Breaking change             | `2.2.6 → 3.0.0` (major) |

```bash
npm version patch   # or minor / major
git push origin main --follow-tags
```

`npm version` updates `package.json` and `package-lock.json`, creates a
commit, and tags it (`vX.Y.Z`). The version is read from `package.json`
at runtime, so no source changes are required.

## Update CHANGELOG

Move the `[Unreleased]` section to a dated version section in `CHANGELOG.md`:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added

- …

### Changed

- …

### Fixed

- …
```

Commit:

```bash
git add CHANGELOG.md
git commit -m "docs(changelog): X.Y.Z"
git push origin main
```

## Verify the Tag

```bash
git fetch --tags
git checkout vX.Y.Z
npm ci
npm run build
npm test
node dist/cli.js --version   # should print "mem vX.Y.Z"
```

## Publish to npm

```bash
npm publish --access public --otp=<6-digit-code>
```

Watch the output:

- Confirm `+ mem-terminal@X.Y.Z`.
- Confirm exit code `0`.

If publish fails with `E403` — check 2FA.
If publish fails with `ENEEDAUTH` — `npm login`.
If publish fails with `EPUBLISHCONFLICT` — version already exists; you
forgot to bump.

## Post-Publish

- [ ] Confirm on the registry:

  ```bash
  npm view mem-terminal version
  npm view mem-terminal dist-tags
  ```

- [ ] Install globally from the registry on a clean machine:

  ```bash
  npm install -g mem-terminal
  mem --version
  mem "docker"
  ```

- [ ] Push the GitHub release:

  ```bash
  gh release create vX.Y.Z \
    --title "vX.Y.Z" \
    --notes-file - <<EOF
  See [CHANGELOG.md](./CHANGELOG.md) for the full list of changes.

  Install: npm install -g mem-terminal
  EOF
  ```

- [ ] Announce (Discord / discussions / etc.):
      copy the high-level bullets from the GitHub release notes.

## Hotfix Path

For an emergency fix on an already-released version:

1. Branch from the released tag: `git checkout -b hotfix/X.Y.Z vX.Y.Z-1`.
2. Apply the minimal fix + test.
3. Bump patch: `npm version patch`.
4. Run pre-release checks.
5. Merge to `main` (PR or fast-forward).
6. Publish as above.

Do **not** push a hotfix commit directly to `main` without a PR — CI
must run first.

## Rolling Back

npm versions are immutable. To "unpublish" a broken release:

- **Within 72 hours** of publish: `npm unpublish mem-terminal@X.Y.Z` (allowed by npm policy).
- **After 72 hours**: deprecate instead:

  ```bash
  npm deprecate mem-terminal@X.Y.Z "broken: use X.Y.Z+1 instead"
  ```

  Then immediately cut a patch release with the fix.
