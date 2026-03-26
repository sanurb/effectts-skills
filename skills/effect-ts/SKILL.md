---
name: effect-ts
description: "Idiomatic Effect v4 TypeScript patterns. Auto-activates for Effect code: ServiceMap.Service, Schema.Class, TaggedErrorClass, Effect.gen/Effect.fn, Layer composition, branded types, @effect/vitest. Triggers on: Effect, @effect/, Schema, ServiceMap, Layer, TaggedError."
user-invocable: false
---

# Effect v4 Patterns

## Active Packages

!`node -e "try{const p=JSON.parse(require('fs').readFileSync('package.json','utf8'));const d={...p.dependencies,...p.devDependencies};const e=Object.entries(d).filter(([k])=>k.startsWith('effect')||k.startsWith('@effect/'));console.log(e.length?e.map(([k,v])=>k+'@'+v).join(', '):'No Effect packages detected')}catch{console.log('No package.json found')}"`

## When to Apply

- Project imports from `effect/` or `@effect/` packages
- File contains Effect patterns: ServiceMap, Schema, Layer, Effect.gen

## When NOT to Apply

- Effect v2/v3 code (`@effect-ts/` imports)
- fp-ts code
- Non-Effect TypeScript

---

## Effect.gen and Effect.fn

Sequential composition — async/await for Effect:

```ts
const program = Effect.gen(function* () {
  const users = yield* Users
  const user = yield* users.findById(userId)
  return user
})
```

`Effect.fn` adds automatic call-site tracing:

```ts
const getUser = Effect.fn("getUser")(function* (userId: UserId) {
  const users = yield* Users
  return yield* users.findById(userId)
})
```

Cross-cutting concerns via additional arguments (do NOT use `.pipe` or `flow`):

```ts
const getUser = Effect.fn("getUser")(
  function* (userId: UserId): Effect.fn.Return<User, UserNotFoundError> {
    const users = yield* Users
    return yield* users.findById(userId)
  },
  Effect.retry({ times: 3 }),
  Effect.timeout("5 seconds")
)
```

---

## ServiceMap.Service

```ts
class Users extends ServiceMap.Service<Users, {
  findById(id: UserId): Effect.Effect<User, UserNotFoundError>
  create(data: CreateUser): Effect.Effect<User>
}>()(
  "myapp/users/Users"
) {
  static readonly layer = Layer.effect(
    Users,
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient

      const findById = Effect.fn("Users.findById")(function* (id: UserId) {
        // implementation
      })

      const create = Effect.fn("Users.create")(function* (data: CreateUser) {
        // implementation
      })

      return Users.of({ findById, create })
    })
  )
}
```

Rules:
- Tag format: `"pkg/path/ServiceName"` — unique, follows module path
- Interface in second type parameter using **method syntax** (not property syntax)
- All methods use `Effect.fn` for tracing
- `R` (requirements) type must be `never` in the class definition
- Attach `static readonly layer` directly on the class

For deep guidance → load `references/services.md`.

---

## Schema.Class and Branded Types

Brand ALL entity IDs and domain primitives:

```ts
const UserId = Schema.String.pipe(
  Schema.pattern(/^usr_[a-z0-9]{12}$/),
  Schema.brand("UserId")
)

class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.NonEmptyTrimmedString,
  email: Schema.NonEmptyTrimmedString,
  createdAt: Schema.DateTimeUtcFromSelf,
}) {}
```

Variants with TaggedClass:

```ts
class Success extends Schema.TaggedClass<Success>()("Success", {
  value: Schema.Number,
}) {}

class Failure extends Schema.TaggedClass<Failure>()("Failure", {
  error: Schema.String,
}) {}

type Result = Success | Failure
const Result = Schema.Union(Success, Failure)
```

Decision matrix → load `references/schema-decisions.md`.
Full modeling guide → load `references/data-modeling.md`.

---

## Schema.TaggedErrorClass

```ts
class UserNotFoundError extends Schema.TaggedErrorClass<UserNotFoundError>()(
  "UserNotFoundError",
  { userId: UserId }
) {}
```

Yieldable — no `Effect.fail` wrapper:

```ts
yield* new UserNotFoundError({ userId })
```

Recovery:

```ts
pipe(
  Effect.catchTag("UserNotFoundError", (e) =>
    Effect.succeed(null)
  )
)
```

Advanced patterns → load `references/error-handling.md`.

---

## Layer Composition

```ts
const AppLayer = UsersLive.pipe(
  Layer.provideMerge(HttpClientLive),
  Layer.provideMerge(ConfigLive),
)

// Provide ONCE at app entry
BunRuntime.runMain(program.pipe(Effect.provide(AppLayer)))
```

Layers are memoized by reference identity. Define as module-level constants.

Instrumentation via pipe:

```ts
myEffect.pipe(
  Effect.timeout("5 seconds"),
  Effect.retry({ times: 3 }),
  Effect.tap((result) => Effect.log("Got result", result)),
  Effect.withSpan("myOperation"),
)
```

For deep guidance → load `references/services.md`.

---

## Testing Quick Start

```ts
import { assert, it } from "@effect/vitest"

it.effect("creates a user", () =>
  Effect.gen(function* () {
    const users = yield* Users
    const user = yield* users.create({ name: "Alice", email: "a@test.com" })
    assert.strictEqual(user.name, "Alice")
  }).pipe(Effect.provide(UsersTest))
)
```

- `it.effect` — auto-provides TestContext (TestClock, etc.)
- `it.live` — uses real clock
- `layer()` (imported from `@effect/vitest`) — ONLY for expensive shared resources (DB pools)
- Provide test layers inline per test

For deep guidance → load `references/testing.md`.

---

<critical>
## Non-Negotiable Rules

When writing ANY Effect v4 code, these are MANDATORY:

1. **ServiceMap.Service** for all services. Tag: `"pkg/path/ServiceName"`. Interface as second type param with method syntax. Never plain objects.
2. **Brand ALL entity IDs** with real constraints. Never bare `string` or `number`.
3. **Schema.TaggedErrorClass** for ALL domain errors. Never throw. Never `Effect.fail("string")`.
4. **Effect.fn** for all service methods. Enables call-site tracing.
5. **Effect.provide at app entry ONLY**. Never scatter provides.
6. **Effect.log** not console.log. **Config** not process.env. **Option** not null/undefined.
7. **it.effect** from @effect/vitest for tests. Use `assert` (not `expect`). Test layers inline.
8. **readonly** on all service properties.
</critical>

---

## Reference Docs

Load from `references/` on demand. **Never load all at once.**

| Topic | File | Load When |
|-------|------|-----------|
| Services | `references/services.md` | Creating or modifying services |
| Layers | `references/layers.md` | Layer composition, providing, memoization |
| Data Modeling | `references/data-modeling.md` | Defining domain types |
| Schema Decisions | `references/schema-decisions.md` | Choosing between Class, Struct, TaggedClass |
| Error Handling | `references/error-handling.md` | Defining errors or recovery patterns |
| Testing | `references/testing.md` | Writing or fixing tests |
| HTTP Clients | `references/http-clients.md` | Making HTTP requests |
| CLI | `references/cli.md` | Building CLI tools |
| Config | `references/config.md` | Loading configuration |
| Processes | `references/processes.md` | Forking, scoping, child processes |
| Setup | `references/setup.md` | Project setup, tsconfig, tooling |
| Anti-Patterns | `references/anti-patterns.md` | Reviewing code for mistakes |
| Reference Status | `references/effect-setup-status.md` | Auditing or updating this repo's references |

---

## Related Skills

- `/effect-scaffold <type> <Name>` — Generate Effect boilerplate
- `/effect-review [path]` — Audit Effect code against best practices
