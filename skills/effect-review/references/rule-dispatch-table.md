# Rule Dispatch Table

Every rule, its detection tier, and the exact tool command. No rule may be skipped.

Source of truth for rule definitions: `skills/effect-ts/references/anti-patterns.md`

## Critical Rules

| ID | Name | Tier | Command |
|----|------|------|---------|
| C1 | console.log | text | `rg -n 'console\.(log\|warn\|error\|info\|debug)\(' $EFFECT_FILES` |
| C2 | process.env | text | `rg -n 'process\.env\b' $EFFECT_FILES` |
| C3 | throw in gen | ast | See ast-grep-rules.md §C3 |
| C4 | String error | text+confirm | `rg -n "Effect\.fail\(['\"]" $EFFECT_FILES` then read 5-line window; only flag if the string `Effect.fail` is the **primary** failure path of a service method, not inside a catch/recovery handler. |
| C5 | Unbranded ID | semantic | Read file; check fields with `Id` suffix typed as bare `string`/`number` without `Schema.brand`. Requires type-flow judgment. |
| C6 | Scattered provide | ast | See ast-grep-rules.md §C6 |
| C7 | Sync escape | text | `rg -n 'Effect\.runSync\|Effect\.runPromise' $EFFECT_FILES` then exclude entry-point files (`main.ts`, `index.ts`, files with `runMain`) |
| C8 | Lossy catch | semantic | Read file; check `Effect.catchAll` / `Effect.catch` handlers that discard or generalize the error type. Requires judgment on handler body. |
| C9 | Nullable types | text | `rg -n '\|\s*null\b\|\s*undefined\b' $EFFECT_FILES` — pre-filter; then confirm hit is in Effect domain type (interface/type near Effect imports) via LLM. **Hybrid: text pre-filter + semantic confirm.** |
| C10 | Missing tracing | semantic | Read service files; check public methods lack `Effect.fn` wrapper. Requires understanding of service boundaries. |
| C11 | Unbounded parallelism | text+confirm | `rg -n 'Effect\.all\(' $EFFECT_FILES` then read 5-line window; only flag if no `{ concurrency:` option in the same call. |
| C12 | Fire-and-forget fork | text+confirm | `rg -n 'Effect\.forkChild\|Effect\.forkDetach' $EFFECT_FILES` then read 5-line window; flag if result is not assigned or never joined. |
| C13 | Shared mutable state | semantic | Read files with concurrent patterns (`Effect.all`, `Effect.forEach` with concurrency); check for `let` variables captured in the concurrent scope. Requires scope analysis. |
| C14 | try/catch in Effect | ast | See ast-grep-rules.md §C14 |
| C15 | Promise.all in Effect | text | `rg -n 'Promise\.all' $EFFECT_FILES` |

## Warning Rules

| ID | Name | Tier | Command |
|----|------|------|---------|
| W1 | Unsafe unwrap | text | `rg -n 'Option\.getOrThrow\|Either\.getOrThrow' $EFFECT_FILES` |
| W2 | v2 imports | text | `rg -n "from ['\"]@effect-ts/" $EFFECT_FILES` |
| W3 | v3 error | text | `rg -n 'Schema\.TaggedError[^C]' $EFFECT_FILES` — matches `TaggedError(` but not `TaggedErrorClass` |
| W4 | v3 service | text | `rg -n 'Effect\.service\b' $EFFECT_FILES` — lowercase `s` only |
| W5 | Mutable service | semantic | Read service interfaces; check for missing `readonly` on properties. Requires interface context. |
| W6 | Layer in function | ast | See ast-grep-rules.md §W6 |
| W7 | Over-shared layer | semantic | Read test files; check if `layer()` is used for cheap resources where inline `Effect.provide` suffices. Requires test-context judgment. |
| W8 | Bad tag format | text | `rg -n "tag:\s*['\"](?![\w@]+/)" $EFFECT_FILES` — flags tags missing `pkg/path/` prefix. May need tuning per project. |
| W9 | Bare brand | text | `rg -n 'Schema\.brand\(' $EFFECT_FILES` then verify no constraint (pattern/NonEmpty/min/max) in surrounding pipe. **Hybrid: text pre-filter + context check.** |

## Tier Summary

| Tier | Rules | Tool |
|------|-------|------|
| text | C1, C2, C7, C15, W1, W2, W3, W4, W8 | `rg` — no file reading |
| text+confirm | C4, C9, C11, C12, W9 | `rg` pre-filter → LLM confirms within 5-line window |
| ast | C3, C6, C14, W6 | `ast-grep scan` — no file reading |
| semantic | C5, C8, C10, C13, W5, W7 | LLM reads file — judgment required |

## Hybrid Rule Protocol

For rules marked **text+confirm** (C4, C9, W9):

1. Run the `rg` command to get candidate `file:line` hits.
2. For each hit, read a **5-line window** (2 above, 2 below) from the file.
3. Apply the confirmation criterion (documented per rule above).
4. Only record confirmed hits as findings.

This avoids full-file reads while still filtering false positives.

## Adding a New Rule

1. Add the rule to `skills/effect-ts/references/anti-patterns.md` (canonical definition — ID, pattern, do/don't, rationale)
2. Add a row to the Critical or Warning table above with the correct tier and exact command
3. If tier is `ast`, add a YAML rule section to `ast-grep-rules.md` with the command, rationale, and fix
4. Run `node tests/scaffold-generators.test.mjs` to verify no regressions
