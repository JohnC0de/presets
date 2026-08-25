import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

const ALLOWED_TYPEOF_QUERIES = new Set([
  "setTimeout",
  "setInterval",
  "setImmediate",
  "window.setTimeout",
  "window.setInterval",
  "window.setImmediate",
  "globalThis.setTimeout",
  "globalThis.setInterval",
  "globalThis.setImmediate",
  "global.setTimeout",
  "global.setInterval",
  "global.setImmediate",
])

function typeReferenceName(node: ESTree.TSTypeReference): string | null {
  return node.typeName.type === "Identifier" ? node.typeName.name : null
}

function typeNamePath(node: ESTree.Node): string | null {
  if (node.type === "Identifier") return node.name
  if (node.type === "ThisExpression") return "this"
  if (node.type !== "TSQualifiedName") return null
  const left = typeNamePath(node.left)
  return left === null ? null : `${left}.${node.right.name}`
}

function typeofQueryPath(type: ESTree.TSType): string | null {
  if (type.type !== "TSTypeQuery") return null
  return typeNamePath(type.exprName)
}

function isAllowedReturnType(node: ESTree.TSTypeReference): boolean {
  const argument = node.typeArguments?.params[0]
  if (argument === undefined) return false
  const path = typeofQueryPath(argument)
  if (path !== null && ALLOWED_TYPEOF_QUERIES.has(path)) return true
  return (
    argument.type === "TSTypeQuery" &&
    argument.typeArguments !== null &&
    argument.typeArguments !== undefined
  )
}

/** Ban `ReturnType<typeof localFn>` — name the owner type. */
export const noReturnTypeUtilityRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow ReturnType of a concrete function. Name the type at the owner module. Timer handles and generic typeof applications are allowed.",
    },
    messages: {
      returnType:
        "Do not publish a contract as `ReturnType<...>`. Export a named type from the module that owns the value.",
    },
  },
  createOnce(context) {
    return {
      TSTypeReference(node) {
        if (typeReferenceName(node) !== "ReturnType" || isAllowedReturnType(node)) return
        context.report({ node, messageId: "returnType" })
      },
    }
  },
})
