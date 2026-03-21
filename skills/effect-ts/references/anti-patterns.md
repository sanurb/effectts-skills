# Effect v4 Anti-Patterns

Common mistakes and their corrections when writing Effect v4 code.

| Do Not | Do Instead | Why |
|--------|-----------|-----|
| `console.log(...)` | `Effect.log(...)` with structured data | Structured logging integrates with Effect's observability |
| `process.env.KEY` | `Config.string("KEY")` or `Config.redacted("KEY")` | Type-safe, testable, composable configuration |
| `throw new Error()` inside `Effect.gen` | `yield* new TaggedError({...})` or `Effect.fail(...)` | Thrown errors become defects, not typed failures |
| `Effect.runSync(...)` inside services | Keep everything effectful | Breaks composition and testability |
| `Effect.catchAll(() => ...)` losing type info | `Effect.catchTag` / `Effect.catchTags` | Preserves error type discrimination |
| `null` / `undefined` in domain types | `Option<T>` with `Option.match` | Explicit absence, exhaustive handling |
| `Option.getOrThrow(...)` | `Option.match({ onNone, onSome })` or `Option.getOrElse` | Throwing defeats the purpose of Option |
| `Effect.Service` (v3) | `ServiceMap.Service` (v4) | v3 API, removed in v4 |
| `Schema.TaggedError<T>()` (v3) | `Schema.TaggedErrorClass("Tag")("Tag", {...})` (v4) | v3 API, removed in v4 |
| Scatter `Effect.provide` calls | Provide once at app entry | Scattered provides make dependency graph unclear |
| Call parameterized layer constructors inline | Store layers in constants (memoization) | Inline calls create duplicate layer instances |

## Additional Anti-Patterns

### Never use Effect.fail with plain strings

```ts
// Wrong
yield* Effect.fail("not found")

// Correct
yield* new UserNotFoundError({ userId })
```

Typed errors enable exhaustive recovery with `catchTag`.

### Never scatter Effect.provide

```ts
// Wrong — provides scattered across the codebase
const result = myEffect.pipe(Effect.provide(MyLayer))

// Correct — provide once at entry point
const program = mainEffect.pipe(Effect.provide(AppLayer))
BunRuntime.runMain(program)
```

### Never use bare brands without constraints

```ts
// Wrong — brand with no validation
const UserId = Schema.String.pipe(Schema.brand("UserId"))

// Correct — brand with real constraint
const UserId = Schema.String.pipe(
  Schema.pattern(/^usr_[a-z0-9]{12}$/),
  Schema.brand("UserId")
)
```
