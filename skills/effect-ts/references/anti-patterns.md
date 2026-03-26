# Effect v4 Anti-Patterns

Single source of truth for all anti-pattern rules. Referenced by `effect-review/SKILL.md` and `schema-decisions.md`.

## Critical — Must Fix

| ID | Pattern | Do Not | Do Instead | Why |
|----|---------|--------|-----------|-----|
| C1 | `console.log` | `console.log(...)` | `Effect.log(...)` | Structured logging, observability |
| C2 | `process.env` | `process.env.KEY` | `Config.string("KEY")` or `Config.redacted("KEY")` | Type-safe, testable config |
| C3 | `throw` in gen | `throw new Error()` inside `Effect.gen` | `yield* new TaggedError({...})` | Thrown errors become defects, not typed failures |
| C4 | String error | `Effect.fail("string")` | `Schema.TaggedErrorClass` with context fields | Typed errors enable `catchTag` recovery |
| C5 | Unbranded ID | ID typed as bare `string` or `number` | `Schema.brand` with real constraints (pattern, range) | Prevents cross-entity ID confusion |
| C6 | Scattered provide | `Effect.provide` not at entry point | Provide once at app entry | Scattered provides hide dependency graph |
| C7 | Sync escape | `Effect.runSync` inside service | Compose with `Effect.gen` | Breaks composition and testability |
| C8 | Lossy catch | `Effect.catch` with generic handler that discards error type | `catchTag` / `catchTags` for specific recovery | Preserves error type discrimination. Note: `Effect.catch` is valid when intentionally handling all error types. v3 name was `Effect.catchAll`. |
| C9 | Nullable types | `null` / `undefined` in Effect domain types | `Option<T>` with `Option.match` | Explicit absence, exhaustive handling |
| C10 | Missing tracing | Service method without `Effect.fn` | Wrap with `Effect.fn("Name.method")` | Enables call-site tracing |

## Warning — Should Fix

| ID | Pattern | Do Not | Do Instead | Why |
|----|---------|--------|-----------|-----|
| W1 | Unsafe unwrap | `Option.getOrThrow` | `Option.match` or `Option.getOrElse` | Throwing defeats Option purpose |
| W2 | v2 imports | `@effect-ts/` imports | `effect/` v4 imports | v2 API, not v3 |
| W3 | v3 error | `Schema.TaggedError` (not Class) | `Schema.TaggedErrorClass<T>()("Tag", {...})` | v3 API |
| W4 | v3 service | `Effect.service` (lowercase) | `ServiceMap.Service` | v3 API |
| W5 | Mutable service | Mutable service properties | Add `readonly` | Immutability |
| W6 | Layer in function | `Layer.effect(` called inside function | Module-level constant | Breaks memoization |
| W7 | Over-shared layer | `layer()` for cheap resources | Inline `Effect.provide` per test | Test isolation. v4: use `layer()` import from `@effect/vitest`, not `it.layer()`. |
| W8 | Bad tag format | Service tag without package path | `"pkg/path/ServiceName"` format | Canonical v4 convention |
| W9 | Bare brand | `Schema.String.pipe(Schema.brand("X"))` with no constraints | Add `Schema.pattern()`, `Schema.NonEmptyString`, or range checks | Brands without validation are phantom types |

## Code Examples

### C4: Never use Effect.fail with plain strings

```ts
// Wrong
yield* Effect.fail("not found")

// Correct
yield* new UserNotFoundError({ userId })
```

### C6: Never scatter Effect.provide

```ts
// Wrong
const result = myEffect.pipe(Effect.provide(MyLayer))

// Correct — provide once at entry point
const program = mainEffect.pipe(Effect.provide(AppLayer))
BunRuntime.runMain(program)
```

### W9: Never use bare brands without constraints

```ts
// Wrong — brand with no validation
const UserId = Schema.String.pipe(Schema.brand("UserId"))

// Correct — brand with real constraint
const UserId = Schema.String.pipe(
  Schema.pattern(/^usr_[a-z0-9]{12}$/),
  Schema.brand("UserId")
)
```
