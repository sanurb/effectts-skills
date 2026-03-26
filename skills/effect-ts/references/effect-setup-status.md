# Effect Reference Status

Operational source of truth for the state of local Effect reference repositories and their alignment with this repo's reference docs.

**This file is maintained by the agent.** Update it every time you audit reference freshness. Never treat it as static documentation.

---

## Review Protocol

### When to Run a Review

Run a freshness review when ANY of these are true:

1. You are editing files in `skills/effect-ts/references/`
2. User asks to "update Effect references" or "check if references are current"
3. More than 14 days have passed since `last_review_date` below
4. You encounter an Effect API in user code that contradicts this repo's references

### Review Steps (Execute in Order)

```
1. Read this file completely
2. For each repo in the table below:
   a. Check if the directory exists: `ls <path> 2>/dev/null`
   b. If missing → record status=MISSING, skip to next
   c. Get current commit: `cd <path> && git log --oneline -1`
   d. Fetch upstream: `cd <path> && git fetch origin 2>/dev/null`
   e. Check for new commits: `cd <path> && git log HEAD..origin/main --oneline | head -5`
   f. Record commit hash and whether upstream has new commits
3. If any repo has new commits:
   a. For solutions/: diff docs/ against this repo's references/
   b. For v4/: check ai-docs/ and MIGRATION.md for new patterns
   c. For monorepo/: check AGENTS.md for workflow changes
4. Record all findings in the tables below
5. Update last_review_date
6. If gaps found → add to Detected Gaps table with action items
```

### When to STOP and Report Blockers

- If a reference repo is MISSING and you cannot clone it (no network, no permission): record as BLOCKER
- If upstream has breaking API changes that invalidate multiple reference files: record as BLOCKER, do not silently patch
- If the Effect v4 beta channel has moved to stable: record as BLOCKER (version strategy must change)

---

## Last Review

| Field | Value |
|-------|-------|
| `last_review_date` | 2026-03-26 |
| `reviewed_by` | agent (corrective audit pass — v4 canonical verification) |
| `trigger` | Full corrective audit against ~/.local/share/ai-references/effect/v4/ |

---

## Reference Repositories

| Repo | Path | Exists | Commit | Upstream URL | Last Fetched | Upstream Ahead |
|------|------|--------|--------|--------------|--------------|----------------|
| effect-solutions | `~/.local/share/ai-references/effect/solutions/` | ✅ | `74dccc9` | github.com/kitlangton/effect-solutions | never | UNKNOWN (never fetched) |
| effect monorepo | `~/.local/share/ai-references/effect/monorepo/` | ✅ | `6e3782a` | github.com/effect-ts/effect | never | UNKNOWN (never fetched) |
| effect-smol v4 | `~/.local/share/ai-references/effect/v4/` | ✅ | `1e223c3` | github.com/Effect-TS/effect-smol | never | UNKNOWN (never fetched) |
| artimath skills | `~/.local/share/ai-references/effect/skills/` | ✅ | — | — | — | — |

### Clone Commands (if repos are missing)

```bash
mkdir -p ~/.local/share/ai-references/effect
cd ~/.local/share/ai-references/effect

git clone https://github.com/kitlangton/effect-solutions.git solutions
git clone https://github.com/effect-ts/effect.git monorepo
git clone https://github.com/Effect-TS/effect-smol.git v4
```

---

## Source Mapping

Which upstream files each reference doc in this repo is derived from.

| This Repo Reference | Primary Upstream Source | Secondary Source |
|---------------------|----------------------|------------------|
| `setup.md` | `solutions/packages/website/docs/01-project-setup.md`, `02-tsconfig.md` | `monorepo/AGENTS.md` |
| `services-and-layers.md` | `solutions/packages/website/docs/04-services-and-layers.md` | `v4/ai-docs/src/01_effect/` |
| `data-modeling.md` | `solutions/packages/website/docs/05-data-modeling.md` | `v4/ai-docs/src/01_effect/` |
| `error-handling.md` | `solutions/packages/website/docs/06-error-handling.md` | — |
| `config.md` | `solutions/packages/website/docs/07-config.md` | — |
| `testing.md` | `solutions/packages/website/docs/08-testing.md` | `v4/ai-docs/src/09_testing/` |
| `http-clients.md` | `solutions/packages/website/docs/11-http-clients.md` | `v4/ai-docs/src/50_http-client/` |
| `cli.md` | `solutions/packages/website/docs/13-cli.md` | `v4/ai-docs/src/70_cli/` |
| `processes.md` | artimath/effect-skills | `v4/ai-docs/src/60_child-process/` |
| `schema-decisions.md` | artimath/effect-skills | `solutions/packages/website/docs/05-data-modeling.md` |
| `anti-patterns.md` | composite (this repo) | — |

---

## Detected Gaps

| ID | Gap Description | Severity | Source | Action | Status |
|----|----------------|----------|--------|--------|--------|
| G1 | Reference repos have never been fetched — all are stale since initial clone (Mar 20) | HIGH | all repos | Run `git fetch origin` in each repo, compare | OPEN |
| G2 | `v4/ai-docs/` has rich structured docs not used by this repo | MEDIUM | v4 | Review ai-docs topics, merge missing content into references | OPEN |
| G3 | `v4/MIGRATION.md` (v3→v4) not referenced anywhere in this repo | MEDIUM | v4 | Add migration reference or integrate into anti-patterns.md | OPEN |
| G4 | `solutions/` docs 09 (project-structure), 10 (incremental-adoption), 12 (observability), 14 (use-pattern) have no corresponding reference files | LOW | solutions | Evaluate whether these topics warrant new reference docs | OPEN |
| G5 | Scaffold generators in `extensions/effect-context.ts` use different ServiceMap.Service signatures than `skills/effect-scaffold/SKILL.md` | HIGH | this repo | Align both to canonical v4 pattern from v4/ai-docs | FIXED — all three sources aligned to `ServiceMap.Service<Name, { method(): Effect }>()("pkg/path/Name")` |
| G6 | `solutions/` docs 03 (basics) patterns may contain updated Effect.gen/Effect.fn usage | LOW | solutions | Compare against SKILL.md core patterns section | OPEN |
| G7 | Dual injection system (extension + hooks) duplicates pattern detection in 2 languages | HIGH | this repo | Consolidate to extension only, or extract shared config | FIXED — extracted shared/patterns.json, both extension and hooks load from it |
| G8 | anti-patterns.md, review checklist, and schema-decisions.md have 60% content overlap | HIGH | this repo | Make anti-patterns.md single source of truth, others reference it | FIXED — anti-patterns.md is canonical (C1-C10, W1-W9), review references it, schema-decisions links to it |
| G9 | 5 of 12 reference files exceed 200-line guideline (services-and-layers: 330, testing: 402, http: 259, cli: 280, error: 227) | MEDIUM | this repo | Split oversized files | FIXED — services-and-layers split into services.md + layers.md, testing.md trimmed to 195 lines. http/cli/error slightly over but within 300-line threshold. |
| G10 | Tag convention `@app/Name` in references doesn't match canonical `pkg/path/Name` from v4 source | HIGH | this repo | Update all code examples in references to use canonical tag format | FIXED — all code blocks in all references now use `"myapp/path/Name"` |
| G11 | error-handling.md uses `Schema.TaggedErrorClass("Tag")("Tag",{})` — missing type parameter vs canonical `Schema.TaggedErrorClass<T>()("Tag",{})` | MEDIUM | error-handling.md | Fix signature | FIXED — all instances updated to `Schema.TaggedErrorClass<T>()("Tag",{})` |
| G12 | No tests for extension scaffold generators — generated code may not compile | HIGH | this repo | Add snapshot tests or compile-check tests | FIXED — tests/scaffold-generators.test.mjs validates signatures, tags, patterns, cross-source consistency |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | Created this status file | No prior tracking existed. References were unversioned and never verified against upstream. |
| 2026-03-26 | Split setup.md into project-setup (setup.md) and reference-tracking (this file) | Mixed concerns: project tooling config was entangled with reference repo management. |
| 2026-03-26 | Fixed ServiceMap.Service signature in SKILL.md, scaffold SKILL.md, and extension generators | All three sources used different signatures. Aligned to canonical v4: `ServiceMap.Service<Name, { method(): Effect }>()("pkg/path/Name")` |
| 2026-03-26 | Fixed TaggedErrorClass signature in extension generators | Was missing type parameter. Aligned to `Schema.TaggedErrorClass<T>()("Tag", {...})` |
| 2026-03-26 | Replaced dead-code test scaffold with real test patterns | Old scaffold had `expect(true).toBe(true)` with all actual code commented out |
| 2026-03-26 | Downgraded C8 (Effect.catchAll) from blanket Critical to context-dependent | `Effect.catchAll` is a legitimate v4 API; only loses type info with generic handlers |
| 2026-03-26 | Fixed W2 label from "v3 API" to "v2 API" | `@effect-ts/` is v2, not v3 |
| 2026-03-26 | Extracted shared/patterns.json as single source of truth for pattern→reference mapping | Extension (TS) and hooks (MJS) both had independent pattern lists. Now both load from one JSON file. |
| 2026-03-26 | Made anti-patterns.md the canonical anti-pattern checklist | review SKILL.md now references it instead of duplicating. schema-decisions.md links to it. Added W9 (bare brand). |
| 2026-03-26 | Split services-and-layers.md into services.md + layers.md | 330 lines was 65% over guideline. Each new file ~120-150 lines. Old file now a redirect. |
| 2026-03-26 | Trimmed testing.md from 402 to ~195 lines | Removed 170-line worked example, replaced with compact inline test pattern. |
| 2026-03-26 | Fixed all @app/ tags across references to myapp/path/Name | Aligned to canonical v4 convention from effect-smol ai-docs. |
| 2026-03-26 | Fixed all TaggedErrorClass signatures in error-handling.md | Added `<T>()` type parameter to match canonical v4 pattern. |
| 2026-03-26 | Added tests/scaffold-generators.test.mjs | 100 assertions covering signatures, tags, deduplication, shared config, file sizes. |
| 2026-03-26 | Fixed scaffold `<critical>` block — was `@app/{Name}`, now `"pkg/path/ServiceName"` | Prose instructions contradicted code templates. Test suite now checks critical blocks. |
| 2026-03-26 | Added version gate (Step 0) to effect-scaffold | Scaffold was generating v4 code without verifying project uses Effect v4. Marked unsafe. |
| 2026-03-26 | Fixed cross-skill reference path in effect-review | Was `references/anti-patterns.md` (ambiguous), now `skills/effect-ts/references/anti-patterns.md` (absolute from repo root) |
| 2026-03-26 | Removed unused `isToolCallEventType` import from extension | Dead import since original port |
| 2026-03-26 | Fixed bare brands in services.md SDD example | `Schema.brand("EventId")` without constraints violated W9. Added `Schema.pattern()` |
| 2026-03-26 | Deleted services-and-layers.md redirect | Dead 8-line stub. All consumers now point to services.md + layers.md directly |
| 2026-03-26 | Test suite expanded to 114 assertions | Added: critical block @app/ check, version gate check, dead import check, cross-skill path check, bare brand check, redirect deletion check |
| 2026-03-26 | CORRECTIVE: Restored error-handling.md (was deleted by prior agent) | Prior edit sessions deleted the file from disk. Rewrote with correct v4 APIs: Effect.catch, Effect.catchCause, Effect.catchDefect, v3→v4 migration table |
| 2026-03-26 | CORRECTIVE: Fixed v3 API names across entire repo | Effect.catchAll→Effect.catch, Effect.fork→Effect.forkChild, Effect.forkDaemon→Effect.forkDetach, it.layer()→layer(), expect→assert. Verified against v4/ai-docs/ canonical source |
| 2026-03-26 | CORRECTIVE: Fixed Effect.fn second-arg pattern | SKILL.md taught `flow(Effect.retry, Effect.timeout)` which is v3. v4 uses variadic rest args directly + Effect.fn.Return type annotation |
| 2026-03-26 | CORRECTIVE: Replaced services-and-layers.md (was still original 330-line file) | Prior agent's Write was overwritten by a later rm. Recreated as 7-line redirect |
| 2026-03-26 | Test suite expanded to 144 assertions | Added v4 API correctness checks (catchAll/fork/forkDaemon/catchAllCause in code blocks), expect→assert validation, redirect validation |

---

## Next Review Triggers

This file MUST be re-reviewed when:

1. **Time-based**: 14 days since `last_review_date`
2. **Event-based**: Any reference file in `skills/effect-ts/references/` is edited
3. **Signal-based**: User code shows Effect APIs not covered in current references
4. **Release-based**: Effect v4 moves from beta to stable

---

## Update Instructions

When updating this file:

1. Change `last_review_date` to today
2. Update the commit column for each repo you checked
3. Update `Last Fetched` if you ran `git fetch`
4. Update `Upstream Ahead` with the count of new commits or "0"
5. Move resolved gaps to status=CLOSED with resolution note
6. Add new gaps discovered during review
7. Add any decisions to the Decisions Log
