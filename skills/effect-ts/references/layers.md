# Layers

## Table of Contents

- [Providing Layers](#providing-layers)
- [Layer.provide vs Layer.provideMerge vs Layer.mergeAll](#layerprovide-vs-layerprovidemerge-vs-layermergeall)
- [Layer Memoization](#layer-memoization)
- [Sharing Layers Between Tests](#sharing-layers-between-tests)

For service definition and implementation → see [services.md](services.md).

## Providing Layers

Provide once at the app entry point. Do not scatter `Effect.provide` calls:

```typescript
const appLayer = userServiceLayer.pipe(
  Layer.provideMerge(databaseLayer),
  Layer.provideMerge(loggerLayer),
  Layer.provideMerge(configLayer),
)

const program = Effect.gen(function* () {
  const users = yield* UserService
  const logger = yield* Logger
  yield* logger.info("Starting...")
  yield* users.getUser()
})

// Provide once
const main = program.pipe(Effect.provide(appLayer))
BunRuntime.runMain(main)
```

**Why provide once:**
- Clear dependency graph in one place
- Easy testing: swap `appLayer` for `testLayer`
- No hidden dependencies

## Layer.provide vs Layer.provideMerge vs Layer.mergeAll

This causes most Effect type errors. Know the difference:

| Method | Deps Satisfied | Available to Program | Use When |
|--------|---------------|---------------------|----------|
| `Layer.provide` | Yes | No | Internal layer building (hide implementation detail) |
| `Layer.provideMerge` | Yes | Yes | Tests needing multiple services, incremental composition |
| `Layer.mergeAll` | No | Yes | Combining independent layers at the same level |

```typescript
// Layer.provide: satisfies deps, hides the provider
const internal = MyService.layer.pipe(Layer.provide(DatabaseLayer))
// Result: Layer<MyService> (Database NOT available to program)

// Layer.provideMerge: satisfies deps AND keeps provider accessible
const test = MyService.layer.pipe(Layer.provideMerge(DatabaseLayer))
// Result: Layer<MyService | Database> (both available)

// Layer.mergeAll: combines without resolving deps
const combined = Layer.mergeAll(UserRepo.layer, OrderRepo.layer)
// Result: Layer<UserRepo | OrderRepo, never, SharedDeps> (deps still required)
```

**Common error to recognize:**
```
Effect<A, E, SomeService> is not assignable to Effect<A, E, never>
```
This means `SomeService` is still required. Use `provideMerge` instead of `provide`.

## Layer Memoization

Effect memoizes layers by reference identity. The same layer instance used multiple times is constructed only once.

```typescript
// BAD: calling constructor twice creates two connection pools
const badLayer = Layer.merge(
  UserRepo.layer.pipe(
    Layer.provide(Postgres.layer({ url: "postgres://...", poolSize: 10 }))
  ),
  OrderRepo.layer.pipe(
    Layer.provide(Postgres.layer({ url: "postgres://...", poolSize: 10 })) // different ref!
  )
)

// GOOD: store in a constant, same reference shared
const postgresLayer = Postgres.layer({ url: "postgres://...", poolSize: 10 })

const goodLayer = Layer.merge(
  UserRepo.layer.pipe(Layer.provide(postgresLayer)),
  OrderRepo.layer.pipe(Layer.provide(postgresLayer)) // same ref
)
```

**Rule:** Parameterized layer constructors → always store in a module-level constant.

## Layer.launch and Layer.effectDiscard

`Layer.launch` converts a layer into a long-running `Effect<never>` — the canonical entry point for layer-based apps:

```typescript
import { NodeRuntime } from "@effect/platform-node"
import { Effect, Layer } from "effect"

const BackgroundWorker = Layer.effectDiscard(Effect.gen(function* () {
  yield* Effect.logInfo("Starting worker...")
  yield* Effect.gen(function* () {
    while (true) {
      yield* Effect.sleep("5 seconds")
      yield* Effect.logInfo("Working...")
    }
  }).pipe(
    Effect.onInterrupt(() => Effect.logInfo("Worker interrupted")),
    Effect.forkScoped
  )
}))

NodeRuntime.runMain(Layer.launch(BackgroundWorker))
```

- `Layer.effectDiscard`: run an effect when the layer is built, no service exposed
- `Layer.launch`: convert layer → long-running Effect with graceful shutdown

## Layer.unwrap (Dynamic Layer Selection)

Build a layer dynamically from config or an Effect:

```typescript
import { Config, Effect, Layer } from "effect"

class MessageStore extends ServiceMap.Service<MessageStore, {
  append(msg: string): Effect.Effect<void>
}>()("myapp/MessageStore") {
  static readonly layerInMemory = Layer.effect(MessageStore, /* ... */)
  static readonly layerRemote = (url: URL) => Layer.effect(MessageStore, /* ... */)

  static readonly layer = Layer.unwrap(
    Effect.gen(function* () {
      const useInMemory = yield* Config.boolean("IN_MEMORY").pipe(
        Config.withDefault(false)
      )
      if (useInMemory) return MessageStore.layerInMemory
      const url = yield* Config.url("STORE_URL")
      return MessageStore.layerRemote(url)
    })
  )
}
```

## LayerMap.Service (Dynamic Keyed Resources)

Dynamically manage resources keyed by identifier (e.g., per-tenant pools):

```typescript
import { Effect, Layer, LayerMap, ServiceMap } from "effect"

class TenantPool extends ServiceMap.Service<TenantPool, {
  query(sql: string): Effect.Effect<ReadonlyArray<unknown>>
}>()("myapp/TenantPool") {
  static readonly layer = (tenantId: string) =>
    Layer.effect(TenantPool, /* ... per-tenant implementation ... */)
}

class PoolMap extends LayerMap.Service<PoolMap>()("myapp/PoolMap", {
  lookup: (tenantId: string) => TenantPool.layer(tenantId),
  idleTimeToLive: "1 minute"
}) {}

// Usage: PoolMap.get("acme") provides TenantPool for that tenant
const program = Effect.gen(function* () {
  const pool = yield* TenantPool
  return yield* pool.query("SELECT * FROM users")
}).pipe(Effect.provide(PoolMap.get("acme")), Effect.provide(PoolMap.layer))
```

## ManagedRuntime (Bridge to Non-Effect Code)

Use `ManagedRuntime` to integrate Effect with external frameworks (Hono, Express):

```typescript
import { Effect, Layer, ManagedRuntime } from "effect"

const appMemoMap = Layer.makeMemoMapUnsafe()
const runtime = ManagedRuntime.make(TodoRepo.layer, { memoMap: appMemoMap })

// In framework handler:
app.get("/todos", async (ctx) => {
  const todos = await runtime.runPromise(
    TodoRepo.use((repo) => repo.getAll)
  )
  return ctx.json(todos)
})

// Graceful shutdown
process.once("SIGTERM", () => void runtime.dispose())
```

## Sharing Layers Between Tests

Default: provide a fresh layer per `it.effect` so state never leaks.

Use `layer()` only for expensive shared resources (database connections):

```typescript
import { it, layer } from "@effect/vitest"

// Preferred: fresh layer per test
it.effect("starts at zero", () =>
  Effect.gen(function* () {
    const counter = yield* Counter
    assert.strictEqual(yield* counter.get(), 0)
  }).pipe(Effect.provide(Counter.layer))
)

// Shared: only when you need it (v4: `layer()` import, not `it.layer()`)
layer(Counter.layer)("counter", (it) => {
  it.effect("starts at zero", () =>
    Effect.gen(function* () {
      const counter = yield* Counter
      assert.strictEqual(yield* counter.get(), 0)
    })
  )
})
```

See [testing.md](testing.md) for the full worked example.
