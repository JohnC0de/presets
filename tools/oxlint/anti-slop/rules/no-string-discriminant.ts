import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

const BOOLEAN_STATE = new Set(["loading", "isLoading", "completed", "success", "hasError"])
const STRING_DISCRIMINANT = new Set(["kind", "status"])

type PropertyNode = ESTree.TSPropertySignature | ESTree.PropertyDefinition

function propertyName(node: PropertyNode): string | null {
  if (node.computed || node.key.type !== "Identifier") return null
  return node.key.name
}

function unwrapType(type: ESTree.TSType): ESTree.TSType {
  let current = type
  while (
    current.type === "TSParenthesizedType" ||
    (current.type === "TSTypeOperator" && current.operator === "readonly")
  ) {
    current = current.typeAnnotation
  }
  return current
}

function annotation(node: PropertyNode): ESTree.TSType | null {
  return node.typeAnnotation?.typeAnnotation ?? null
}

function isBoolean(type: ESTree.TSType): boolean {
  return unwrapType(type).type === "TSBooleanKeyword"
}

function isBareString(type: ESTree.TSType): boolean {
  return unwrapType(type).type === "TSStringKeyword"
}

/** Ban boolean state bags and `kind`/`status: string` — use a literal discriminant. */
export const noStringDiscriminantRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow optional-state booleans and string discriminants on type properties. Use a literal-tagged union.",
    },
    messages: {
      booleanState:
        "Property `{{name}}: boolean` is a state bag. Model variants as a discriminated union with a literal tag.",
      stringDiscriminant:
        'Property `{{name}}: string` is not a discriminant. Use a literal union (`"func" | "signal"`) or a named alias of one.',
    },
  },
  createOnce(context) {
    const checkProperty = (node: PropertyNode) => {
      const name = propertyName(node)
      const type = annotation(node)
      if (name === null || type === null) return
      if (BOOLEAN_STATE.has(name) && isBoolean(type)) {
        context.report({ node: node.key, messageId: "booleanState", data: { name } })
        return
      }
      if (STRING_DISCRIMINANT.has(name) && isBareString(type)) {
        context.report({ node: node.key, messageId: "stringDiscriminant", data: { name } })
      }
    }

    return {
      TSPropertySignature: checkProperty,
      PropertyDefinition: checkProperty,
    }
  },
})
