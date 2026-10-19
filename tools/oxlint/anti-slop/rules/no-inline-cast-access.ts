import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion

function isInlineObjectAssertion(node: TypeAssertion): boolean {
  return node.typeAnnotation.type === "TSTypeLiteral"
}

function isImmediatePropertyRead(node: TypeAssertion): boolean {
  let current: ESTree.Node = node
  let parent = node.parent
  while (parent.type === "ParenthesizedExpression" && parent.expression === current) {
    current = parent
    parent = parent.parent
  }
  if (parent.type === "MemberExpression" && parent.object === current) return true
  if (parent.type !== "ChainExpression") return false
  const expression = parent.expression
  return expression.type === "MemberExpression" && expression.object === current
}

/** Ban `(value as { field: T }).field` — fabricate-a-shape-then-read. */
export const noInlineCastAccessRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow asserting an inline object type and immediately reading a property from it.",
    },
    messages: {
      inlineCastAccess:
        "Do not assert an inline object type just to read a field. Parse at the boundary, narrow with `in`/`typeof`, or use a named type that was already validated.",
    },
  },
  createOnce(context) {
    const checkAssertion = (node: TypeAssertion) => {
      if (!isInlineObjectAssertion(node) || !isImmediatePropertyRead(node)) return
      context.report({ node, messageId: "inlineCastAccess" })
    }
    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
    }
  },
})
