import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

function isEmptyStatementish(statement: ESTree.Statement): boolean {
  if (statement.type === "EmptyStatement") return true
  if (statement.type !== "BlockStatement") return false
  return statement.body.every((inner) => isEmptyStatementish(inner))
}

function isEmptyBranch(node: ESTree.Statement): boolean {
  if (node.type === "IfStatement") {
    if (!isEmptyBranch(node.consequent)) return false
    return node.alternate === null ? true : isEmptyBranch(node.alternate)
  }
  return isEmptyStatementish(node)
}

/** Ban `if (a) {} else if (b) {} else {}` — empty control-flow leftover. */
export const noEmptyIfChainRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow if/else-if/else chains where every branch is an empty block.",
    },
    messages: {
      emptyIfChain:
        "This if/else chain has no statements. Delete it or put the real work in a branch.",
    },
  },
  createOnce(context) {
    return {
      IfStatement(node) {
        const parent = node.parent
        if (parent.type === "IfStatement" && parent.alternate === node) return
        if (node.alternate === null) return
        if (isEmptyBranch(node)) context.report({ node, messageId: "emptyIfChain" })
      },
    }
  },
})
