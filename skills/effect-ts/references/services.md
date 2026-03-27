# Services

## Table of Contents

- [ServiceMap.Service](#servicemapservice)
- [Layer Implementations](#layer-implementations)
- [Service-Driven Development](#service-driven-development)
- [Test Implementations](#test-implementations)

For layer composition, providing, and memoization → see [layers.md](layers.md).

## ServiceMap.Service

Define services with `ServiceMap.Service` as a class declaring a unique identifier and typed interface:

```typescript
import { Effect, ServiceMap } from "effect"

class Database extends ServiceMap.Service<Database, {
  query(sql: string): Effect.Effect<Array<unknown>>
  execute(sql: string): Effect.Effect<void>
}>()(
  "myapp/db/Database"
) {}
```

**Rules:**
- Tag format: `"pkg/path/ServiceName"` — unique, following module path
- Interface as second type parameter using **method syntax**
- Service methods have no dependencies (`R = never`). Dependencies via Layer composition
- Attach `static readonly layer` and `static readonly testLayer` on the class

## ServiceMap.Reference

For configuration values, feature flags, or any service with a default value:

```typescript
import { ServiceMap } from "effect"

const FeatureFlag = ServiceMap.Reference<boolean>("myapp/FeatureFlag", {
  defaultValue: () => false
})
```

Override in layers or tests — the default is used when no provider exists.

## Layer Implementations

Use `Layer.effect` for effectful implementations and `Layer.sync` for synchronous ones:

```typescript
import { Effect, Layer, Schema, ServiceMap } from "effect"
import { HttpClient, HttpClientResponse } from "effect/unstable/http"

const UserId = Schema.String.pipe(
  Schema.pattern(/^usr_[a-z0-9]{12}$/),
  Schema.brand("UserId")
)
type UserId = typeof UserId.Type

class User extends Schema.Class<User>("User")({
  id: UserId,
  name: Schema.String,
  email: Schema.String,
}) {}

class UserNotFoundError extends Schema.TaggedErrorClass<UserNotFoundError>()(
  "UserNotFoundError",
  { id: UserId }
) {}

class Users extends ServiceMap.Service<Users, {
  findById(id: UserId): Effect.Effect<User, UserNotFoundError>
  all(): Effect.Effect<ReadonlyArray<User>>
}>()(
  "myapp/users/Users"
) {
  static readonly layer = Layer.effect(
    Users,
    Effect.gen(function* () {
      const http = yield* HttpClient.HttpClient

      const findById = Effect.fn("Users.findById")(
        function* (id: UserId) {
          const response = yield* http.get(`/users/${id}`)
          return yield* HttpClientResponse.schemaBodyJson(User)(response)
        },
        Effect.catchTag("ResponseError", (error) =>
          error.response.status === 404
            ? new UserNotFoundError({ id })
            : Effect.die(error)
        ),
      )

      const all = Effect.fn("Users.all")(function* () {
        const response = yield* http.get("/users")
        return yield* HttpClientResponse.schemaBodyJson(Schema.Array(User))(response)
      })

      return Users.of({ findById, all })
    })
  )
}
```

**Layer naming:** `layer`, `testLayer`, `postgresLayer`, `sqliteLayer`.

## Service-Driven Development

Sketch leaf service tags first (no implementations). Write and type-check higher-level orchestration before leaf services are runnable:

```typescript
import { Clock, Effect, Layer, Schema, ServiceMap } from "effect"

const EventId = Schema.String.pipe(
  Schema.pattern(/^evt_[a-z0-9]{12}$/),
  Schema.brand("EventId")
)
type EventId = typeof EventId.Type
const UserId = Schema.String.pipe(
  Schema.pattern(/^usr_[a-z0-9]{12}$/),
  Schema.brand("UserId")
)
type UserId = typeof UserId.Type

// Leaf services: contracts only, no implementations yet
class Users extends ServiceMap.Service<Users, {
  findById(id: UserId): Effect.Effect<User>
}>()(
  "myapp/users/Users"
) {}

class Tickets extends ServiceMap.Service<Tickets, {
  issue(eventId: EventId, userId: UserId): Effect.Effect<Ticket>
}>()(
  "myapp/tickets/Tickets"
) {}

// Higher-level service: orchestrates leaf services
class Events extends ServiceMap.Service<Events, {
  register(eventId: EventId, userId: UserId): Effect.Effect<Registration>
}>()(
  "myapp/events/Events"
) {
  static readonly layer = Layer.effect(
    Events,
    Effect.gen(function* () {
      const users = yield* Users
      const tickets = yield* Tickets

      const register = Effect.fn("Events.register")(
        function* (eventId: EventId, userId: UserId) {
          const user = yield* users.findById(userId)
          const ticket = yield* tickets.issue(eventId, userId)
          // ... build registration
        }
      )

      return Events.of({ register })
    })
  )
}
```

This compiles and type-checks before leaf services have implementations.

## Test Implementations

Use `Layer.sync` with in-memory state. Mutable state is fine in tests:

```typescript
class Database extends ServiceMap.Service<Database, {
  query(sql: string): Effect.Effect<Array<unknown>>
}>()(
  "myapp/db/Database"
) {
  static readonly testLayer = Layer.sync(Database, () => {
    const records = new Map([["user-1", { id: "user-1", name: "Alice" }]])
    return Database.of({
      query: (sql) => Effect.succeed([...records.values()]),
    })
  })
}
```
