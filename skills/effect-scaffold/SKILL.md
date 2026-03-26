---
name: effect-scaffold
description: "Generate Effect v4 boilerplate: services, schemas, errors, tests. Adapts to project conventions. Use when asked to create, scaffold, or generate new Effect structures."
argument-hint: "<service|schema|error|test> <Name>"
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Effect Scaffold

Generate idiomatic Effect v4 code adapted to the project's conventions.

**Type:** `$ARGUMENTS[0]` — one of: `service`, `schema`, `error`, `test`
**Name:** `$ARGUMENTS[1]` — PascalCase (e.g., `Users`, `OrderNotFound`, `CreateUser`)

## Existing Effect Code

!`grep -rl "ServiceMap.Service\|Schema.Class\|Schema.TaggedErrorClass" --include="*.ts" 2>/dev/null | head -8 || echo "No existing Effect code found"`

---

## Workflow

### Step 0 — Verify Effect v4

Before generating ANY code, verify the project uses Effect v4:

```
Read package.json → check "effect" version
```

- If version starts with `4.` or `^4.` or `>=4` or `beta` → proceed
- If version starts with `3.` or `2.` or `@effect-ts/` → STOP. Report: "This project uses Effect v{version}. These templates require v4. Upgrade first."
- If no `effect` in dependencies → STOP. Report: "No Effect dependency found. Run: bun add effect@beta"

### Step 1 — Discover Conventions

Before generating, scan the project for existing patterns:

```
Grep("ServiceMap.Service", type="ts")     → file location, naming, structure
Grep("Schema.Class", type="ts")           → schema patterns
Grep("Schema.TaggedErrorClass", type="ts") → error patterns
Glob("**/*.test.ts")                      → test file locations
```

Adapt to what you find:
- **File location**: Where do similar files live? (`src/services/`, `src/domain/`, flat?)
- **Naming**: kebab-case? PascalCase? Suffix patterns? (`user.service.ts`, `users.ts`?)
- **Imports**: Barrel imports? Path aliases? (`@/services`, relative?)
- **Layer style**: How are layers composed?

If no existing Effect code found, use canonical templates below as-is.

### Step 2 — Generate

Select the template matching `$ARGUMENTS[0]` and replace `{Name}` with `$ARGUMENTS[1]`.

<critical>
NON-NEGOTIABLE for ALL generated code:
- ServiceMap.Service for services (tag: `"pkg/path/ServiceName"`, e.g. `"myapp/users/Users"`)
- Brand ALL IDs with real constraints (Schema.pattern + Schema.brand)
- Schema.TaggedErrorClass with type parameter: `Schema.TaggedErrorClass<T>()("Tag", {...})`
- Effect.fn for all service methods
- readonly properties on services
- All exports explicit (named exports, no default)
</critical>

---

#### Template: service

Derive `{prefix}` from `{Name}`: lowercase first 3 chars (e.g., Users → `usr`, Order → `ord`, Payment → `pay`).

```ts
import { Effect, Layer, Schema, ServiceMap } from "effect"

// ── ID ──────────────────────────────────────────────
const {Name}Id = Schema.String.pipe(
  Schema.pattern(/^{prefix}_[a-z0-9]{12}$/),
  Schema.brand("{Name}Id")
)
type {Name}Id = typeof {Name}Id.Type

// ── Errors ──────────────────────────────────────────
class {Name}NotFoundError extends Schema.TaggedErrorClass<{Name}NotFoundError>()(
  "{Name}NotFoundError",
  { id: {Name}Id }
) {}

// ── Service ─────────────────────────────────────────
class {Name} extends ServiceMap.Service<{Name}, {
  findById(id: {Name}Id): Effect.Effect<unknown, {Name}NotFoundError>
  create(data: unknown): Effect.Effect<unknown>
}>()(
  "myapp/{name}/{Name}"
) {
  static readonly layer = Layer.effect(
    {Name},
    Effect.gen(function* () {
      const findById = Effect.fn("{Name}.findById")(function* (id: {Name}Id) {
        // TODO: implement
      })

      const create = Effect.fn("{Name}.create")(function* (data: unknown) {
        // TODO: implement
      })

      return {Name}.of({ findById, create })
    })
  )

  static readonly testLayer = Layer.sync({Name}, () => {
    const store = new Map<{Name}Id, unknown>()
    return {Name}.of({
      findById: (id) =>
        Effect.fromNullable(store.get(id)).pipe(
          Effect.mapError(() => new {Name}NotFoundError({ id }))
        ),
      create: (data) => Effect.sync(() => {
        // TODO: generate ID + store
        return data
      }),
    })
  })
}

export { {Name}, {Name}Id, {Name}NotFoundError }
```

#### Template: schema

```ts
import { Schema } from "effect"

// ── Branded ID ──────────────────────────────────────
const {Name}Id = Schema.String.pipe(
  Schema.pattern(/^{prefix}_[a-z0-9]{12}$/),
  Schema.brand("{Name}Id")
)

// ── Schema ──────────────────────────────────────────
class {Name} extends Schema.Class<{Name}>("{Name}")({
  id: {Name}Id,
  createdAt: Schema.DateTimeUtcFromSelf,
  // TODO: add domain fields
}) {}

// ── JSON Encoding ───────────────────────────────────
const {Name}FromJson = Schema.fromJsonString({Name})

export { {Name}, {Name}Id, {Name}FromJson }
```

#### Template: error

```ts
import { Schema } from "effect"

class {Name}NotFoundError extends Schema.TaggedErrorClass<{Name}NotFoundError>()(
  "{Name}NotFoundError",
  { id: Schema.String }
) {}

class {Name}ValidationError extends Schema.TaggedErrorClass<{Name}ValidationError>()(
  "{Name}ValidationError",
  {
    field: Schema.String,
    reason: Schema.String,
  }
) {}

class {Name}Error extends Schema.TaggedErrorClass<{Name}Error>()(
  "{Name}Error",
  { cause: Schema.Defect }
) {}

export { {Name}Error, {Name}NotFoundError, {Name}ValidationError }
```

#### Template: test

```ts
import { Effect } from "effect"
import { assert, describe, it } from "@effect/vitest"
import { {Name} } from "../src/{name}"

describe("{Name}", () => {
  it.effect("creates an instance", () =>
    Effect.gen(function* () {
      const svc = yield* {Name}
      const result = yield* svc.create({ /* TODO: valid data */ })
      assert.isDefined(result)
    }).pipe(Effect.provide({Name}.testLayer))
  )

  it.effect("finds by id", () =>
    Effect.gen(function* () {
      const svc = yield* {Name}
      const created = yield* svc.create({ /* TODO: valid data */ })
      // TODO: extract ID, then findById
    }).pipe(Effect.provide({Name}.testLayer))
  )

  it.effect("rejects unknown id", () =>
    Effect.gen(function* () {
      const svc = yield* {Name}
      const error = yield* svc.findById(
        /* TODO: nonexistent ID */
      ).pipe(Effect.flip)
      assert.strictEqual(error._tag, "{Name}NotFoundError")
    }).pipe(Effect.provide({Name}.testLayer))
  )
})
```

---

### Step 3 — Write File

Write to the location matching project conventions discovered in Step 1.
If no conventions found, use: `src/{type}s/{name}.ts` (kebab-case filename).

### Step 4 — Report

```
✓ Generated: {file_path}
  Type: {type}
  Name: {Name}
  Exports: {list of exports}
  Next: implement TODO placeholders
```

---

## Stop Conditions

- STOP if `$ARGUMENTS[0]` is not one of: service, schema, error, test
- STOP if `$ARGUMENTS[1]` is missing or not PascalCase
- STOP if a file with the same name already exists at the target location — ask before overwriting
