import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"

function isFetchCallee(callee: ESTree.Expression): boolean {
  if (callee.type === "Identifier") return callee.name === "fetch"
  if (callee.type !== "MemberExpression") return false
  const property = callee.computed
    ? callee.property.type === "Literal" && callee.property.value === "fetch"
    : callee.property.type === "Identifier" && callee.property.name === "fetch"
  if (!property) return false
  if (callee.object.type !== "Identifier") return false
  return (
    callee.object.name === "window" ||
    callee.object.name === "globalThis" ||
    callee.object.name === "self"
  )
}

function hasSignal(node: ESTree.Expression): boolean {
  if (node.type !== "ObjectExpression") return true
  let sawSpread = false
  for (const property of node.properties) {
    if (property.type === "SpreadElement") {
      sawSpread = true
      continue
    }
    if (property.type !== "Property" || property.computed) continue
    if (property.key.type === "Identifier" && property.key.name === "signal") return true
    if (property.key.type === "Literal" && property.key.value === "signal") return true
  }
  return sawSpread
}

/** Ban `fetch()` without an AbortSignal so hung peers cannot stall the process. */
export const requireFetchTimeoutRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require `fetch(url, { signal })` so every request has a timeout or abort.",
    },
    messages: {
      noSignal:
        "`fetch` needs a `signal` (`AbortSignal.timeout(...)` or a controller). A hung peer otherwise stalls this work forever.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression") return
        if (!isFetchCallee(node.callee)) return
        const options = node.arguments[1]
        if (options === undefined || options.type === "SpreadElement") {
          context.report({ node, messageId: "noSignal" })
          return
        }
        if (options.type === "ObjectExpression" && !hasSignal(options)) {
          context.report({ node, messageId: "noSignal" })
        }
      },
    }
  },
})
