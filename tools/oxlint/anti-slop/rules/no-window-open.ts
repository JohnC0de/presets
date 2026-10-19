import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"

const HOSTS = new Set(["window", "globalThis", "self"])

function isGlobalOpen(
  sourceCode: { isGlobalReference: (node: ESTree.Identifier) => boolean },
  callee: ESTree.Expression,
): boolean {
  if (callee.type === "Identifier") {
    return callee.name === "open" && sourceCode.isGlobalReference(callee)
  }
  if (callee.type !== "MemberExpression") return false
  const property = callee.computed
    ? callee.property.type === "Literal" && callee.property.value === "open"
    : callee.property.type === "Identifier" && callee.property.name === "open"
  if (!property) return false
  if (callee.object.type === "Identifier") return HOSTS.has(callee.object.name)
  if (callee.object.type === "MemberExpression" && !callee.object.computed) {
    return (
      callee.object.property.type === "Identifier" &&
      callee.object.property.name === "window" &&
      callee.object.object.type === "Identifier" &&
      HOSTS.has(callee.object.object.name)
    )
  }
  return false
}

/** Ban `window.open` / global `open()`; popups need a sanctioned helper. */
export const noWindowOpenRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `window.open` and global `open()`; opener isolation belongs in one helper.",
    },
    messages: {
      windowOpen:
        "Do not call `window.open` / `open()` directly. Use a helper that sets `noopener` and sanitizes the URL.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression") return
        if (isGlobalOpen(context.sourceCode, node.callee)) {
          context.report({ node, messageId: "windowOpen" })
        }
      },
    }
  },
})
