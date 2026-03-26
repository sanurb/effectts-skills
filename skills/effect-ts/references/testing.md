# Testing

## Table of Contents

- [Setup](#setup)
- [Basic Testing](#basic-testing)
- [Test Function Variants](#test-function-variants)
- [Providing Layers](#providing-layers)
- [TestClock](#testclock)
- [Test Modifiers](#test-modifiers)
- [Logging in Tests](#logging-in-tests)
- [Testing Errors](#testing-errors)
- [Test Isolation](#test-isolation)

## Setup

```bash
bun add -D vitest @effect/vitest@beta
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"
export default defineConfig({
  test: { include: ["tests/**/*.test.ts"] },
})
```

## Basic Testing

Import `assert` from `@effect/vitest` (not `expect` from `vitest`):

```typescript
import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"

describe("Calculator", () => {
  it("sync test", () => {
    assert.strictEqual(1 + 1, 2)
  })

  it.effect("effect test", () =>
    Effect.gen(function* () {
      const result = yield* Effect.succeed(1 + 1)
      assert.strictEqual(result, 2)
    })
  )
})
```

## Test Function Variants

### it.effect

Most common. Provides TestContext (TestClock, TestRandom). Clock starts at 0:

```typescript
it.effect("processes data", () =>
  Effect.gen(function* () {
    const result = yield* processData("input")
    assert.strictEqual(result, "expected")
  })
)
```

### it.live

Uses real system clock. For actual delays or real time:

```typescript
it.live("real clock", () =>
  Effect.gen(function* () {
    const now = yield* Clock.currentTimeMillis
    assert.isTrue(now > 0)
  })
)
```

### Scoped Resources

Scoping is automatic in v4. The scope closes when the test ends:

```typescript
it.effect("temp directory cleaned up", () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const tempDir = yield* fs.makeTempDirectoryScoped()
    yield* fs.writeFileString(`${tempDir}/test.txt`, "hello")
    assert.isTrue(yield* fs.exists(`${tempDir}/test.txt`))
  }).pipe(Effect.provide(NodeFileSystem.layer))
)
```

## Providing Layers

Use `Effect.provide` inline per test. Use `Layer.provideMerge` to expose leaf services for setup/assertions:

```typescript
// Test layer with in-memory state
class Users extends ServiceMap.Service<Users, {
  create(user: User): Effect.Effect<void>
  findById(id: UserId): Effect.Effect<User, UserNotFound>
}>()(
  "myapp/users/Users"
) {
  static readonly testLayer = Layer.sync(Users, () => {
    const store = new Map<UserId, User>()
    return Users.of({
      create: (user) => Effect.sync(() => void store.set(user.id, user)),
      findById: (id) => Effect.fromNullable(store.get(id)).pipe(
        Effect.mapError(() => new UserNotFound({ id }))
      ),
    })
  })
}

// Compose test layers with provideMerge (exposes leaf services)
const testLayer = Events.layer.pipe(
  Layer.provideMerge(Users.testLayer),
  Layer.provideMerge(Tickets.testLayer),
)

it.effect("registers user for event", () =>
  Effect.gen(function* () {
    const users = yield* Users
    const events = yield* Events
    yield* users.create(new User({
      id: UserId.makeUnsafe("u-1"), name: "Alice", email: "a@test.com"
    }))
    const reg = yield* events.register(
      EventId.makeUnsafe("e-1"),
      UserId.makeUnsafe("u-1")
    )
    assert.strictEqual(reg.userId, "u-1")
  }).pipe(Effect.provide(testLayer))
)
```

## TestClock

`it.effect` provides TestClock automatically. Use `TestClock.adjust` to simulate time:

```typescript
import { TestClock } from "effect/testing"

it.effect("time-based test", () =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(
      Effect.sleep(60_000).pipe(Effect.as("done" as const))
    )
    yield* TestClock.adjust(60_000)
    const value = yield* Fiber.join(fiber)
    assert.strictEqual(value, "done")
  })
)
```

## Test Modifiers

```typescript
it.effect.skip("temporarily disabled", () => /* ... */)
it.effect.only("focus on this", () => /* ... */)
it.effect.fails("known bug, expected to fail", () => /* ... */)
```

## Logging in Tests

By default, `it.effect` suppresses log output:

```typescript
it.effect("with logging", () =>
  Effect.gen(function* () {
    yield* Effect.log("visible")
  }).pipe(Effect.provide(Logger.pretty))
)
```

## Testing Errors

### Effect.flip

Swap success/error channels to assert on errors:

```typescript
it.effect("rejects invalid input", () =>
  Effect.gen(function* () {
    const service = yield* MyService
    const error = yield* service.process(badInput).pipe(Effect.flip)
    assert.strictEqual(error._tag, "ValidationError")
  }).pipe(Effect.provide(testLayer))
)
```

## Shared Layers

Use `layer()` (imported from `@effect/vitest`, NOT `it.layer()`) for expensive shared resources:

```typescript
import { assert, it, layer } from "@effect/vitest"

layer(TodoRepo.layerTest)("TodoRepo", (it) => {
  it.effect("creates a todo", () =>
    Effect.gen(function* () {
      const repo = yield* TodoRepo
      yield* repo.create("Write docs")
      const todos = yield* repo.list
      assert.strictEqual(todos.length, 1)
    })
  )
})
```

## Test Isolation

Use FiberRef for fiber-local overrides instead of mutating `process.env`:

```typescript
const ConfigOverride = FiberRef.unsafeMake<string | undefined>(undefined)

it.effect("works with custom config", () =>
  Effect.gen(function* () {
    const result = yield* myEffect
    assert.strictEqual(result, expected)
  }).pipe(
    Effect.locally(ConfigOverride, "/test/path"),
    Effect.provide(TestLayer),
  )
)
```

## Running Tests

```bash
bun run test                          # all tests
bun run test:watch                    # watch mode
bunx vitest run tests/user.test.ts    # specific file
bunx vitest run -t "UserService"      # matching pattern
```
