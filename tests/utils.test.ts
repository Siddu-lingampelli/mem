import { describe, it, expect } from "vitest";
import { getHistoryFilePath } from "../src/utils.js";

describe("getHistoryFilePath", () => {
  it("uses PSREADLINE_HISTORY_FILE env var when set", () => {
    process.env.PSREADLINE_HISTORY_FILE = "/custom/path/history.txt";
    expect(getHistoryFilePath()).toBe("/custom/path/history.txt");
  });
});
