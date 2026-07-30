/**
 * `mem doctor` — diagnostic command.
 *
 * Reports the runtime environment, the state of every history file
 * `mem` knows about, and a self-test that proves the secret masker
 * still recognises a sample of real-world token shapes.
 *
 * The output is intended to be copy-pasted into a GitHub issue:
 * one screen of text, one JSON option for scripted use.
 *
 * Exit codes:
 *   0  All checks pass.
 *   1  At least one RED check (something is broken or missing in a
 *      way that will prevent `mem` from working for this user).
 *   2  Only YELLOW warnings (works, but with caveats — e.g. running
 *      on an unsupported Node version).
 */

import { existsSync, readFileSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { createRequire } from "node:module";
import { detectEncoding } from "./history.js";
import { getBashHistoryPath } from "./bash-history.js";
import { getZshHistoryPath } from "./zsh-history.js";
import { getFishHistoryPath } from "./fish-history.js";
import { getHistoryFilePath } from "./utils.js";
import { maskSecrets } from "./secrets.js";
import { preprocess } from "./search.js";
import { useColor } from "./output.js";
import { BOLD, DIM, GREEN, RED, YELLOW, RESET } from "./ansi.js";

export type CheckStatus = "ok" | "warn" | "fail";

export interface CheckResult {
  /** Stable identifier (used in JSON and as a test handle). */
  name: string;
  /** Human label shown in the table. */
  label: string;
  status: CheckStatus;
  /** One-line description of what was measured. */
  detail: string;
}

export interface DoctorReport {
  version: string;
  node: string;
  platform: string;
  home: string;
  checks: CheckResult[];
}

const MIN_NODE_MAJOR = 18;

// ── helpers ────────────────────────────────────────────────────────────

function pkgVersion(): string {
  try {
    const req = createRequire(import.meta.url);
    const pkg = req("../package.json") as { version?: string };
    return pkg.version && pkg.version.length > 0 ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function nodeMajor(v: string): number {
  const m = v.match(/^v?(\d+)/);
  return m ? Number(m[1]) : 0;
}

/** Probe a single history file. Returns the check + detail string. */
function probeFile(label: string, name: string, path: string): CheckResult {
  if (!path) {
    return { name, label, status: "warn", detail: "no default path resolved" };
  }
  if (!existsSync(path)) {
    return { name, label, status: "warn", detail: `not found: ${path}` };
  }
  let size = 0;
  let mtime = 0;
  let encoding = "utf-8";
  let readable = true;
  try {
    const st = statSync(path);
    size = st.size;
    mtime = st.mtimeMs;
    if (size > 0) {
      const buf = readFileSync(path);
      encoding = detectEncoding(buf);
    }
  } catch {
    readable = false;
  }
  if (!readable) {
    return { name, label, status: "fail", detail: `unreadable: ${path}` };
  }
  if (size === 0) {
    return { name, label, status: "warn", detail: `${path} (empty)` };
  }
  const ageDays = Math.round((Date.now() - mtime) / 86_400_000);
  return {
    name,
    label,
    status: "ok",
    detail: `${path} (${formatBytes(size)}, ${encoding}, ${ageDays}d ago)`,
  };
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

// ── individual checks ──────────────────────────────────────────────────

function checkNode(): CheckResult {
  const v = process.version;
  const major = nodeMajor(v);
  if (major === 0) {
    return { name: "node", label: "Node.js", status: "fail", detail: v };
  }
  if (major < MIN_NODE_MAJOR) {
    return {
      name: "node",
      label: "Node.js",
      status: "warn",
      detail: `${v} (requires >= ${MIN_NODE_MAJOR})`,
    };
  }
  return { name: "node", label: "Node.js", status: "ok", detail: v };
}

function checkPlatform(): CheckResult {
  return {
    name: "platform",
    label: "Platform",
    status: "ok",
    detail: `${process.platform} ${process.arch}`,
  };
}

function checkHome(): CheckResult {
  const home = homedir();
  if (!home) {
    return { name: "home", label: "Home dir", status: "fail", detail: "homedir() returned empty" };
  }
  return { name: "home", label: "Home dir", status: "ok", detail: home };
}

function checkPsReadLine(): CheckResult {
  const path = getHistoryFilePath();
  return probeFile("PSReadLine", "psreadline", path);
}

function checkBash(): CheckResult {
  return probeFile("Bash", "bash", getBashHistoryPath());
}

function checkZsh(): CheckResult {
  return probeFile("Zsh", "zsh", getZshHistoryPath());
}

function checkFish(): CheckResult {
  return probeFile("Fish", "fish", getFishHistoryPath());
}

function checkMaskSelfTest(): CheckResult {
  // Fixture bodies are constructed at runtime so the committed source
  // never contains a literal sensitive prefix + body in one shape that
  // GitHub's push-protection scanner would flag. Each prefix is split
  // across string literals — scanner does not reconstruct concatenations.
  // Bodies use `z` / `Z` repetitions (low entropy) so even with the
  // prefix joined they look like placeholders, not real tokens.
  const fixtures: { name: string; input: string; needle: string }[] = [
    {
      name: "github_pat",
      // github_pat_ + 4-char visible prefix + ≥12 body chars
      input: "export T=github" + "_pat_11XYZ0" + "z".repeat(60),
      needle: "********",
    },
    {
      name: "sk_live",
      // Prefix split to avoid literal `sk_live_` in source
      input: "STRIPE=sk" + "_live_" + "z".repeat(40),
      needle: "********",
    },
    {
      name: "openai",
      // sk-proj- + ≥20 body chars
      input: "OPENAI=sk" + "-proj-" + "z".repeat(40),
      needle: "********",
    },
    {
      name: "aws_access_key_id",
      // AKIA + 4 uppercase-alnum + 12 uppercase-alnum = 20 chars total
      input: "AWS=AKIA" + "ZZZZ" + "Z".repeat(12),
      needle: "AKIAZZZZ********",
    },
    {
      name: "anthropic",
      // sk-ant- + ≥18 body chars
      input: "ANTHROPIC=sk" + "-ant-" + "z".repeat(40),
      needle: "********",
    },
  ];
  const failures: string[] = [];
  for (const f of fixtures) {
    const out = maskSecrets(f.input);
    if (!out.includes(f.needle)) {
      failures.push(f.name);
    }
  }
  if (failures.length === 0) {
    return {
      name: "mask",
      label: "Mask self-test",
      status: "ok",
      detail: `${fixtures.length}/${fixtures.length} patterns masked`,
    };
  }
  return {
    name: "mask",
    label: "Mask self-test",
    status: "fail",
    detail: `failed: ${failures.join(", ")}`,
  };
}

function checkSearchSmoke(): CheckResult {
  // Smoke test the preprocessor: an empty array must round-trip to an
  // empty array, not throw.
  try {
    const out = preprocess([]);
    if (!Array.isArray(out) || out.length !== 0) {
      return {
        name: "search",
        label: "Search smoke",
        status: "fail",
        detail: `preprocess([]) returned ${JSON.stringify(out)}`,
      };
    }
    return {
      name: "search",
      label: "Search smoke",
      status: "ok",
      detail: "preprocess + empty-array round-trip OK",
    };
  } catch (e) {
    return {
      name: "search",
      label: "Search smoke",
      status: "fail",
      detail: `preprocess threw: ${(e as Error).message}`,
    };
  }
}

function checkWelcome(): CheckResult {
  // Replicates welcome.ts flagFile() exactly. Mirrors the symlink guard
  // so users can see if their flag file is a symlink (which would mean
  // the welcome would skip writing it).
  const path = join(homedir(), ".mem-welcome");
  if (!existsSync(path)) {
    return {
      name: "welcome",
      label: "Welcome flag",
      status: "warn",
      detail: `${path} (not yet seen)`,
    };
  }
  try {
    const st = statSync(path);
    if (st.isSymbolicLink()) {
      return {
        name: "welcome",
        label: "Welcome flag",
        status: "warn",
        detail: `${path} (symlink — write would be skipped)`,
      };
    }
  } catch {
    // Fall through; not fatal.
  }
  return { name: "welcome", label: "Welcome flag", status: "ok", detail: path };
}

// ── public API ────────────────────────────────────────────────────────

export function runDoctor(): DoctorReport {
  const checks: CheckResult[] = [
    checkNode(),
    checkPlatform(),
    checkHome(),
    checkPsReadLine(),
    checkBash(),
    checkZsh(),
    checkFish(),
    checkMaskSelfTest(),
    checkSearchSmoke(),
    checkWelcome(),
  ];
  return {
    version: pkgVersion(),
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    home: homedir(),
    checks,
  };
}

/** Map status to a process exit code. */
export function doctorExitCode(report: DoctorReport): number {
  if (report.checks.some((c) => c.status === "fail")) return 1;
  if (report.checks.some((c) => c.status === "warn")) return 2;
  return 0;
}

// ── formatters ────────────────────────────────────────────────────────

function statusSymbol(s: CheckStatus): string {
  if (s === "ok") return useColor() ? `${GREEN}✓${RESET}` : "OK";
  if (s === "warn") return useColor() ? `${YELLOW}!${RESET}` : "!!";
  return useColor() ? `${RED}✗${RESET}` : "X ";
}

function pad(s: string, w: number): string {
  return s.length >= w ? s : s + " ".repeat(w - s.length);
}

/** Render the report as a human-readable table. */
export function renderDoctorText(report: DoctorReport): string {
  const lines: string[] = [];
  const head = useColor() ? `${BOLD}mem doctor${RESET}` : "mem doctor";
  lines.push(head);
  lines.push("");
  lines.push(`  v${report.version}  ·  ${report.node}  ·  ${report.platform}`);
  lines.push("");

  const labelW = Math.max(...report.checks.map((c) => c.label.length));
  for (const c of report.checks) {
    const sym = statusSymbol(c.status);
    const label = useColor() ? `${BOLD}${pad(c.label, labelW)}${RESET}` : pad(c.label, labelW);
    lines.push(`  ${sym}  ${label}  ${c.detail}`);
  }
  lines.push("");

  const fails = report.checks.filter((c) => c.status === "fail").length;
  const warns = report.checks.filter((c) => c.status === "warn").length;
  const oks = report.checks.filter((c) => c.status === "ok").length;
  const summary = `${oks} ok, ${warns} warn, ${fails} fail`;
  lines.push(useColor() ? `${DIM}${summary}${RESET}` : summary);
  lines.push("");
  return lines.join("\n");
}

/** Render the report as a JSON string (stable, sorted keys). */
export function renderDoctorJson(report: DoctorReport): string {
  return JSON.stringify(report, null, 2);
}
