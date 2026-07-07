#!/usr/bin/env node

import { readHistory } from "./history.js";
import { preprocess, searchCached } from "./search.js";

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

  // Pre-process once (dedupe, tokenise, index)
  const processStart = performance.now();
  const cached = preprocess(entries);
  const processMs = performance.now() - processStart;

  // Measure search across several queries (reuses pre-processed data)
  const searchStart = performance.now();
  for (const q of BENCH_QUERIES) {
    searchCached(cached, entries.length, q);
  }
  const searchMs = performance.now() - searchStart;

  const totalMs = parseMs + processMs + searchMs;

  console.log(`History
  ${entries.length.toLocaleString()} commands

Parser
  ${parseMs.toFixed(0)} ms

Process
  ${processMs.toFixed(0)} ms

Search
  ${searchMs.toFixed(0)} ms

Total
  ${totalMs.toFixed(0)} ms`);
}
