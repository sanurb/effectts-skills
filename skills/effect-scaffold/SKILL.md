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
- ServiceMap.Service for services (tag: `@app/{Name}`)
- Brand ALL IDs with real constraints (Schema.pattern + Schema.brand)
- Schema.TaggedErrorClass for errors
- Effect.fn for all service methods
- readonly properties on services
- All exports explicit (named exports, no default)
</critical>

---

#### Template: service

```ts
import { Effect, Schema, Layer } from "effect"
import { ServiceMap } from "effect/unstable"

// ── ID ──────────────────────────────────────────────
const {Name}Id = Schema.String.pipe(
  Schema.pattern(/^{prefix}_[a-z0-9]{12}$/),
  Schema.brand("{Name}Id")
)

// ── Errors ──────────────────────────────────────────
class {Name}NotFoundError extends Schema.TaggedErrorClass<{Name}NotFoundError>()(
  "{Name}NotFoundError",
  { id: {Name}Id }
) {}

// ── Service ─────────────────────────────────────────
class {Name} extends ServiceMap.Service<{Name}>()("@app/{Name}", {
  findById: Effect.fn("{Name}.findById")(function* (id: typeof {Name}Id.Type) {
    // TODO: implement
  }),
  create: Effect.fn("{Name}.create")(function* (data: unknown) {
    // TODO: implement
  }),
}) {}

// ── Live Layer ──────────────────────────────────────
const {Name}Live = Layer.effect(
  {Name},
  Effect.gen(function* () {
    return {Name}.of({
      findById: Effect.fn("{Name}.findById")(function* (id) {
        // TODO: real implementation
      }),
      create: Effect.fn("{Name}.create")(function* (data) {
        // TODO: real implementation
      }),
    })
  })
)

// ── Test Layer ──────────────────────────────────────
const {Name}Test = Layer.sync(
  {Name},
  () => {
    const store = new Map<typeof {Name}Id.Type, unknown>()
    return {Name}.of({
      findById: Effect.fn("{Name}.findById")(function* (id) {
        // TODO: in-memory lookup from store
      }),
      create: Effect.fn("{Name}.create")(function* (data) {
        // TODO: in-memory store.set
      }),
    })
  }
)

export { {Name}, {Name}Live, {Name}Test, {Name}Id, {Name}NotFoundError }
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

class {Name}Error extends Schema.TaggedErrorClass<{Name}Error>()(
  "{Name}Error",
  {
    message: Schema.String,
    // TODO: add context fields
  }
) {}

class {Name}NotFoundError extends Schema.TaggedErrorClass<{Name}NotFoundError>()(
  "{Name}NotFoundError",
  {
    id: Schema.String,
  }
) {}

class {Name}ValidationError extends Schema.TaggedErrorClass<{Name}ValidationError>()(
  "{Name}ValidationError",
  {
    field: Schema.String,
    reason: Schema.String,
  }
) {}

export { {Name}Error, {Name}NotFoundError, {Name}ValidationError }
```

#### Template: test

```ts
import { Effect } from "effect"
import { describe, expect } from "vitest"
import { it } from "@effect/vitest"
// TODO: import {Name} service and test layer

describe("{Name}", () => {
  it.effect("should create", () =>
    Effect.gen(function* () {
      // TODO: implement test
      expect(true).toBe(true)
    }).pipe(Effect.provide(/* {Name}Test */))
  )

  it.effect("should find by id", () =>
    Effect.gen(function* () {
      // TODO: implement test
      expect(true).toBe(true)
    }).pipe(Effect.provide(/* {Name}Test */))
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
