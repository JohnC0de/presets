import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"
import { filenameOf, isTestPath } from "../shared/filename.ts"

const THROW_MATCHERS = new Set(["toThrow", "toThrowError"])

function propertyName(node: ESTree.MemberExpression): string | null {
  if (node.computed || node.property.type !== "Identifier") return null
  return node.property.name
}

function describeChain(start: ESTree.Expression): { negated: boolean; rootedAtExpect: boolean } {
  let current: ESTree.Node = start
  let negated = false
  while (current.type === "MemberExpression") {
    if (propertyName(current) === "not") negated = true
    current = current.object
  }
  const rootedAtExpect =
    current.type === "CallExpression" &&
    current.callee.type === "Identifier" &&
    current.callee.name === "expect"
  return { negated, rootedAtExpect }
}

/** Ban `toThrow()` with no argument — it passes for any thrown value. */
export const noVacuousThrowAssertionRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `expect(...).toThrow()` with no argument; name the error so an unrelated throw fails the test.",
    },
    messages: {
      vacuousThrow:
        "`{{matcher}}()` with no argument passes for any thrown value. Name the expected error (message, regex, class, or `{ message }`).",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isTestPath(filenameOf(context))) return
        if (node.arguments.length > 0) return
        if (node.callee.type !== "MemberExpression") return
        const matcher = propertyName(node.callee)
        if (matcher === null || !THROW_MATCHERS.has(matcher)) return
        const { negated, rootedAtExpect } = describeChain(node.callee.object)
        if (negated || !rootedAtExpect) return
        context.report({ node, messageId: "vacuousThrow", data: { matcher } })
      },
    }
  },
})
