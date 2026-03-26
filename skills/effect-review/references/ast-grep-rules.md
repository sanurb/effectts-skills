# ast-grep Rules for Effect Review

Structural rules that require AST context. Run with `ast-grep scan --inline-rules` or `--rule`.

Always add `--json` for machine-parseable output. Always scope to `$EFFECT_FILES`.

---

## C3 — throw in Effect.gen

Detects `throw` statements inside `Effect.gen` callbacks.

```bash
ast-grep scan --inline-rules "id: c3-throw-in-gen
language: typescript
rule:
  kind: throw_statement
  inside:
    has:
      pattern: Effect.gen(\$\$\$)
    stopBy: end" --json $EFFECT_FILES
```

**Why AST:** `rg` for `throw` would match throws outside `Effect.gen` (false positives). AST nesting check is required.

**Fix:** Replace `throw new Error(...)` with `yield* new TaggedError({...})`.

---

## C6 — Scattered Effect.provide

Detects `Effect.provide` called anywhere except module-level or inside a function named `main`/`run`/entry-like.

```bash
ast-grep scan --inline-rules "id: c6-scattered-provide
language: typescript
rule:
  pattern: Effect.provide(\$LAYER)
  not:
    inside:
      any:
        - kind: program
        - has:
            kind: function_declaration
            has:
              kind: identifier
              regex: ^(main|run|bootstrap|start)$
              stopBy: end
          stopBy: end
      stopBy: end" --json $EFFECT_FILES
```

**Why AST:** Need to know the enclosing scope. A text match for `Effect.provide` would flag legitimate entry-point usage.

**Fix:** Move `Effect.provide` to the app entry point; compose layers into a single `AppLayer`.

**Note:** This rule has moderate false-positive risk. If a hit is inside a test file (`*.test.ts`, `*.spec.ts`), demote to informational — test files legitimately scatter provides.

---

## W6 — Layer.effect inside function body

Detects `Layer.effect(` or `Layer.succeed(` called inside a function body instead of at module level.

```bash
ast-grep scan --inline-rules "id: w6-layer-in-function
language: typescript
rule:
  pattern: Layer.effect(\$\$\$)
  inside:
    kind: function_declaration
    stopBy: end" --json $EFFECT_FILES
```

Also check arrow functions:

```bash
ast-grep scan --inline-rules "id: w6-layer-in-arrow
language: typescript
rule:
  pattern: Layer.effect(\$\$\$)
  inside:
    kind: arrow_function
    stopBy: end" --json $EFFECT_FILES
```

**Why AST:** Need to confirm the call is nested inside a function, not at module scope. Text match alone cannot determine scope.

**Fix:** Hoist `Layer.effect(...)` to a module-level `const`. Functions should return the layer reference, not construct it.

---

## Running All AST Rules at Once

For efficiency, write a temporary YAML file with all rules and scan once:

```bash
cat > /tmp/effect-review-ast.yml << 'RULES'
id: c3-throw-in-gen
language: typescript
rule:
  kind: throw_statement
  inside:
    has:
      pattern: Effect.gen($$$)
    stopBy: end
---
id: c6-scattered-provide
language: typescript
rule:
  pattern: Effect.provide($LAYER)
  not:
    inside:
      kind: program
      stopBy: end
---
id: w6-layer-in-function
language: typescript
rule:
  any:
    - pattern: Layer.effect($$$)
    - pattern: Layer.succeed($$$)
  inside:
    any:
      - kind: function_declaration
      - kind: arrow_function
    stopBy: end
RULES

ast-grep scan --rule /tmp/effect-review-ast.yml --json $EFFECT_FILES
```

Parse the JSON output: each match includes `ruleId`, `file`, `range.start.line`, and `text`.

---

## Output Parsing

`ast-grep --json` returns an array of matches:

```json
[{
  "ruleId": "c3-throw-in-gen",
  "file": "src/services/UserService.ts",
  "range": { "start": { "line": 42, "column": 4 }, "end": { "line": 42, "column": 30 } },
  "text": "throw new Error(\"not found\")"
}]
```

Map each match to `(file, line+1, rule_id, text)` — note ast-grep lines are 0-indexed.
