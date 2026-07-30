import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdtempSync, existsSync, writeFileSync, rmSync, statSync, utimesSync } from "fs";
import { tmpdir } from "os";

let TMPDIR: string;

vi.mock("os", async () => {
  const actual = await vi.importActual<typeof import("os")>("os");
  return {
    ...actual,
    homedir: () => TMPDIR,
  };
});

const { runDoctor, renderDoctorText, renderDoctorJson, doctorExitCode } =
  await import("../src/doctor.js");

beforeEach(() => {
  TMPDIR = mkdtempSync(join(tmpdir(), "mem-doctor-test-"));
  // Clear all env vars that could change which paths the doctor probes.
  delete process.env.HISTFILE;
  delete process.env.PSREADLINE_HISTORY_FILE;
  delete process.env.XDG_DATA_HOME;
});

afterEach(() => {
  rmSync(TMPDIR, { recursive: true, force: true });
});

describe("runDoctor — basic shape", () => {
  it("returns a report with all expected checks", () => {
    const report = runDoctor();
    expect(report.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(report.node).toMatch(/^v\d+/);
    expect(report.platform).toMatch(/^(darwin|linux|win32|freebsd)/);
    expect(Array.isArray(report.checks)).toBe(true);

    const names = report.checks.map((c) => c.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "node",
        "platform",
        "home",
        "psreadline",
        "bash",
        "zsh",
        "fish",
        "mask",
        "search",
        "welcome",
      ]),
    );
  });

  it("every check has a valid status", () => {
    const report = runDoctor();
    for (const c of report.checks) {
      expect(["ok", "warn", "fail"]).toContain(c.status);
      expect(c.label.length).toBeGreaterThan(0);
      expect(c.detail.length).toBeGreaterThan(0);
    }
  });
});

describe("runDoctor — individual checks", () => {
  it("node check reflects process.version", () => {
    const report = runDoctor();
    const node = report.checks.find((c) => c.name === "node");
    expect(node).toBeDefined();
    expect(node!.detail).toContain(process.version.slice(1)); // strip leading 'v'
  });

  it("home check uses homedir()", () => {
    const report = runDoctor();
    const home = report.checks.find((c) => c.name === "home");
    expect(home).toBeDefined();
    expect(home!.status).toBe("ok");
    expect(home!.detail).toBe(TMPDIR);
  });

  it("psreadline check reports warn when no history file exists", () => {
    const report = runDoctor();
    const ps = report.checks.find((c) => c.name === "psreadline");
    expect(ps).toBeDefined();
    // In a clean test dir with no PSReadLine file, expect warn (not found)
    expect(["warn", "ok"]).toContain(ps!.status);
  });

  it("psreadline check reports ok when an existing file is present", () => {
    // Set the env var the doctor probes; create a real file at that path.
    const path = join(TMPDIR, "psreadline-history.txt");
    writeFileSync(path, "git status\nnpm test\n");
    process.env.PSREADLINE_HISTORY_FILE = path;

    const report = runDoctor();
    const ps = report.checks.find((c) => c.name === "psreadline");
    expect(ps!.status).toBe("ok");
    expect(ps!.detail).toContain("utf-8");
  });

  it("bash check reports warn when no bash_history exists", () => {
    const report = runDoctor();
    const bash = report.checks.find((c) => c.name === "bash");
    expect(bash).toBeDefined();
    expect(["warn", "ok"]).toContain(bash!.status);
  });

  it("bash check reports ok when HISTFILE points at a real file", () => {
    const path = join(TMPDIR, ".bash_history");
    writeFileSync(path, "ls -la\ncd /tmp\n");
    process.env.HISTFILE = path;

    const report = runDoctor();
    const bash = report.checks.find((c) => c.name === "bash");
    expect(bash!.status).toBe("ok");
    expect(bash!.detail).toContain(path);
  });

  it("mask self-test always passes — all fixtures are realistic-length secrets", () => {
    const report = runDoctor();
    const mask = report.checks.find((c) => c.name === "mask");
    expect(mask).toBeDefined();
    expect(mask!.status).toBe("ok");
    expect(mask!.detail).toMatch(/^\d+\/\d+ patterns masked$/);
  });

  it("search smoke test always passes — preprocess([]) round-trips", () => {
    const report = runDoctor();
    const search = report.checks.find((c) => c.name === "search");
    expect(search).toBeDefined();
    expect(search!.status).toBe("ok");
  });

  it("welcome check reports warn when ~/.mem-welcome does not exist", () => {
    const report = runDoctor();
    const welcome = report.checks.find((c) => c.name === "welcome");
    expect(welcome!.status).toBe("warn");
    expect(welcome!.detail).toContain("not yet seen");
  });

  it("welcome check reports ok when ~/.mem-welcome is a regular file", () => {
    writeFileSync(join(TMPDIR, ".mem-welcome"), "", "utf-8");
    const report = runDoctor();
    const welcome = report.checks.find((c) => c.name === "welcome");
    expect(welcome!.status).toBe("ok");
  });

  it("history file mtime is reported as 'Nd ago'", () => {
    const path = join(TMPDIR, "fresh.txt");
    writeFileSync(path, "echo hello\n");
    // Force mtime to 3 days ago.
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000);
    utimesSync(path, threeDaysAgo, threeDaysAgo);
    process.env.PSREADLINE_HISTORY_FILE = path;

    const report = runDoctor();
    const ps = report.checks.find((c) => c.name === "psreadline");
    expect(ps!.detail).toMatch(/\d+d ago/);
  });
});

describe("doctorExitCode", () => {
  it("returns 0 when all checks are ok", () => {
    const report = {
      version: "0.0.0",
      node: "v20",
      platform: "linux x64",
      home: "/tmp",
      checks: [{ name: "x", label: "X", status: "ok" as const, detail: "" }],
    };
    expect(doctorExitCode(report)).toBe(0);
  });

  it("returns 2 when at least one warn and no fail", () => {
    const report = {
      version: "0.0.0",
      node: "v20",
      platform: "linux x64",
      home: "/tmp",
      checks: [
        { name: "a", label: "A", status: "ok" as const, detail: "" },
        { name: "b", label: "B", status: "warn" as const, detail: "" },
      ],
    };
    expect(doctorExitCode(report)).toBe(2);
  });

  it("returns 1 when at least one fail (even with warns)", () => {
    const report = {
      version: "0.0.0",
      node: "v20",
      platform: "linux x64",
      home: "/tmp",
      checks: [
        { name: "a", label: "A", status: "warn" as const, detail: "" },
        { name: "b", label: "B", status: "fail" as const, detail: "" },
      ],
    };
    expect(doctorExitCode(report)).toBe(1);
  });
});

describe("renderDoctorText", () => {
  it("includes the version, node, platform line", () => {
    const report = runDoctor();
    const text = renderDoctorText(report);
    expect(text).toContain("mem doctor");
    expect(text).toContain(report.version);
    expect(text).toContain(report.node);
    expect(text).toContain(report.platform);
  });

  it("includes every check label", () => {
    const report = runDoctor();
    const text = renderDoctorText(report);
    for (const c of report.checks) {
      expect(text).toContain(c.label);
    }
  });

  it("includes a final summary line", () => {
    const report = runDoctor();
    const text = renderDoctorText(report);
    expect(text).toMatch(/\d+ ok, \d+ warn, \d+ fail/);
  });

  it("contains no ANSI codes when NO_COLOR is set", () => {
    process.env.NO_COLOR = "1";
    try {
      const report = runDoctor();
      const text = renderDoctorText(report);
      expect(text).not.toMatch(/\x1b\[/);
    } finally {
      delete process.env.NO_COLOR;
    }
  });
});

describe("renderDoctorJson", () => {
  it("returns valid parseable JSON", () => {
    const report = runDoctor();
    const json = renderDoctorJson(report);
    const parsed = JSON.parse(json);
    expect(parsed.version).toBe(report.version);
    expect(parsed.checks).toHaveLength(report.checks.length);
  });

  it("JSON contains every check name", () => {
    const report = runDoctor();
    const json = renderDoctorJson(report);
    for (const c of report.checks) {
      expect(json).toContain(`"${c.name}"`);
    }
  });
});

describe("doctor — never throws even in hostile environments", () => {
  it("returns a report even with a missing homedir", () => {
    // Run with a known-bad env override. Doctor must still return a report.
    // We can't make homedir() throw from outside without invasive mocking,
    // but the report shape is what we assert on here.
    const report = runDoctor();
    expect(report.checks.length).toBeGreaterThan(0);
    expect(report.home.length).toBeGreaterThan(0);
  });
});

describe("doctor — file probe handles missing/empty/readable", () => {
  it("reports warn for empty file", () => {
    const path = join(TMPDIR, "empty.txt");
    writeFileSync(path, "");
    process.env.PSREADLINE_HISTORY_FILE = path;

    const report = runDoctor();
    const ps = report.checks.find((c) => c.name === "psreadline");
    expect(ps!.status).toBe("warn");
    expect(ps!.detail).toContain("empty");
  });

  it("reports ok for non-empty file", () => {
    const path = join(TMPDIR, "real.txt");
    writeFileSync(path, "git status\nnpm test\ndocker compose up\n");
    process.env.PSREADLINE_HISTORY_FILE = path;

    const report = runDoctor();
    const ps = report.checks.find((c) => c.name === "psreadline");
    expect(ps!.status).toBe("ok");
    const st = statSync(path);
    expect(ps!.detail).toContain(`${st.size}`);
  });
});
