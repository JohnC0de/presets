import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"
import { filenameOf, isTestPath } from "../shared/filename.ts"

const SKIP_CALLEES = new Set(["xit", "xtest", "xdescribe"])
const TEST_CALLEES = new Set(["it", "test", "describe"])
const SKIP_PROPS = new Set(["skip", "skipIf"])
const REASON = /(?:#\d+|FIXME|TODO|flaky|reason:|skip:)/iu

function calleeName(callee: ESTree.Expression | ESTree.Super): string | null {
  if (callee.type === "Identifier") return callee.name
  if (callee.type !== "MemberExpression" || callee.computed) return null
  if (callee.object.type !== "Identifier" || callee.property.type !== "Identifier") return null
  return `${callee.object.name}.${callee.property.name}`
}

function isTestCallName(name: string): boolean {
  if (TEST_CALLEES.has(name) || SKIP_CALLEES.has(name)) return true
  const dot = name.indexOf(".")
  if (dot === -1) return false
  return TEST_CALLEES.has(name.slice(0, dot))
}

function skipKind(name: string): "skip" | "skipIf" | null {
  if (SKIP_CALLEES.has(name)) return "skip"
  const property = name.split(".").at(-1)
  if (property !== undefined && SKIP_PROPS.has(property)) {
    return property === "skipIf" ? "skipIf" : "skip"
  }
  return null
}

function titleHasReason(node: ESTree.CallExpression): boolean {
  const first = node.arguments[0]
  if (first === undefined) return false
  if (first.type === "Literal" && typeof first.value === "string") return REASON.test(first.value)
  return false
}

function isLiteralTrue(node: ESTree.Expression): boolean {
  return node.type === "Literal" && node.value === true
}

function unwrapBlock(statement: ESTree.Statement): ESTree.Statement {
  if (statement.type === "BlockStatement" && statement.body.length === 1) {
    const only = statement.body[0]
    if (only !== undefined) return only
  }
  return statement
}

function isBareReturn(statement: ESTree.Statement): boolean {
  const inner = unwrapBlock(statement)
  return inner.type === "ReturnStatement" && inner.argument === null
}

function insideTestCallback(node: ESTree.Node): boolean {
  let current: ESTree.Node | null = node.parent
  while (current !== null && current.type !== "Program") {
    if (current.type === "CallExpression") {
      const name = calleeName(current.callee)
      if (name !== null && isTestCallName(name)) return true
    }
    current = current.parent
  }
  return false
}

/** Ban skipped tests without a reason, and tests that return early instead of failing. */
export const noSilentSkipRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow skipped tests without a reason, constant skipIf(true), and early returns that swallow a failing test.",
    },
    messages: {
      skipWithoutReason:
        "Do not skip a test without a reason in the title (`#issue`, `FIXME`, `flaky`, `reason:`). Fix it or delete it.",
      skipIfTrue:
        "`skipIf(true)` is a silent skip. Delete the test or name the reason in the title.",
      earlyReturn:
        "This test returns early when a condition fails, so a missing UI/state becomes a pass. Assert the condition; do not skip it.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isTestPath(filenameOf(context))) return
        const name = calleeName(node.callee)
        if (name === null) return
        const kind = skipKind(name)
        if (kind === null) return
        if (kind === "skipIf") {
          const first = node.arguments[0]
          if (first !== undefined && first.type !== "SpreadElement" && isLiteralTrue(first)) {
            context.report({ node, messageId: "skipIfTrue" })
            return
          }
        }
        if (!titleHasReason(node)) {
          context.report({ node, messageId: "skipWithoutReason" })
        }
      },
      IfStatement(node) {
        if (!isTestPath(filenameOf(context))) return
        if (!insideTestCallback(node)) return
        if (node.alternate !== null) return
        if (!isBareReturn(node.consequent)) return
        context.report({ node, messageId: "earlyReturn" })
      },
    }
  },
})
