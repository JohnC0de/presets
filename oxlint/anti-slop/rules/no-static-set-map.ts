import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

function unwrapExpression(expression: ESTree.Expression): ESTree.Expression {
  let current = expression
  while (
    current.type === "ParenthesizedExpression" ||
    current.type === "TSAsExpression" ||
    current.type === "TSTypeAssertion" ||
    current.type === "TSNonNullExpression" ||
    current.type === "TSSatisfiesExpression"
  ) {
    current = current.expression
  }
  return current
}

function isLiteralKey(node: ESTree.Expression): boolean {
  const unwrapped = unwrapExpression(node)
  return (
    (unwrapped.type === "Literal" &&
      (typeof unwrapped.value === "string" || typeof unwrapped.value === "number")) ||
    (unwrapped.type === "TemplateLiteral" && unwrapped.expressions.length === 0)
  )
}

function isStaticMapEntry(node: ESTree.Expression): boolean {
  const unwrapped = unwrapExpression(node)
  if (unwrapped.type !== "ArrayExpression" || unwrapped.elements.length !== 2) return false
  const key = unwrapped.elements[0]
  return key !== null && key.type !== "SpreadElement" && isLiteralKey(key)
}

function isStaticSetArgument(node: ESTree.Expression): boolean {
  const unwrapped = unwrapExpression(node)
  if (unwrapped.type !== "ArrayExpression" || unwrapped.elements.length === 0) return false
  return unwrapped.elements.every(
    (element) => element !== null && element.type !== "SpreadElement" && isLiteralKey(element),
  )
}

function isStaticMapArgument(node: ESTree.Expression): boolean {
  const unwrapped = unwrapExpression(node)
  if (unwrapped.type !== "ArrayExpression" || unwrapped.elements.length === 0) return false
  return unwrapped.elements.every(
    (element) => element !== null && element.type !== "SpreadElement" && isStaticMapEntry(element),
  )
}

function collectionName(callee: ESTree.Expression): "Set" | "Map" | null {
  return callee.type === "Identifier" && (callee.name === "Set" || callee.name === "Map")
    ? callee.name
    : null
}

/** Ban `new Set`/`new Map` of a static literal table — use `Record` instead. */
export const noStaticSetMapRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Set/Map constructed from a static literal table; use Record for fixed string/number keys.",
    },
    messages: {
      staticCollection:
        "This `{{name}}` is a static literal table. Use `Record<K, V>` / `Record<K, true>` and keep Set/Map for runtime insertion, non-string keys, or iterator APIs.",
    },
  },
  createOnce(context) {
    return {
      NewExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression") return
        const name = collectionName(node.callee)
        if (name === null) return
        const argument = node.arguments[0]
        if (argument === undefined || argument.type === "SpreadElement") return
        const unwrappedArgument = unwrapExpression(argument)
        const staticTable =
          name === "Set"
            ? isStaticSetArgument(unwrappedArgument)
            : isStaticMapArgument(unwrappedArgument)
        if (!staticTable) return
        context.report({ node, messageId: "staticCollection", data: { name } })
      },
    }
  },
})
