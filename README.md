# effectts-skills

Effect-TS v4 skills and smart context injection for Claude Code.

## Install

```bash
# Pi
pi install https://github.com/sanurb/effectts-skills

# Claude Code plugin
npx plugins add sanurb/effectts-skills

# Raw skills only
npx skills add sanurb/effectts-skills
```

## Prerequisites

The `effect-review` skill uses external CLI tools for fast, deterministic detection. Install them before running audits:

| Tool | Purpose | Install |
|------|---------|---------|
| [ripgrep](https://github.com/BurntSushi/ripgrep) | Text-safe rule detection | `brew install ripgrep` / `cargo install ripgrep` |
| [ast-grep](https://github.com/ast-grep/ast-grep) | Structural (AST) rule detection | `brew install ast-grep` / `cargo install ast-grep` / `npm i -g @ast-grep/cli` |

Both are optional for the other skills — only `effect-review` requires them.

## Skills

### `effect-ts` — Ambient Reference *(auto-activates)*

Injects idiomatic Effect v4 patterns when writing Effect code. Covers ServiceMap.Service, Schema.Class, branded types, TaggedErrorClass, Layer composition, and testing with @effect/vitest.

- **Triggers on**: `Effect`, `@effect/`, `Schema`, `ServiceMap`, `Layer`, `TaggedError`
- **Dynamic**: Detects Effect packages from `package.json` at activation
- **Progressive**: Hooks inject detailed reference docs on-demand when reading Effect files

### `/effect-scaffold <type> <Name>` — Code Generator

Generate Effect v4 boilerplate adapted to your project's conventions.

```bash
/effect-scaffold service Users
/effect-scaffold schema Order
/effect-scaffold error Payment
/effect-scaffold test Users
```

Scans existing code for naming, location, and import conventions before generating.

### `/effect-review [path]` — Code Auditor

Audit Effect code against anti-patterns and best practices. Returns scored findings with `file:line` references and fix suggestions.

```bash
/effect-review              # Scan entire project
/effect-review src/services # Scan specific directory
```

Checks 18 patterns across Critical (must fix) and Warning (should fix) severity levels.

## Smart Context Injection

Hooks provide just-in-time reference loading:

1. **Session start** — Detects Effect projects and activates the skill
2. **Pre-tool-use** — When reading `.ts` files, pattern-matches content and injects the relevant reference doc (services, schema, errors, testing, http, cli, config, processes)

References are injected once per topic per session — no duplicate context.

## Reference Docs

| Topic | File |
|-------|------|
| Services | `references/services.md` |
| Layers | `references/layers.md` |
| Data Modeling | `references/data-modeling.md` |
| Schema Decisions | `references/schema-decisions.md` |
| Error Handling | `references/error-handling.md` |
| Testing | `references/testing.md` |
| HTTP Clients | `references/http-clients.md` |
| CLI | `references/cli.md` |
| Config | `references/config.md` |
| Processes | `references/processes.md` |
| Setup | `references/setup.md` |
| Anti-Patterns | `references/anti-patterns.md` |
| Reference Status | `references/effect-setup-status.md` |

## Sources

Built from [kitlangton/effect-solutions](https://github.com/kitlangton/effect-solutions), [effect-ts/effect](https://github.com/effect-ts/effect), and [artimath/effect-skills](https://github.com/artimath/effect-skills) (MIT).

## License

MIT
