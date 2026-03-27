# PROJECT KNOWLEDGE BASE

**Generated:** 2026-03-27
**Commit:** 77b07e7
**Branch:** main

## OVERVIEW

Pi package providing Effect v4 skills, hooks, and extensions for idiomatic code generation, review, and smart context injection.

## STRUCTURE

```
effectts-skills/
├── extensions/          # Pi extension: effect-context.ts (tools, commands, hooks)
├── hooks/               # Claude Code hooks (session-start, pretooluse-inject)
├── shared/              # Single source of truth: patterns.json
├── skills/
│   ├── effect-ts/       # Ambient skill (auto-activates on Effect code)
│   │   └── references/  # 13 reference docs loaded on demand
│   ├── effect-review/   # /effect-review audit harness
│   │   └── references/  # Rule dispatch table + ast-grep rules
│   └── effect-scaffold/ # /effect-scaffold code generator
└── tests/               # Validation: cross-source consistency checks
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add/modify pattern detection | `shared/patterns.json` | Single source of truth for both extension + hooks |
| Add reference doc topic | `skills/effect-ts/references/` + update `extensions/effect-context.ts` TOPICS map |
| Add review rule | `skills/effect-review/references/rule-dispatch-table.md` + `ast-grep-rules.md` |
| Change scaffold templates | `skills/effect-scaffold/SKILL.md` (templates) AND `extensions/effect-context.ts` (generators) |
| Fix hook behavior | `hooks/pretooluse-inject.mjs` (reads) or `hooks/session-start.mjs` (startup) |
| Run tests | `node tests/scaffold-generators.test.mjs` |

## CONVENTIONS

- **Dual delivery**: Skills work in both Pi (via `extensions/effect-context.ts`) and Claude Code (via `hooks/`). Changes must stay consistent across both.
- **Shared patterns**: `shared/patterns.json` is the single source of truth for pattern→reference mapping. Extension and hooks both load from it. Never hardcode patterns elsewhere.
- **Effect v4 only**: All templates, examples, and references target Effect v4. No v2/v3 APIs (`@effect-ts/`, `Effect.catchAll`, `Effect.forkDaemon`).
- **Scaffold duplication**: Templates exist in BOTH `skills/effect-scaffold/SKILL.md` (for skill-based generation) AND `extensions/effect-context.ts` (for tool/command-based generation). Keep them in sync.
- **Reference injection**: Docs injected once per topic per session (tracked via `injectedTopics` set in extension, `EFFECT_SEEN_REFS` env var in hooks).

## ANTI-PATTERNS (THIS PROJECT)

- **Never** add `@app/` tag convention in code examples — use `"pkg/path/ServiceName"` format
- **Never** use `expect()` from vitest — always `assert` from `@effect/vitest`
- **Never** show `Schema.brand()` without `Schema.pattern()` constraint — bare brands are forbidden
- **Never** duplicate anti-pattern rules in review skill — they live in `references/anti-patterns.md` only
- **Never** use `Schema.TaggedErrorClass("Tag")` — must be `Schema.TaggedErrorClass<T>()("Tag", {...})`

## COMMANDS

```bash
# Run validation tests
node tests/scaffold-generators.test.mjs

# Install as pi package
pi install https://github.com/sanurb/effectts-skills
```

## Learning more about the "effect" & "@effect/\*" packages

`~/.local/share/ai-references/v4/LLMS.md` is an authoritative source of information about the
"effect" and "@effect/\*" packages. Read this before looking elsewhere for
information about these packages. It contains the best practices for using
effect.

Use this for learning more about the library, rather than browsing the code in
`node_modules/`.

## NOTES

- `hooks.json` uses `${CLAUDE_PLUGIN_ROOT}` env var for path resolution in Claude Code
- The extension registers both slash commands (`/effect:docs`, `/effect:service`, `/effect:test`) AND LLM-callable tools (`effect_scaffold`, `effect_docs`)
- Reference docs should stay under 300 lines each (validated by tests)
- `hooks/pretooluse-inject.mjs` reads the target file's content to detect patterns — only triggers on `.ts`/`.tsx` files
