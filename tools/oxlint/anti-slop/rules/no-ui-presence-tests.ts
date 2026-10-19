import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"
import { filenameOf, isTestPath } from "../shared/filename.ts"

const PRESENCE_MATCHERS = new Set(["toBeInTheDocument", "toBeVisible", "toBeEmptyDOMElement"])

function propertyName(node: ESTree.MemberExpression): string | null {
  if (node.computed) {
    return node.property.type === "Literal" && typeof node.property.value === "string"
      ? node.property.value
      : null
  }
  return node.property.type === "Identifier" ? node.property.name : null
}

function chainRoot(node: ESTree.Expression): ESTree.Node {
  let current: ESTree.Node = node
  while (current.type === "MemberExpression") current = current.object
  while (current.type === "CallExpression") {
    if (current.callee.type === "MemberExpression") {
      current = current.callee.object
      continue
    }
    break
  }
  return current
}

function isExpectCall(node: ESTree.Node): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "expect"
  )
}

/** Ban tests that only prove a node exists instead of asserting user-visible behavior. */
export const noUiPresenceTestsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow Testing Library presence matchers (`toBeInTheDocument`, `toBeVisible`) as the assertion.",
    },
    messages: {
      presence:
        "`{{matcher}}` only proves presence. Assert on the text, value, or action the user cares about.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isTestPath(filenameOf(context))) return
        if (node.callee.type !== "MemberExpression") return
        const matcher = propertyName(node.callee)
        if (matcher === null || !PRESENCE_MATCHERS.has(matcher)) return
        if (!isExpectCall(chainRoot(node.callee.object))) return
        context.report({
          node,
          messageId: "presence",
          data: { matcher },
        })
      },
    }
  },
})
