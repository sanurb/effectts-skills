#!/usr/bin/env node
/**
 * Validation tests for the effectts-skills harness.
 * Checks cross-source consistency, canonical signatures, and shared config.
 *
 * Run: node tests/scaffold-generators.test.mjs
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

function read(relPath) {
  return readFileSync(join(root, relPath), "utf-8");
}

const ext = read("extensions/effect-context.ts");
const scaffoldSkill = read("skills/effect-scaffold/SKILL.md");
const mainSkill = read("skills/effect-ts/SKILL.md");
const reviewSkill = read("skills/effect-review/SKILL.md");
const antiPatterns = read("skills/effect-ts/references/anti-patterns.md");
const errorHandling = read("skills/effect-ts/references/error-handling.md");
const servicesRef = read("skills/effect-ts/references/services.md");
const testingRef = read("skills/effect-ts/references/testing.md");
const configRef = read("skills/effect-ts/references/config.md");
const schemaDecisions = read("skills/effect-ts/references/schema-decisions.md");
const dataModeling = read("skills/effect-ts/references/data-modeling.md");

// ─── 1. ServiceMap.Service signature consistency ─────────────────────

console.log("=== ServiceMap.Service signature ===");

// Canonical: ServiceMap.Service<Name, { interface }>()("tag")
assert(
  ext.includes("ServiceMap.Service<${name},"),
  "Extension generator uses <Name, Interface> signature"
);
assert(
  scaffoldSkill.includes("ServiceMap.Service<{Name},"),
  "Scaffold SKILL.md uses <Name, Interface> signature"
);
assert(
  mainSkill.includes("ServiceMap.Service<Users,"),
  "Main SKILL.md uses <Name, Interface> signature"
);
assert(
  servicesRef.includes("ServiceMap.Service<"),
  "services.md uses generic ServiceMap.Service"
);

// ─── 2. No @app/ tag convention anywhere ─────────────────────────────

console.log("\n=== Tag convention (no @app/) ===");

const filesToCheck = {
  "Extension": ext,
  "Scaffold SKILL.md": scaffoldSkill,
  "Main SKILL.md": mainSkill,
  "services.md": servicesRef,
  "testing.md": testingRef,
  "config.md": configRef,
};

for (const [name, content] of Object.entries(filesToCheck)) {
  // Check code blocks
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  const inCode = codeBlocks.some(b => b.includes('"@app/'));
  assert(!inCode, `${name} has no @app/ in code blocks`);
  // Check <critical> blocks and tag: lines (prose that agents treat as instructions)
  const critBlocks = content.match(/<critical>[\s\S]*?<\/critical>/g) || [];
  const inCritical = critBlocks.some(b => b.includes('@app/'));
  assert(!inCritical, `${name} has no @app/ in <critical> blocks`);
}

// ─── 3. TaggedErrorClass signature ──────────────────────────────────

console.log("\n=== TaggedErrorClass<T>() signature ===");

// Canonical: Schema.TaggedErrorClass<T>()("Tag", {...})
// Wrong:     Schema.TaggedErrorClass("Tag")("Tag", {...})
assert(
  ext.includes('TaggedErrorClass<${name}NotFoundError>()'),
  "Extension: TaggedErrorClass has type parameter"
);
assert(
  !errorHandling.includes('TaggedErrorClass("'),
  "error-handling.md: no old TaggedErrorClass(\"Tag\") pattern"
);

// ─── 4. No dead code / v3 APIs in scaffolds ────────────────────────

console.log("\n=== No dead code or v3 APIs ===");

assert(
  !ext.includes("expect(true).toBe(true)"),
  "Extension: no dead test assertions"
);
assert(
  !scaffoldSkill.includes("expect(true).toBe(true)"),
  "Scaffold SKILL.md: no dead test assertions"
);
assert(
  !ext.includes("expect(") && !ext.includes("from \"vitest\""),
  "Extension test scaffold uses assert, not expect"
);
assert(
  ext.includes("assert.") || ext.includes("from \"@effect/vitest\""),
  "Extension test scaffold imports from @effect/vitest"
);

// ─── 5. Branded IDs have real constraints ───────────────────────────

console.log("\n=== Branded IDs with constraints ===");

assert(
  ext.includes("Schema.pattern"),
  "Extension scaffold uses Schema.pattern for ID brands"
);
assert(
  scaffoldSkill.includes("Schema.pattern"),
  "Scaffold SKILL.md uses Schema.pattern for ID brands"
);

// ─── 6. Single source of truth: anti-patterns ───────────────────────

console.log("\n=== Anti-pattern deduplication ===");

const dispatchTable = read("skills/effect-review/references/rule-dispatch-table.md");
assert(
  dispatchTable.includes("anti-patterns.md"),
  "Review dispatch table references anti-patterns.md as source of truth"
);
assert(
  !reviewSkill.includes("| C1 |"),
  "Review skill does NOT duplicate the full checklist table"
);
assert(
  antiPatterns.includes("| C1 |") && antiPatterns.includes("| W9 |"),
  "anti-patterns.md has complete checklist (C1 through W9)"
);
assert(
  schemaDecisions.includes("see [anti-patterns.md]"),
  "schema-decisions.md cross-references anti-patterns.md"
);
assert(
  dataModeling.includes("see [schema-decisions.md]"),
  "data-modeling.md cross-references schema-decisions.md for branded types"
);

// ─── 7. Shared patterns.json ────────────────────────────────────────

console.log("\n=== Shared pattern config ===");

const patterns = JSON.parse(read("shared/patterns.json"));
assert(Array.isArray(patterns) && patterns.length === 8, "patterns.json has 8 entries");

for (const p of patterns) {
  assert(typeof p.id === "string" && p.id.length > 0, `  ${p.id}: has id`);
  assert(Array.isArray(p.patterns) && p.patterns.length > 0, `  ${p.id}: has patterns`);
  assert(typeof p.ref === "string" && p.ref.endsWith(".md"), `  ${p.id}: ref is .md`);
  const refPath = join(root, "skills", "effect-ts", "references", p.ref);
  assert(existsSync(refPath), `  ${p.id}: ${p.ref} exists on disk`);

  // Verify each regex compiles
  for (const pat of p.patterns) {
    try {
      new RegExp(pat);
      assert(true, `  ${p.id}: regex "${pat.slice(0, 30)}" compiles`);
    } catch {
      assert(false, `  ${p.id}: regex "${pat}" INVALID`);
    }
  }
}

// Verify extension loads from shared config
assert(
  ext.includes("shared/patterns.json") || ext.includes("shared", "patterns.json"),
  "Extension loads patterns from shared/patterns.json"
);

// Verify hook loads from shared config
const hook = read("hooks/pretooluse-inject.mjs");
assert(
  hook.includes("shared") && hook.includes("patterns.json"),
  "Hook loads patterns from shared/patterns.json"
);

// ─── 8. v4 API correctness ───────────────────────────────────────────

console.log("\n=== v4 API correctness ===");

const allRefs = [
  ["anti-patterns.md", antiPatterns],
  ["error-handling.md", errorHandling],
  ["services.md", servicesRef],
  ["testing.md", testingRef],
  ["layers.md", read("skills/effect-ts/references/layers.md")],
  ["processes.md", read("skills/effect-ts/references/processes.md")],
];

for (const [name, content] of allRefs) {
  const codeBlocks = (content.match(/```[\s\S]*?```/g) || []).join("\n");
  // v3 APIs that should NOT appear in code blocks
  assert(
    !codeBlocks.includes("Effect.catchAll(") && !codeBlocks.includes("Effect.catchAll "),
    `${name}: no v3 Effect.catchAll in code (v4: Effect.catch)`
  );
  assert(
    !codeBlocks.includes("Effect.fork(") || name === "processes.md",
    `${name}: no v3 Effect.fork in code (v4: Effect.forkChild)`
  );
  assert(
    !codeBlocks.includes("Effect.forkDaemon("),
    `${name}: no v3 Effect.forkDaemon in code (v4: Effect.forkDetach)`
  );
  assert(
    !codeBlocks.includes("Effect.catchAllCause("),
    `${name}: no v3 Effect.catchAllCause in code (v4: Effect.catchCause)`
  );
}

// Check testing references use assert not expect
const testingCode = (testingRef.match(/```[\s\S]*?```/g) || []).join("\n");
assert(
  !testingCode.includes("expect("),
  "testing.md: uses assert, not expect, in code blocks"
);

// Check scaffold templates use assert
const scaffoldCode = (scaffoldSkill.match(/```[\s\S]*?```/g) || []).join("\n");
assert(
  !scaffoldCode.includes("expect("),
  "Scaffold SKILL.md: uses assert, not expect, in code blocks"
);

// ─── 9. Version gate in scaffold ────────────────────────────────────

console.log("\n=== Version gate ===");

assert(
  scaffoldSkill.includes("Step 0") && scaffoldSkill.includes("Verify Effect v4"),
  "Scaffold SKILL.md has Step 0: Verify Effect v4"
);
assert(
  scaffoldSkill.includes("STOP") && scaffoldSkill.includes("v{version}"),
  "Scaffold SKILL.md has STOP condition for non-v4 projects"
);

// ─── 10. No dead code / unused imports ───────────────────────────────

console.log("\n=== No dead code ===");

assert(
  !ext.includes("isToolCallEventType"),
  "Extension: no unused isToolCallEventType import"
);

// ─── 11. Cross-skill reference path ─────────────────────────────────

console.log("\n=== Cross-skill reference paths ===");

assert(
  dispatchTable.includes("skills/effect-ts/references/anti-patterns.md"),
  "Review dispatch table uses full path to anti-patterns.md"
);

// ─── 12. No bare brands in reference examples ──────────────────────

console.log("\n=== Branded IDs in references ===");

// Check that services.md doesn't have bare Schema.brand without Schema.pattern nearby
const servicesLines = servicesRef.split("\n");
for (let i = 0; i < servicesLines.length; i++) {
  if (servicesLines[i].includes('Schema.brand(') && servicesLines[i].includes('Schema.String.pipe')) {
    // Check that Schema.pattern appears within 2 lines
    const context = servicesLines.slice(Math.max(0, i-1), i+3).join("\n");
    assert(
      context.includes("Schema.pattern") || context.includes("Schema.NonEmptyString"),
      `services.md line ${i+1}: branded ID has real constraint`
    );
  }
}

// ─── 13. Redirect file deleted ──────────────────────────────────────

console.log("\n=== Redirect file deleted ===");

const salPath = join(root, "skills", "effect-ts", "references", "services-and-layers.md");
assert(!existsSync(salPath), "services-and-layers.md redirect deleted");

console.log("\n=== Reference file sizes ===");

const refDir = "skills/effect-ts/references";
const refs = [
  "anti-patterns.md", "cli.md", "config.md", "data-modeling.md",
  "effect-setup-status.md", "error-handling.md", "http-clients.md",
  "layers.md", "processes.md", "schema-decisions.md",
  "services.md", "setup.md", "testing.md"
];

for (const ref of refs) {
  const content = read(join(refDir, ref));
  const lines = content.split("\n").length;
  // Flag files over 300 lines as warnings (200 is guideline, 500 is max)
  if (lines > 300) {
    assert(false, `${ref}: ${lines} lines (over 300, should split)`);
  } else {
    assert(true, `${ref}: ${lines} lines`);
  }
}

// ─── Results ────────────────────────────────────────────────────────

console.log(`\n${"=".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
