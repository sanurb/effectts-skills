# Concurrency

## Table of Contents

- [Bounded Parallelism](#bounded-parallelism)
- [Fiber Management](#fiber-management)
- [Concurrent State with Ref](#concurrent-state-with-ref)
- [Racing Effects](#racing-effects)
- [Timeouts and Interruption](#timeouts-and-interruption)
- [Blocking Work](#blocking-work)
- [Retry with Backoff](#retry-with-backoff)

## Bounded Parallelism

Always set `{ concurrency: N }` when running effects in parallel. Unbounded parallelism overwhelms services and causes memory spikes.

```typescript
import { Effect } from "effect"

// BAD — unbounded, can overwhelm the target service
yield* Effect.all(items.map(doWork))

// GOOD — controlled concurrency
yield* Effect.forEach(items, doWork, { concurrency: 10 })

// Also works with Effect.all
yield* Effect.all(items.map(doWork), { concurrency: 10 })
```

`Effect.forEach` is preferred over `Effect.all(items.map(...))` — it's a single combinator instead of two.

**Never use `Promise.all` inside Effect.** Use `Effect.all` or `Effect.forEach` to get interruption, supervision, and structured error handling.

## Fiber Management

Forked fibers must be **joined**, **supervised**, or **scoped**. Fire-and-forget forks leak fibers and lose errors silently.

```typescript
import { Effect, Fiber } from "effect"

// BAD — fiber leaked, errors lost
yield* Effect.forkChild(backgroundWork)

// GOOD — join to wait for result
const fiber = yield* Effect.forkChild(backgroundWork)
const result = yield* Fiber.join(fiber)

// GOOD — scoped fork, auto-joined on scope exit
yield* Effect.forkScoped(backgroundWork)

// GOOD — fork + interrupt when no longer needed
const fiber = yield* Effect.forkChild(backgroundWork)
// ... later:
yield* Fiber.interrupt(fiber)
```

**Never fork inside a loop.** Use `Effect.forEach` with concurrency instead:

```typescript
// BAD — explosive concurrency, no backpressure
for (const item of items) {
  yield* Effect.forkChild(processItem(item))
}

// GOOD — controlled parallelism
yield* Effect.forEach(items, processItem, { concurrency: 10 })
```

## Concurrent State with Ref

Use `Ref` for state shared across fibers. Never capture `let` / mutable objects in concurrent effects — this causes race conditions.

```typescript
import { Effect, Ref } from "effect"

// BAD — race condition
let counter = 0
yield* Effect.all([
  Effect.sync(() => { counter++ }),
  Effect.sync(() => { counter++ }),
])

// GOOD — atomic concurrent state
const counter = yield* Ref.make(0)
yield* Effect.all([
  Ref.update(counter, (n) => n + 1),
  Ref.update(counter, (n) => n + 1),
])
const final = yield* Ref.get(counter) // guaranteed 2
```

For complex state, use `Ref` with an object:

```typescript
const state = yield* Ref.make({ processed: 0, errors: 0 })

yield* Effect.forEach(items, (item) =>
  processItem(item).pipe(
    Effect.tap(() => Ref.update(state, (s) => ({ ...s, processed: s.processed + 1 }))),
    Effect.catchTag("ProcessError", () =>
      Ref.update(state, (s) => ({ ...s, errors: s.errors + 1 }))
    ),
  ), { concurrency: 10 })

const { processed, errors } = yield* Ref.get(state)
```

## Racing Effects

`Effect.race` runs two effects and returns the winner. The loser is interrupted — but cleanup only runs if you use `Effect.ensuring`.

```typescript
import { Effect } from "effect"

// BAD — loser may hold resources without cleanup
yield* Effect.race(fetchFromPrimary, fetchFromBackup)

// GOOD — cleanup on interruption
yield* Effect.race(
  fetchFromPrimary.pipe(Effect.ensuring(cleanupPrimary)),
  fetchFromBackup.pipe(Effect.ensuring(cleanupBackup)),
)

// Race multiple effects
yield* Effect.raceAll([
  fetchFromRegionA.pipe(Effect.ensuring(cleanupA)),
  fetchFromRegionB.pipe(Effect.ensuring(cleanupB)),
  fetchFromRegionC.pipe(Effect.ensuring(cleanupC)),
])
```

## Timeouts and Interruption

`Effect.timeout` interrupts the inner effect when time expires. For this to work, the inner effect must be interruptible.

```typescript
import { Effect } from "effect"

// Basic timeout
yield* myEffect.pipe(Effect.timeout("5 seconds"))

// Timeout with fallback
yield* myEffect.pipe(
  Effect.timeoutTo({
    duration: "5 seconds",
    onTimeout: () => Effect.succeed(defaultValue),
  })
)

// Interruptible fetch (AbortSignal)
yield* Effect.tryPromise({
  try: (signal) => fetch(url, { signal }),
  catch: (error) => new FetchError({ error }),
}).pipe(Effect.timeout("10 seconds"))
```

**Key:** `Effect.tryPromise` passes an `AbortSignal` to the `try` function. Pass it to `fetch` or other AbortController-aware APIs so the work actually stops on timeout.

## Blocking Work

CPU-heavy or synchronous I/O work blocks the fiber pool. Use `Effect.blocking` to offload it to a separate thread pool:

```typescript
import { Effect } from "effect"

// BAD — blocks the fiber pool, starves concurrent work
yield* Effect.sync(() => heavyCryptoOperation(data))

// GOOD — offloaded to blocking thread pool
yield* Effect.blocking(
  Effect.sync(() => heavyCryptoOperation(data))
)
```

For file I/O, prefer `@effect/platform` `FileSystem` (which handles this internally) over raw `node:fs` sync APIs.

## Retry with Backoff

Use `Schedule` for retry strategies. Always add jitter and a cap when retrying concurrent operations to prevent retry storms.

```typescript
import { Effect, Schedule } from "effect"

// Basic exponential backoff with cap
yield* myEffect.pipe(
  Effect.retry(
    Schedule.exponential("100 millis").pipe(
      Schedule.compose(Schedule.recurs(5)),
    )
  )
)

// With jitter (prevents thundering herd)
yield* myEffect.pipe(
  Effect.retry(
    Schedule.exponential("100 millis").pipe(
      Schedule.jittered,
      Schedule.compose(Schedule.recurs(5)),
    )
  )
)

// Retry only specific errors
yield* myEffect.pipe(
  Effect.retry({
    schedule: Schedule.exponential("200 millis").pipe(Schedule.compose(Schedule.recurs(3))),
    while: (error) => error._tag === "RateLimitError",
  })
)
```

**When retrying concurrent operations**, always bound both concurrency and retry count:

```typescript
yield* Effect.forEach(items, (item) =>
  processItem(item).pipe(
    Effect.retry(
      Schedule.exponential("100 millis").pipe(
        Schedule.jittered,
        Schedule.compose(Schedule.recurs(3)),
      )
    )
  ), { concurrency: 5 })
```
