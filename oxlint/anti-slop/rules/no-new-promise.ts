import { defineRule } from "@oxlint/plugins"

/** Ban `new Promise(executor)` — use `Promise.withResolvers()`. */
export const noNewPromiseRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the Promise constructor executor form; use Promise.withResolvers().",
    },
    messages: {
      newPromise:
        "Use `Promise.withResolvers()` instead of `new Promise((resolve, reject) => ...)`. Keep the executor only when an API requires that callback shape.",
    },
  },
  createOnce(context) {
    return {
      NewExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "Promise") return
        context.report({ node, messageId: "newPromise" })
      },
    }
  },
})
