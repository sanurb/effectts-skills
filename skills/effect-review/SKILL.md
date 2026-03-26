---
name: effect-review
description: "Audit Effect v4 code for anti-patterns, type safety issues, and best practice violations using a deterministic multi-phase harness. Dispatches ripgrep for text-safe rules, ast-grep for structural rules, and reserves LLM judgment for semantic-only rules. Reports findings with file:line evidence, fix suggestions, and severity scoring. Use when reviewing, auditing, or checking Effect code quality."
context: fork
agent: Explore
effort: high
argument-hint: "[path or glob]"
references:
  - references/rule-dispatch-table.md
  - references/ast-grep-rules.md
---

# Effect Code Review Harness

Deterministic multi-phase audit of Effect v4 code.

## Target

$ARGUMENTS — default: all `.ts` files excluding node_modules, dist, build.

---

## Phase 0 · Scope

Establish the candidate set. **Do not read any file yet.**

```bash
# 1. Find all Effect files (files importing effect/ or @effect/)
rg -l --type ts "from ['\"](?:effect/|@effect/)" --glob '!node_modules' --glob '!dist' --glob '!build' .
```

- If **zero** files → report `No Effect code found` and **STOP**.
- Store result as `$EFFECT_FILES` (newline-separated paths).
- Count: `$FILE_COUNT`.

**Dynamic scaling decision:**

| $FILE_COUNT | Strategy |
|-------------|----------|
| ≤ 20 | Single-pass: run all phases sequentially |
| 21–80 | Batch: process in groups of 20 |
| > 80 | Parallel subagents: one per detection tier |

---

## Phase 1 · Dispatch

Load rule dispatch table: [references/rule-dispatch-table.md](./references/rule-dispatch-table.md)

Each rule has exactly one **detection tier**:

| Tier | Tool | When |
|------|------|------|
| **text** | `rg` | Rule reduces to a literal or regex match |
| **ast** | `ast-grep` | Rule requires structural context (nesting, scope) |
| **semantic** | LLM read | Rule requires judgment, type flow, or cross-file reasoning |

**Do NOT promote a text-tier rule to semantic. Do NOT demote a semantic rule to text.**

---

## Phase 2 · Detection

Run each tier in order. Each produces `(file, line, rule_id, snippet)` tuples.

### Tier A — Text (ripgrep)

Run the exact `rg` commands from the dispatch table against `$EFFECT_FILES`.
Parse output as `file:line:match`. Record each hit.

### Tier B — AST (ast-grep)

For each ast-rule, run the command from [references/ast-grep-rules.md](./references/ast-grep-rules.md).
Parse JSON output (`--json`). Record each hit with file, line, matched text.

### Tier C — Semantic (LLM judgment)

For **only** the semantic-tier rules, read candidate files and evaluate.
Limit: read each file **at most once** across all semantic rules.
For each candidate hit, record reasoning in one sentence.

<critical>
### Detection Constraints

- **Never** `find . | head` — use only `rg -l` for discovery.
- **Never** read a file to check a text-tier or AST-tier rule.
- **Never** skip a rule. Every rule in the dispatch table must be checked.
- **Never** report a finding without an exact file path and line number.
- **Never** report style issues (semicolons, quotes, formatting).
- **Stop** a tier early if it produces > 200 raw hits (likely false-positive flood — note in report).
</critical>

---

## Phase 3 · Deduplicate & Score

1. Merge all `(file, line, rule_id)` tuples.
2. Deduplicate: same file + same line + same rule = one finding.
3. Score: **Critical = −10 pts, Warning = −3 pts. Score = max(0, 100 − total).**

---

## Phase 4 · Report

Output this **exact** structure (no deviation):

```markdown
# Effect Review: {target}

**Files scanned:** {$FILE_COUNT}
**Effect files with findings:** {count}
**Score:** {score}/100

---

## Critical ({count})

### C{id}: {title}
**{file}:{line}**
```ts
// Current
{actual code from file, 1–5 lines}

// Fix
{corrected code}
```
> {one-sentence rationale}

---

## Warnings ({count})

### W{id}: {title}
**{file}:{line}**
```ts
// Current
{actual code from file}

// Fix
{corrected code}
```
> {one-sentence rationale}

---

## Summary

| Severity | Count | Points |
|----------|-------|--------|
| Critical | {n} | −{n×10} |
| Warning  | {n} | −{n×3}  |
| **Score** | | **{score}/100** |

**Verdict:** {PASS ≥ 80 · NEEDS WORK 50–79 · FAIL < 50}

**Top 3 improvements:**
1. {highest-impact fix}
2. {second}
3. {third}
```

---

## Stop Conditions

- Phase 0 returns zero files → `No Effect code found`, **STOP**.
- All tiers produce zero findings → report clean scan with score 100/100.
- Any tier exceeds 200 raw hits → cap that tier, note overflow.

---

## In This Reference

| File | Purpose | When to read |
|------|---------|--------------|
| [rule-dispatch-table.md](./references/rule-dispatch-table.md) | Rule → tier → exact command mapping | Phase 1 (always) |
| [ast-grep-rules.md](./references/ast-grep-rules.md) | YAML rules for structural checks | Phase 2 Tier B |

## Anti-Patterns for This Skill

| Do NOT | Do Instead |
|--------|-----------|
| `find . -name "*.ts" \| head -100` | `rg -l` with Effect import filter |
| Read files to check text rules | `rg` with regex |
| Read files to check AST rules | `ast-grep scan --rule` |
| Scan full repo blindly | Scope to `$EFFECT_FILES` only |
| Guess line numbers | Extract from tool output |
| Report without code evidence | Always include actual snippet |
