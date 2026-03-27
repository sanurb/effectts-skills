# Error Handling

## Table of Contents

- [Schema.TaggedErrorClass](#schemataggederrorclass)
- [Yieldable Errors](#yieldable-errors)
- [Recovering from Errors](#recovering-from-errors)
- [Expected Errors vs Defects](#expected-errors-vs-defects)
- [Schema.Defect for Unknown Errors](#schemadefect-for-unknown-errors)

## Schema.TaggedErrorClass

Define domain errors with `Schema.TaggedErrorClass`. Two call forms — both are valid:

```typescript
import { Schema } from "effect"

// Form A: type parameter (canonical — used in v4 ai-docs source)
class ValidationError extends Schema.TaggedErrorClass<ValidationError>()(
  "ValidationError",
  {
    field: Schema.String,
    message: Schema.String,
  }
) {}

// Form B: string identifier (used on effect.solutions website)
class NotFoundError extends Schema.TaggedErrorClass("NotFoundError")(
  "NotFoundError",
  {
    resource: Schema.String,
    id: Schema.String,
  }
) {}

const AppError = Schema.Union([ValidationError, NotFoundError])
type AppError = typeof AppError.Type
```

**Both forms compile and behave identically.** Form A (`<T>()`) provides better IDE inference for `this` inside the class body. Form B (`("Name")`) is shorter. Prefer Form A in service code; Form B is fine for simple errors.

**Benefits:**
- Serializable (can send over network, save to DB)
- Type-safe with built-in `_tag` for pattern matching
- Custom methods via class extension
- Sensible default `message` when you don't declare one

**Every distinct failure reason deserves its own error type.** Don't collapse multiple failure modes into generic errors like `NotFoundError`. Use `UserNotFoundError`, `ChannelNotFoundError`, etc. with relevant context fields.

## Yieldable Errors

`Schema.TaggedErrorClass` values are yieldable. Return them directly in generators without wrapping in `Effect.fail`:

```typescript
import { Effect, Random, Schema } from "effect"

class BadLuck extends Schema.TaggedErrorClass<BadLuck>()(
  "BadLuck",
  { roll: Schema.Number }
) {}

const rollDie = Effect.gen(function* () {
  const roll = yield* Random.nextIntBetween(1, 6)
  if (roll === 1) {
    yield* new BadLuck({ roll }) // no Effect.fail needed
  }
  return { roll }
})
```

## Recovering from Errors

### catch

Handle all errors with a fallback. Removes the entire error channel:

```typescript
const recovered: Effect.Effect<string, never> = program.pipe(
  Effect.catch((error) => Effect.succeed(`Recovered from ${error.name}`))
)
```

### catchTag

Handle a specific error by its `_tag`. That error type is removed from the channel:

```typescript
const recovered = program.pipe(
  Effect.catchTag("HttpError", (error) => Effect.succeed(`HTTP ${error.statusCode}`))
)
```

**Array overload** — catch multiple tags with one handler:

```typescript
const recovered = loadPort("80").pipe(
  Effect.catchTag(["ParseError", "ReservedPortError"], (_) => Effect.succeed(3000))
)
```

### catchTags

Handle multiple error types at once with per-tag handlers:

```typescript
const recovered = program.pipe(
  Effect.catchTags({
    HttpError: () => Effect.succeed("Recovered from HttpError"),
    ValidationError: () => Effect.succeed("Recovered from ValidationError"),
  })
)
```

## Expected Errors vs Defects

Effect tracks errors in the type system (`Effect<A, E, R>`) so callers know what can fail and can recover.

**Use typed errors** for domain failures the caller can handle: validation errors, "not found", permission denied, rate limits.

**Use defects** for unrecoverable situations: bugs, invariant violations. Defects terminate the fiber and you handle them once at the system boundary (logging, crash reporting).

```typescript
// At app entry: if config fails, nothing can proceed
const main = Effect.gen(function* () {
  const config = yield* loadConfig.pipe(Effect.orDie)
  yield* Effect.log(`Starting on port ${config.port}`)
})
```

**When to catch defects:** Almost never. Only at system boundaries for logging/diagnostics. Use `Effect.exit` to inspect or `Effect.catchAllDefect` if you must recover (e.g., plugin sandboxing).

## Schema.Defect for Unknown Errors

Wrap unknown errors from external libraries with `Schema.Defect`:

```typescript
import { Schema, Effect } from "effect"

class ApiError extends Schema.TaggedErrorClass<ApiError>()(
  "ApiError",
  {
    endpoint: Schema.String,
    statusCode: Schema.Number,
    error: Schema.Defect, // wraps the underlying error
  }
) {}

const fetchUser = (id: string) =>
  Effect.tryPromise({
    try: () => fetch(`/api/users/${id}`).then((r) => r.json()),
    catch: (error) => new ApiError({
      endpoint: `/api/users/${id}`,
      statusCode: 500,
      error,
    }),
  })
```

**Schema.Defect handles:**
- JavaScript `Error` instances become `{ name, message }` objects
- Any unknown value becomes a string representation
- Result is serializable for network/storage

**Use for:** wrapping external library errors, network boundaries, persisting errors to DB, logging systems.

## Reason Errors (Nested Error Channels)

Define a tagged error with a tagged `reason` field for structured sub-errors:

```typescript
import { Effect, Schema } from "effect"

class RateLimitError extends Schema.TaggedErrorClass<RateLimitError>()(
  "RateLimitError",
  { retryAfter: Schema.Number }
) {}

class QuotaExceededError extends Schema.TaggedErrorClass<QuotaExceededError>()(
  "QuotaExceededError",
  { limit: Schema.Number }
) {}

class SafetyBlockedError extends Schema.TaggedErrorClass<SafetyBlockedError>()(
  "SafetyBlockedError",
  { category: Schema.String }
) {}

class AiError extends Schema.TaggedErrorClass<AiError>()(
  "AiError",
  { reason: Schema.Union([RateLimitError, QuotaExceededError, SafetyBlockedError]) }
) {}

declare const callModel: Effect.Effect<string, AiError>

// Handle one specific reason (with optional catch-all for the rest)
const handleOne = callModel.pipe(
  Effect.catchReason(
    "AiError",
    "RateLimitError",
    (reason) => Effect.succeed(`Retry after ${reason.retryAfter}s`),
    (reason) => Effect.succeed(`Failed: ${reason._tag}`)
  )
)

// Handle multiple reasons at once
const handleMultiple = callModel.pipe(
  Effect.catchReasons("AiError", {
    RateLimitError: (r) => Effect.succeed(`Retry after ${r.retryAfter}s`),
    QuotaExceededError: (r) => Effect.succeed(`Quota: ${r.limit}`),
  })
)

// Unwrap reasons into the error channel for flat handling
const unwrapped = callModel.pipe(
  Effect.unwrapReason("AiError"),
  Effect.catchTags({
    RateLimitError: (r) => Effect.succeed(`Back off ${r.retryAfter}s`),
    QuotaExceededError: (r) => Effect.succeed(`Increase beyond ${r.limit}`),
    SafetyBlockedError: (r) => Effect.succeed(`Blocked: ${r.category}`),
  })
)
```

**Use reason errors when:** a single error type wraps multiple failure modes (API errors, AI provider errors, validation sub-types). Avoids proliferating top-level error types while keeping typed recovery.

## Schema.ErrorClass (Non-Tagged)

For opaque errors that don't need `_tag` discrimination (wrapping external library failures):

```typescript
class SmtpError extends Schema.ErrorClass<SmtpError>("SmtpError")({
  cause: Schema.Defect
}) {}
```

Use `Schema.TaggedErrorClass` for domain errors; `Schema.ErrorClass` for infrastructure wrapping.

## Advanced Patterns

### TypeId Branding (from Effect core packages)

Brand error families with a TypeId symbol for runtime type discrimination across package boundaries:

```typescript
import { hasProperty, isTagged } from "effect/Predicate"
import { Schema } from "effect"

export const TypeId: unique symbol = Symbol.for("@myapp/AppError")
export type TypeId = typeof TypeId

export class NotFoundError extends Schema.TaggedErrorClass<NotFoundError>()(
  "NotFoundError",
  { resource: Schema.String, id: Schema.String }
) {
  readonly [TypeId] = TypeId

  static is(u: unknown): u is NotFoundError {
    return hasProperty(u, TypeId) && isTagged(u, "NotFoundError")
  }
}
```

### Static refail Helper (from @effect/cluster)

Map any error into a domain error with a static method:

```typescript
class PersistenceError extends Schema.TaggedErrorClass<PersistenceError>()(
  "PersistenceError",
  { cause: Schema.Defect }
) {
  static refail<A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<A, PersistenceError, R> {
    return Effect.catchCause(effect, (cause) =>
      Effect.fail(new PersistenceError({ cause: Cause.squash(cause) }))
    )
  }
}

const safeQuery = PersistenceError.refail(rawDbCall)
```

### Effect.flip (Swap Success/Error for Testing)

```typescript
const error = yield* service.doThing(badInput).pipe(Effect.flip)
assert.strictEqual(error._tag, "ValidationError")
```

Patterns adapted from [artimath/effect-skills](https://github.com/artimath/effect-skills) (MIT).
