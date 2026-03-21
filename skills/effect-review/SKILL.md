---
name: effect-review
description: "Audit Effect v4 code for anti-patterns, type safety issues, and best practice violations. Reports findings with file:line references, fix suggestions, and severity scoring. Use when reviewing, auditing, or checking Effect code quality."
context: fork
agent: Explore
effort: high
allowed-tools: Read, Glob, Grep
argument-hint: "[path or glob]"
---

# Effect Code Review

Audit Effect v4 code for anti-patterns and best practice violations.

## Target

$ARGUMENTS

Default: all `.ts` files excluding node_modules, dist, build.

## Project Files

!`find . -name "*.ts" -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/.git/*" -not -path "*/build/*" 2>/dev/null | head -100 || echo "No .ts files found"`

---

## Scan Workflow

1. **Find Effect files** — `Glob("**/*.ts")`, then filter to files importing from `effect/` or `@effect/`
2. **For each file** — Check every item in the checklist below
3. **Record findings** — file path, line number, checklist ID, current code, suggested fix
4. **Score** — Critical = 10 points deducted, Warning = 3 points deducted. Score = max(0, 100 - total)

---

## Checklist

### Critical — Must Fix

| ID | Grep Pattern | What's Wrong | Fix |
|----|-------------|--------------|-----|
| C1 | `console.log` | Raw logging | `Effect.log` |
| C2 | `process.env` | Raw env access | `Config` service |
| C3 | `throw ` inside Effect.gen | Thrown exception | `yield* new MyError()` |
| C4 | `Effect.fail("` | String error | `Schema.TaggedErrorClass` |
| C5 | ID typed as bare `string` or `number` | Unbranded ID | `Schema.brand` with constraints |
| C6 | `Effect.provide` not at entry point | Scattered provides | Centralize at app entry |
| C7 | `Effect.runSync` inside service | Sync escape hatch | Compose with `Effect.gen` |
| C8 | `Effect.catchAll` | Loses type info | `catchTag` / `catchTags` |
| C9 | `null` or `undefined` in Effect types | Nullable types | `Option` |
| C10 | Service method without `Effect.fn` | Missing tracing | Wrap with `Effect.fn("Name.method")` |

### Warning — Should Fix

| ID | Grep Pattern | What's Wrong | Fix |
|----|-------------|--------------|-----|
| W1 | `Option.getOrThrow` | Unsafe unwrap | `Option.match` |
| W2 | `@effect-ts/` imports | v2 API | Migrate to `effect/` v4 |
| W3 | `Schema.TaggedError` (not Class) | v3 API | `Schema.TaggedErrorClass` |
| W4 | `Effect.service` (lowercase) | v3 API | `ServiceMap.Service` |
| W5 | Mutable service properties | Mutability | Add `readonly` |
| W6 | `Layer.effect(` called inside function | Breaks memoization | Module-level constant |
| W7 | `it.layer` for cheap resources | Over-sharing | Inline `Effect.provide` per test |
| W8 | Service tag without `@app/` | Non-standard tag | `@app/ServiceName` format |

---

<critical>
## Scan Rules

- Check EVERY file importing from `effect/` or `@effect/`
- Report EVERY violation found, not just the first
- Include the ACTUAL code from the file in findings, not generic examples
- Always include file path and line number
- Do NOT report style issues (semicolons, quotes, formatting)
- Do NOT suggest refactors beyond anti-pattern fixes
- Do NOT count issues in node_modules, dist, or build directories
</critical>

---

## Output Format

Return findings in this EXACT structure:

```markdown
# Effect Review: {target}

**Files scanned:** {count}
**Effect files:** {count with Effect imports}
**Score:** {score}/100

---

## Critical ({count})

### C{id}: {title}
**{file}:{line}**
` ``ts
// Current
{actual code from file}

// Fix
{corrected code}
` ``

---

## Warnings ({count})

### W{id}: {title}
**{file}:{line}**
` ``ts
// Current
{actual code}

// Fix
{corrected code}
` ``

---

## Summary

| Severity | Count | Points |
|----------|-------|--------|
| Critical | {n} | -{n*10} |
| Warning | {n} | -{n*3} |
| **Score** | | **{score}/100** |

**Verdict:** {PASS if ≥80 | NEEDS WORK if 50-79 | FAIL if <50}

**Top 3 improvements:**
1. {highest impact fix}
2. {second}
3. {third}
```

---

## Stop Conditions

- STOP if no `.ts` files found in project
- STOP if no files import from `effect/` or `@effect/`
- Report "No Effect code found" and exit
