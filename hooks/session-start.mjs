#!/usr/bin/env node
/**
 * SessionStart hook: detect Effect project and inject a minimal context hint.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const cwd = process.env.CLAUDE_CWD || process.cwd();

function detectEffect() {
  try {
    const pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    return "effect" in deps || "@effect/platform" in deps || "@effect/cli" in deps;
  } catch {
    return false;
  }
}

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));

if (detectEffect()) {
  const hint = [
    "Effect v4 project detected. The effect-ts skill is active.",
    "Core patterns: ServiceMap.Service, Schema.Class, Schema.TaggedErrorClass, Effect.gen/Effect.fn, Layer composition.",
    "Reference docs are injected automatically when you read Effect files.",
    "Run: Read skills/effect-ts/SKILL.md for the full pattern guide.",
  ].join("\n");

  const output = {
    hookSpecificOutput: {
      additionalContext: `<effect-ts-patterns>\n${hint}\n</effect-ts-patterns>`,
    },
  };
  process.stdout.write(JSON.stringify(output));
} else {
  process.stdout.write("{}");
}
