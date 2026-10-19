import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"

const DEFAULT_CALLS = new Set([
  "drizzle",
  "betterAuth",
  "createRedisClient",
  "postgres",
  "createClient",
])
const DEFAULT_NEWS = new Set([
  "RedisClient",
  "Queue",
  "Worker",
  "S3Client",
  "SQL",
  "PrismaClient",
  "MongoClient",
])

function isFunctionNode(node: ESTree.Node): boolean {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression"
  )
}

function isDeferred(node: ESTree.Node): boolean {
  let current: ESTree.Node | null = node.parent
  while (current !== null && current.type !== "Program") {
    if (isFunctionNode(current)) return true
    if (current.type === "PropertyDefinition" && current.static !== true) return true
    current = current.parent
  }
  return false
}

function identifierName(node: ESTree.Expression | ESTree.Super): string | null {
  return node.type === "Identifier" ? node.name : null
}

function extraNames(options: unknown, key: "callNames" | "newNames"): string[] {
  if (typeof options !== "object" || options === null || Array.isArray(options)) return []
  const value = options[key]
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : []
}

/** Ban constructing known side-effecting clients at module evaluation time. */
export const noEagerSingletonRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow constructing DB/auth/queue/S3 clients at module top level; wrap them in a lazy getter.",
    },
    messages: {
      eager:
        "`{{name}}(...)` at module top level constructs a side-effecting singleton at import time. Wrap it in a lazy `getX()` that runs on first use.",
    },
    schema: [
      {
        type: "object",
        properties: {
          callNames: { type: "array", items: { type: "string" } },
          newNames: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (isDeferred(node)) return
        const name = identifierName(node.callee)
        if (name === null) return
        const extra = extraNames(context.options?.[0], "callNames")
        if (!DEFAULT_CALLS.has(name) && !extra.includes(name)) return
        context.report({ node, messageId: "eager", data: { name } })
      },
      NewExpression(node) {
        if (isDeferred(node)) return
        const name = identifierName(node.callee)
        if (name === null) return
        const extra = extraNames(context.options?.[0], "newNames")
        if (!DEFAULT_NEWS.has(name) && !extra.includes(name)) return
        context.report({ node, messageId: "eager", data: { name: `new ${name}` } })
      },
    }
  },
})
