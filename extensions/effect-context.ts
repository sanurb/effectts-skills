import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { StringEnum } from "@mariozechner/pi-ai";
import * as fs from "node:fs";
import * as path from "node:path";

// Reference doc topics and their files
const TOPICS: Record<string, { file: string; label: string }> = {
  services: { file: "services.md", label: "Services" },
  layers: { file: "layers.md", label: "Layers" },
  "data-modeling": { file: "data-modeling.md", label: "Data Modeling" },
  schema: { file: "schema-decisions.md", label: "Schema Decisions" },
  errors: { file: "error-handling.md", label: "Error Handling" },
  testing: { file: "testing.md", label: "Testing" },
  http: { file: "http-clients.md", label: "HTTP Clients" },
  cli: { file: "cli.md", label: "CLI" },
  config: { file: "config.md", label: "Config" },
  concurrency: { file: "concurrency.md", label: "Concurrency" },
  processes: { file: "processes.md", label: "Processes & Scopes" },
  setup: { file: "setup.md", label: "Project Setup" },
  status: { file: "effect-setup-status.md", label: "Reference Status" },
};

// Pattern detection for smart injection — loaded from shared/patterns.json (single source of truth)
interface PatternEntry { id: string; patterns: string[]; ref: string; label: string }
function loadSharedPatterns(extensionFile: string): Array<{ id: string; match: RegExp; topic: string }> {
  const sharedPath = path.resolve(path.dirname(extensionFile), "..", "shared", "patterns.json");
  try {
    const raw: PatternEntry[] = JSON.parse(fs.readFileSync(sharedPath, "utf-8"));
    return raw.map((p) => ({
      id: p.id,
      match: new RegExp(p.patterns.join("|")),
      topic: p.id,
    }));
  } catch {
    return [];
  }
}
let PATTERNS: Array<{ id: string; match: RegExp; topic: string }> = [];

function getSkillDir(extensionFile: string): string {
  // extensionFile is this file. Skill is at ../skills/effect-ts/
  return path.resolve(path.dirname(extensionFile), "..", "skills", "effect-ts");
}

function loadReference(skillDir: string, topic: string): string | null {
  const meta = TOPICS[topic];
  if (!meta) return null;
  const refPath = path.join(skillDir, "references", meta.file);
  try {
    return fs.readFileSync(refPath, "utf-8");
  } catch {
    return null;
  }
}

function detectEffectProject(cwd: string): boolean {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf-8"));
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
    return "effect" in allDeps || "@effect/platform" in allDeps || "@effect/cli" in allDeps;
  } catch {
    return false;
  }
}

function detectPatterns(content: string): string[] {
  const detected = new Set<string>();
  for (const { match, topic } of PATTERNS) {
    if (match.test(content)) {
      detected.add(topic);
    }
  }
  return [...detected];
}

export default function (pi: ExtensionAPI) {
  const skillDir = getSkillDir(__filename);
  PATTERNS = loadSharedPatterns(__filename);
  let isEffectProject = false;
  const injectedTopics = new Set<string>();

  // --- Session start: detect Effect project ---
  pi.on("session_start", async (_event, ctx) => {
    isEffectProject = detectEffectProject(ctx.cwd);
    if (isEffectProject) {
      ctx.ui.setStatus("effect", "Effect v4");
    }
  });

  // --- Smart context injection on file reads ---
  pi.on("tool_result", async (event, ctx) => {
    if (!isEffectProject) return;
    if (event.toolName !== "read") return;

    // Get the file content from the result
    const textContent = event.content
      ?.filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");

    if (!textContent || textContent.length < 50) return;

    // Detect Effect patterns
    const topics = detectPatterns(textContent);
    const newTopics = topics.filter((t) => !injectedTopics.has(t));

    if (newTopics.length === 0) return;

    // Inject up to 2 reference docs per read, max 1 total injection
    const toInject = newTopics.slice(0, 1);
    const hints: string[] = [];

    for (const topic of toInject) {
      const meta = TOPICS[topic];
      if (meta) {
        injectedTopics.add(topic);
        hints.push(`[Effect patterns detected: ${meta.label}. Use /effect:docs ${topic} for full reference.]`);
      }
    }

    if (hints.length > 0) {
      return {
        content: [
          ...event.content,
          { type: "text", text: "\n" + hints.join("\n") },
        ],
      };
    }
  });

  // --- /effect:docs <topic> command ---
  pi.registerCommand("effect:docs", {
    description: "Load Effect reference docs. Topics: " + Object.keys(TOPICS).join(", "),
    handler: async (args, ctx) => {
      const topic = args?.trim().toLowerCase();

      if (!topic) {
        const list = Object.entries(TOPICS)
          .map(([key, { label }]) => `  ${key.padEnd(14)} ${label}`)
          .join("\n");
        ctx.ui.notify(`Available topics:\n${list}`, "info");
        return;
      }

      const content = loadReference(skillDir, topic);
      if (!content) {
        ctx.ui.notify(`Unknown topic: ${topic}. Available: ${Object.keys(TOPICS).join(", ")}`, "error");
        return;
      }

      const meta = TOPICS[topic]!;
      pi.sendMessage(
        {
          customType: "effect-docs",
          content: `# Effect Reference: ${meta.label}\n\n${content}`,
          display: true,
        },
        { triggerTurn: false }
      );
      ctx.ui.notify(`Loaded: ${meta.label}`, "success");
      injectedTopics.add(topic);
    },
  });

  // --- /effect:service command ---
  pi.registerCommand("effect:service", {
    description: "Generate an Effect service scaffold",
    handler: async (args, ctx) => {
      const name = args?.trim() || "MyService";
      const scaffold = generateServiceScaffold(name);
      pi.sendMessage(
        {
          customType: "effect-scaffold",
          content: `Here is a scaffold for the \`${name}\` service. Adapt it to your needs:\n\n\`\`\`typescript\n${scaffold}\n\`\`\``,
          display: true,
        },
        { triggerTurn: false }
      );
      ctx.ui.notify(`Service scaffold: ${name}`, "success");
    },
  });

  // --- /effect:test command ---
  pi.registerCommand("effect:test", {
    description: "Generate an Effect test scaffold",
    handler: async (args, ctx) => {
      const name = args?.trim() || "MyService";
      const scaffold = generateTestScaffold(name);
      pi.sendMessage(
        {
          customType: "effect-scaffold",
          content: `Here is a test scaffold for \`${name}\`. Adapt it to your needs:\n\n\`\`\`typescript\n${scaffold}\n\`\`\``,
          display: true,
        },
        { triggerTurn: false }
      );
      ctx.ui.notify(`Test scaffold: ${name}`, "success");
    },
  });

  // --- effect_scaffold tool (LLM-callable) ---
  pi.registerTool({
    name: "effect_scaffold",
    label: "Effect Scaffold",
    description:
      "Generate idiomatic Effect v4 boilerplate. Creates service, schema, error, or test scaffolds following effect-solutions best practices.",
    promptSnippet: "Generate Effect v4 boilerplate (service, schema, error, test)",
    parameters: Type.Object({
      type: StringEnum(["service", "schema", "error", "test"] as const, {
        description: "Type of scaffold to generate",
      }),
      name: Type.String({ description: "Name for the generated type/service (PascalCase)" }),
    }),
    async execute(_toolCallId, params) {
      let scaffold: string;
      switch (params.type) {
        case "service":
          scaffold = generateServiceScaffold(params.name);
          break;
        case "schema":
          scaffold = generateSchemaScaffold(params.name);
          break;
        case "error":
          scaffold = generateErrorScaffold(params.name);
          break;
        case "test":
          scaffold = generateTestScaffold(params.name);
          break;
      }
      return {
        content: [{ type: "text", text: scaffold }],
        details: { type: params.type, name: params.name },
      };
    },
  });

  // --- effect_docs tool (LLM-callable) ---
  pi.registerTool({
    name: "effect_docs",
    label: "Effect Docs",
    description:
      "Load Effect v4 reference documentation on a specific topic. Returns the full reference content for the requested topic.",
    promptSnippet: "Load Effect v4 reference docs (services, schema, errors, testing, http, cli, config, processes, setup)",
    parameters: Type.Object({
      topic: StringEnum(Object.keys(TOPICS) as [string, ...string[]], {
        description: "Topic to load",
      }),
    }),
    async execute(_toolCallId, params) {
      const content = loadReference(skillDir, params.topic);
      if (!content) {
        return {
          content: [{ type: "text", text: `Unknown topic: ${params.topic}` }],
          details: {},
        };
      }
      injectedTopics.add(params.topic);
      return {
        content: [{ type: "text", text: content }],
        details: { topic: params.topic, label: TOPICS[params.topic]?.label },
      };
    },
  });
}

// --- Scaffold generators ---

function generateServiceScaffold(name: string): string {
  const prefix = name.slice(0, 3).toLowerCase();
  return `import { Effect, Layer, Schema, ServiceMap } from "effect"

const ${name}Id = Schema.String.pipe(
  Schema.pattern(/^${prefix}_[a-z0-9]{12}$/),
  Schema.brand("${name}Id")
)
type ${name}Id = typeof ${name}Id.Type

class ${name}NotFoundError extends Schema.TaggedErrorClass<${name}NotFoundError>()(
  "${name}NotFoundError",
  { id: ${name}Id }
) {}

class ${name} extends ServiceMap.Service<${name}, {
  findById(id: ${name}Id): Effect.Effect<unknown, ${name}NotFoundError>
  create(data: unknown): Effect.Effect<unknown>
}>()(
  "myapp/${name.toLowerCase()}/${name}"
) {
  static readonly layer = Layer.effect(
    ${name},
    Effect.gen(function* () {
      const findById = Effect.fn("${name}.findById")(function* (id: ${name}Id) {
        // TODO: implement
      })

      const create = Effect.fn("${name}.create")(function* (data: unknown) {
        // TODO: implement
      })

      return ${name}.of({ findById, create })
    })
  )

  static readonly testLayer = Layer.sync(${name}, () => {
    const store = new Map<${name}Id, unknown>()
    return ${name}.of({
      findById: (id) =>
        Effect.fromNullable(store.get(id)).pipe(
          Effect.mapError(() => new ${name}NotFoundError({ id }))
        ),
      create: (data) => Effect.sync(() => {
        // TODO: generate ID + store
        return data
      }),
    })
  })
}

export { ${name}, ${name}Id, ${name}NotFoundError }`;
}

function generateSchemaScaffold(name: string): string {
  const prefix = name.slice(0, 3).toLowerCase();
  return `import { Schema } from "effect"

const ${name}Id = Schema.String.pipe(
  Schema.pattern(/^${prefix}_[a-z0-9]{12}$/),
  Schema.brand("${name}Id")
)
type ${name}Id = typeof ${name}Id.Type

class ${name} extends Schema.Class<${name}>("${name}")({
  id: ${name}Id,
  createdAt: Schema.DateTimeUtcFromSelf,
  // TODO: add domain fields
}) {}

const ${name}FromJson = Schema.fromJsonString(${name})

export { ${name}, ${name}Id, ${name}FromJson }`;
}

function generateErrorScaffold(name: string): string {
  return `import { Schema } from "effect"

class ${name}NotFoundError extends Schema.TaggedErrorClass<${name}NotFoundError>()(
  "${name}NotFoundError",
  {
    id: Schema.String,
  }
) {}

class ${name}ValidationError extends Schema.TaggedErrorClass<${name}ValidationError>()(
  "${name}ValidationError",
  {
    field: Schema.String,
    message: Schema.String,
  }
) {}

class ${name}Error extends Schema.TaggedErrorClass<${name}Error>()(
  "${name}Error",
  {
    cause: Schema.Defect,
  }
) {}`;
}

function generateTestScaffold(name: string): string {
  return `import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { ${name} } from "../src/${name.toLowerCase()}"

describe("${name}", () => {
  it.effect("creates an instance", () =>
    Effect.gen(function* () {
      const svc = yield* ${name}
      const result = yield* svc.create({ /* TODO: provide valid data */ })
      assert.isDefined(result)
    }).pipe(Effect.provide(${name}.testLayer))
  )

  it.effect("finds by id", () =>
    Effect.gen(function* () {
      const svc = yield* ${name}
      const created = yield* svc.create({ /* TODO: provide valid data */ })
      // TODO: extract ID from created, then:
      // const found = yield* svc.findById(id)
      // assert.isDefined(found)
    }).pipe(Effect.provide(${name}.testLayer))
  )

  it.effect("rejects unknown id", () =>
    Effect.gen(function* () {
      const svc = yield* ${name}
      const error = yield* svc.findById(
        /* TODO: provide a nonexistent ID */
      ).pipe(Effect.flip)
      assert.strictEqual(error._tag, "${name}NotFoundError")
    }).pipe(Effect.provide(${name}.testLayer))
  )
})`;
}
