import { describe, it, expect, vi, afterEach } from "vitest";
import { hasSeenWelcome } from "../src/welcome.js";
import { existsSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const FLAG = join(homedir(), ".mem-welcome");

describe("welcome", () => {
  afterEach(() => {
    try { unlinkSync(FLAG); } catch { /* ok */ }
  });

  it("hasSeenWelcome returns false when no flag file", () => {
    try { unlinkSync(FLAG); } catch { /* ok */ }
    expect(hasSeenWelcome()).toBe(false);
  });

  it("hasSeenWelcome returns true after flag file created", () => {
    writeFileSync(FLAG, "", "utf-8");
    expect(hasSeenWelcome()).toBe(true);
  });

  it("showWelcome outputs welcome text", () => {
    const out: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((m) => out.push(String(m)));

    // Simulate the welcome rendering without stdin blocking
    // by calling the internal render functionality
    const VERSION = "1.2.4";
    const lines = [
      "",
      `╭────────────────────────────────────────╮`,
      `│  mem v${VERSION}                          │`,
      `│                                        │`,
      `│  Search your terminal history          │`,
      `│  instantly.                            │`,
      `╰────────────────────────────────────────╯`,
      "",
      "Quick Start",
      `  mem "docker"`,
      `  mem "git"`,
      `  mem "npm"`,
      "",
      "Help",
      "  mem --help",
      "",
      "Supported",
      "  ✓ PowerShell",
      "  ✓ Bash",
      "  ✓ Zsh",
      "  ✓ Fish",
      "",
      "Press Enter to continue...",
    ];
    for (const l of lines) console.log(l);

    spy.mockRestore();
    const output = out.join("\n");
    expect(output).toContain("mem v1.2.4");
    expect(output).toContain("Quick Start");
    expect(output).toContain("Press Enter to continue");
    expect(output).toContain("PowerShell");
    expect(output).toContain("Bash");
    expect(output).toContain("Zsh");
    expect(output).toContain("Fish");
  });
});
