# Project Setup

How to configure a new or existing project for Effect v4. This file covers **project-level tooling only** — tsconfig, editor, language service, testing, and development workflow.

> **Reference repo management** is in [effect-setup-status.md](./effect-setup-status.md). Read that file when auditing or updating this repo's reference docs, not when setting up a user project.

## Table of Contents

- [Effect Language Service](#effect-language-service)
- [TypeScript Configuration](#typescript-configuration)
- [Module Settings by Project Type](#module-settings-by-project-type)
- [Testing Setup](#testing-setup)
- [Development Workflow](#development-workflow)
- [Acceptance Criteria](#acceptance-criteria)

## Effect Language Service

The Effect Language Service provides editor diagnostics and compile-time type checking. It catches errors TypeScript alone cannot detect.

### Install

```bash
bun add -d @effect/language-service
```

Add to `tsconfig.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/Effect-TS/language-service/refs/heads/main/schema.json",
  "compilerOptions": {
    "plugins": [{ "name": "@effect/language-service" }]
  }
}
```

The `$schema` field enables autocomplete and validation for plugin options.

### Editor Setup

Your editor must use the **workspace** TypeScript version.

**VS Code / Cursor:**

```json
// .vscode/settings.json
{
  "typescript.tsdk": "./node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

Then F1 → "TypeScript: Select TypeScript version" → "Use workspace version".

**JetBrains:** Settings → Languages & Frameworks → TypeScript → select workspace version.

### Build-Time Diagnostics

Patch TypeScript for CI enforcement:

```bash
bunx effect-language-service patch
```

Persist across installs:

```json
{
  "scripts": { "prepare": "effect-language-service patch" }
}
```

## TypeScript Configuration

### Recommended tsconfig.json

```jsonc
{
  "compilerOptions": {
    // Build performance
    "incremental": true,
    "composite": true,

    // Module system
    "target": "ES2022",
    "module": "NodeNext",
    "moduleDetection": "force",

    // Import handling
    "verbatimModuleSyntax": true,
    "rewriteRelativeImportExtensions": true,

    // Type safety
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUnusedLocals": true,
    "noImplicitOverride": true,

    // Development
    "declarationMap": true,
    "sourceMap": true,
    "skipLibCheck": true,

    // Effect
    "plugins": [{ "name": "@effect/language-service" }]
  }
}
```

### Why These Settings

| Setting | Reason |
|---------|--------|
| `incremental + composite` | Fast rebuilds, monorepo project references |
| `ES2022 + NodeNext` | Modern JS, proper ESM/CJS resolution |
| `verbatimModuleSyntax` | Preserves `import type` exactly |
| `rewriteRelativeImportExtensions` | Allows `.ts` in imports |
| `strict + exactOptionalPropertyTypes` | Maximum type safety |
| `skipLibCheck` | Faster builds (skip node_modules checking) |

## Module Settings by Project Type

### Bundled Apps (Vite, Webpack, esbuild)

```jsonc
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "bundler",
    "noEmit": true
  }
}
```

TypeScript acts as type-checker only. Bundler handles module transformation.

### Libraries and Node.js Apps

```jsonc
{
  "compilerOptions": {
    "module": "NodeNext"
  }
}
```

Required for npm packages, Node.js apps, and CLI tools.

Additional library settings:

```jsonc
{
  "compilerOptions": {
    "declaration": true,
    "composite": true,
    "declarationMap": true
  }
}
```

**Rule of thumb:** Build tool compiling your code → `preserve` + `bundler`. TypeScript compiling → `NodeNext`.

## Testing Setup

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

```json
// package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Full testing patterns → load `references/testing.md`.

## Development Workflow

From the Effect monorepo conventions:

```bash
pnpm install          # install
pnpm lint-fix         # lint and format
pnpm test run <file>  # run tests
pnpm check            # type checking (pnpm clean if stuck)
pnpm build            # build
pnpm docgen           # verify JSDoc examples
pnpm codegen          # regenerate barrel files (index.ts)
```

### Testing conventions

- Use `it.effect` for all Effect-based tests, not `Effect.runSync` with regular `it`
- Import `{ assert, describe, it }` from `@effect/vitest`
- Test files live in `tests/` or `packages/*/test/`

## Acceptance Criteria

After applying this setup, verify ALL of the following:

- [ ] `tsconfig.json` has `"strict": true` and `"exactOptionalPropertyTypes": true`
- [ ] `@effect/language-service` is in devDependencies
- [ ] `tsconfig.json` has the language service plugin entry
- [ ] `.vscode/settings.json` points to workspace TypeScript (if VS Code/Cursor)
- [ ] `vitest.config.ts` exists with test include pattern
- [ ] `@effect/vitest` is in devDependencies (beta channel)
- [ ] `bun run test` executes without config errors
- [ ] Module resolution matches project type (bundler vs NodeNext)

If ANY check fails, STOP and report the specific failure. Do not proceed with partial setup.
