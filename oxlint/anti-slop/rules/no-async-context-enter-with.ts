import { defineRule } from "@oxlint/plugins"

/** Ban `AsyncLocalStorage.enterWith()` — it mutates the ambient frame with no restore. */
export const noAsyncContextEnterWithRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `AsyncLocalStorage.enterWith()`; scope async context with `run(...)` so it cannot leak into later work.",
    },
    messages: {
      enterWith:
        "Do not use `enterWith()`. It mutates the ambient async context with no restore, so later work can inherit the wrong store. Use `run(store, fn)`.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed) return
        if (callee.property.type !== "Identifier" || callee.property.name !== "enterWith") return
        context.report({ node, messageId: "enterWith" })
      },
    }
  },
})
