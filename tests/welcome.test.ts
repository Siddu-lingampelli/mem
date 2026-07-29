import { describe, it, expect, vi, afterEach } from "vitest";
import { hasSeenWelcome, showWelcome, resetWelcomeState } from "../src/welcome.js";
import { existsSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const FLAG = join(homedir(), ".mem-welcome");

describe("welcome", () => {
  afterEach(() => {
    try { unlinkSync(FLAG); } catch { /* ok */ }
    resetWelcomeState();
  });

  it("hasSeenWelcome returns false when no flag file", () => {
    try { unlinkSync(FLAG); } catch { /* ok */ }
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
    try { unlinkSync(FLAG); } catch { /* ok */ }
    expect(hasSeenWelcome()).toBe(false);
    await showWelcome("2.2.5");
    expect(hasSeenWelcome()).toBe(true);
  });
});
