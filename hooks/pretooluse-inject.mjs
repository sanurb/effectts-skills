#!/usr/bin/env node
/**
 * PreToolUse hook (Claude Code): detect Effect patterns in file being read/edited,
 * inject relevant reference doc. Pattern config loaded from shared/patterns.json.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const pluginRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const refsDir = join(pluginRoot, "skills", "effect-ts", "references");

// Single source of truth for patterns
const rawPatterns = JSON.parse(
  readFileSync(join(pluginRoot, "shared", "patterns.json"), "utf-8")
);
const PATTERNS = rawPatterns.map((p) => ({
  match: new RegExp(p.patterns.join("|")),
  ref: p.ref,
}));

const seen = new Set((process.env.EFFECT_SEEN_REFS || "").split(",").filter(Boolean));

function loadRef(file) {
  try {
    return readFileSync(join(refsDir, file), "utf-8");
  } catch {
    return null;
  }
}

let input;
try {
  input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
} catch {
  process.stdout.write("{}");
  process.exit(0);
}

const toolInput = input.tool_input || {};
const filePath = toolInput.file_path || toolInput.path || toolInput.command || "";

if (!filePath.match(/\.tsx?$/)) {
  process.stdout.write("{}");
  process.exit(0);
}

let content = "";
try {
  const fullPath = filePath.startsWith("/") ? filePath : join(input.cwd || process.cwd(), filePath);
  if (existsSync(fullPath)) {
    content = readFileSync(fullPath, "utf-8");
  }
} catch {
  // File might not exist yet (Write)
}

if (!content) {
  process.stdout.write("{}");
  process.exit(0);
}

let injected = null;
for (const { match, ref } of PATTERNS) {
  if (match.test(content) && !seen.has(ref)) {
    const doc = loadRef(ref);
    if (doc) {
      seen.add(ref);
      injected = { ref, doc };
      break;
    }
  }
}

if (injected) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      additionalContext: `<effect-reference topic="${injected.ref}">\n${injected.doc}\n</effect-reference>`,
    },
    env: { EFFECT_SEEN_REFS: [...seen].join(",") },
  }));
} else {
  process.stdout.write("{}");
}
