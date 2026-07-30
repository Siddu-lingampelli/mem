# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.2.x   | :white_check_mark: |
| < 2.2.0 | :x:                |

Only the latest minor line receives security fixes. Older lines are best-effort.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security bugs.**

Email: `siddhartha.lingampalli@gmail.com` (PGP key on request)

When reporting, include:

1. A clear description of the issue and its impact.
2. Reproduction steps or a proof-of-concept.
3. The version affected (output of `mem --version`).
4. Your platform (OS, Node.js version, shell).
5. Whether the issue exposes your own secrets vs. lets an attacker affect others.

## Response Timeline

| Stage             | Target                                |
| ----------------- | ------------------------------------- |
| Acknowledgement   | within 72 hours                       |
| Triage & severity | within 7 days                         |
| Patch released    | within 30 days (high/critical sooner) |

## Disclosure Process

1. Report received and acknowledged.
2. Maintainer reproduces and assigns a CVSS-style severity.
3. Fix is developed privately on a private fork.
4. Coordinated disclosure: reporter is credited in the release notes unless anonymity is requested.
5. CVE filed if the issue warrants it (coordinated with the reporter).
6. Public advisory and patch released together.

## Out of Scope

- Reports against running an outdated, unsupported version (please upgrade first).
- Theoretical issues without a working PoC.
- Vulnerabilities in Node.js, the OS, or `commander` — report those upstream.
- "My secret was visible in my terminal because I disabled `NO_COLOR`" — `mem` masks secrets in output but cannot enforce it in user-supplied pipes.

## Built-in Mitigations

- **Secret masking**: `mem` automatically redacts GitHub, Stripe, OpenAI, Anthropic, AWS, Google, JWT, Slack, npm, and 20+ other secret formats in every output command (`search`, `stats`, `recent`).
- **No network access**: `mem` never opens sockets. Your history never leaves your machine.
- **Read-only**: `mem` never writes to history files. It cannot corrupt them.

If you discover a way around any of these, please report it.
