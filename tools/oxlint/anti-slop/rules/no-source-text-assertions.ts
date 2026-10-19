import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"
import { filenameOf, isTestPath } from "../shared/filename.ts"

const SOURCE_PROPS = new Set(["innerHTML", "outerHTML", "outerText"])
const SOURCE_IDENTIFIERS = new Set([
  "sourceText",
  "rawSource",
  "fileContents",
  "astSource",
  "htmlSource",
])
const SOURCE_MATCHERS = new Set(["toHaveHTML", "toMatchHTML"])

function propertyName(node: ESTree.MemberExpression): string | null {
  if (node.computed) {
    return node.property.type === "Literal" && typeof node.property.value === "string"
      ? node.property.value
      : null
  }
  return node.property.type === "Identifier" ? node.property.name : null
}

function isExpectCall(node: ESTree.Node): boolean {
  return (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    node.callee.name === "expect"
  )
}

function expectArgument(node: ESTree.Node): ESTree.Expression | null {
  let current: ESTree.Node | null = node
  while (current !== null && current.type !== "Program") {
    if (current.type === "CallExpression" && isExpectCall(current)) {
      const first = current.arguments[0]
      if (first === undefined || first.type === "SpreadElement") return null
      return first
    }
    current = current.parent
  }
  return null
}

function isSourceSubject(node: ESTree.Expression): boolean {
  if (node.type === "Identifier") return SOURCE_IDENTIFIERS.has(node.name)
  if (node.type !== "MemberExpression") return false
  const name = propertyName(node)
  if (name !== null && SOURCE_PROPS.has(name)) return true
  if (name === "getText") return true
  return false
}

/** Ban assertions against HTML/source dumps instead of observable behavior. */
export const noSourceTextAssertionsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow tests that assert on innerHTML, outerHTML, source dumps, or HTML matchers.",
    },
    messages: {
      sourceText:
        "Do not assert on source/HTML dumps. Query by role/name and assert on behavior, not `innerHTML`/`outerHTML`/`getText()`.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isTestPath(filenameOf(context))) return
        if (node.callee.type !== "MemberExpression") return
        const matcher = propertyName(node.callee)
        if (matcher !== null && SOURCE_MATCHERS.has(matcher)) {
          context.report({ node, messageId: "sourceText" })
          return
        }
        const argument = expectArgument(node)
        if (argument !== null && isSourceSubject(argument)) {
          context.report({ node, messageId: "sourceText" })
        }
      },
      MemberExpression(node) {
        if (!isTestPath(filenameOf(context))) return
        if (!isExpectCall(node.parent)) return
        if (node.parent.arguments[0] !== node) return
        if (isSourceSubject(node)) {
          context.report({ node, messageId: "sourceText" })
        }
      },
    }
  },
})
