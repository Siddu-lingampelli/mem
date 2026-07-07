#!/usr/bin/env node

import { readHistory } from "./history.js";
import { search } from "./search.js";

const BENCH_QUERIES = ["git", "docker", "npm", "ssh", "node"];

export function runBench(limit = 50000): void {
  // Measure history parsing
  const parseStart = performance.now();
  const entries = readHistory(limit);
  const parseMs = performance.now() - parseStart;

  if (entries.length === 0) {
    console.log("No history found. Nothing to benchmark.");
    return;
  }

  // Measure search across several queries
  const searchStart = performance.now();
  for (const q of BENCH_QUERIES) {
    search(entries, q);
  }
  const searchMs = performance.now() - searchStart;

  const totalMs = parseMs + searchMs;

  console.log(`History
  ${entries.length.toLocaleString()} commands

Parser
  ${parseMs.toFixed(0)} ms

Search
  ${searchMs.toFixed(0)} ms

Total
  ${totalMs.toFixed(0)} ms`);
}
