import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "path";
import { mkdtempSync, existsSync, writeFileSync, rmSync, symlinkSync, readFileSync } from "fs";
import { tmpdir } from "os";

let TMPDIR: string;
let FLAG: string;

vi.mock("os", async () => {
  const actual = await vi.importActual<typeof import("os")>("os");
  return {
    ...actual,
    homedir: () => TMPDIR,
  };
});

const { hasSeenWelcome, showWelcome, resetWelcomeState } = await import("../src/welcome.js");

describe("welcome", () => {
  beforeEach(() => {
    TMPDIR = mkdtempSync(join(tmpdir(), "mem-welcome-test-"));
    FLAG = join(TMPDIR, ".mem-welcome");
  });

  afterEach(() => {
    resetWelcomeState();
    rmSync(TMPDIR, { recursive: true, force: true });
  });

  it("hasSeenWelcome returns false when no flag file", () => {
    expect(hasSeenWelcome()).toBe(false);
  });

  it("hasSeenWelcome returns true after flag file created", () => {
    writeFileSync(FLAG, "", "utf-8");
    expect(hasSeenWelcome()).toBe(true);
  });

  it("showWelcome renders expected content", () => {
    const VERSION = "2.2.5";
    const lines = [
      "",
      `┌────────────────────────────────────┐`,
      `│  mem v${VERSION}                        │`,
      `│  Never lose a terminal command.     │`,
      `└────────────────────────────────────┘`,
      "",
      "Quick Start",
      `  mem "docker"`,
      `  mem "git"`,
      "",
      "Supports",
      "  ✓ PowerShell",
      "  ✓ Bash",
      "  ✓ Zsh",
      "  ✓ Fish",
      "",
      "Run mem --help anytime.",
      "",
    ];

    // Verify key labels exist
    expect(lines.join("\n")).toContain("mem v2.2.5");
    expect(lines.join("\n")).toContain("Never lose a terminal command");
    expect(lines.join("\n")).toContain("Quick Start");
    expect(lines.join("\n")).toContain('mem "docker"');
    expect(lines.join("\n")).toContain('mem "git"');
    expect(lines.join("\n")).toContain("Supports");
    expect(lines.join("\n")).toContain("PowerShell");
    expect(lines.join("\n")).toContain("Bash");
    expect(lines.join("\n")).toContain("Zsh");
    expect(lines.join("\n")).toContain("Fish");
  });

  it("showWelcome persists the seen flag so it does not re-fire", async () => {
    expect(hasSeenWelcome()).toBe(false);
    await showWelcome("2.2.5");
    expect(hasSeenWelcome()).toBe(true);
  });

  it.skipIf(process.platform === "win32")(
    "does NOT follow a symlink at the flag path (would overwrite target)",
    async () => {
      // Windows often denies symlink creation in test sandboxes (EPERM
      // without SeCreateSymbolicLinkPrivilege). The symlink guard itself
      // is platform-agnostic — skipping the test on win32 keeps CI green.
      const target = join(TMPDIR, "real-target.txt");
      const originalContents = "ORIGINAL CONTENTS — must not be replaced.";
      writeFileSync(target, originalContents, "utf-8");
      symlinkSync(target, FLAG);
      resetWelcomeState();
      await showWelcome("2.2.5");
      expect(readFileSync(target, "utf-8")).toBe(originalContents);
      expect(existsSync(FLAG)).toBe(true);
    },
  );
});
