import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

function booleanReturn(statement: ESTree.Statement): boolean | null {
  const inner =
    statement.type === "BlockStatement" && statement.body.length === 1
      ? statement.body[0]
      : statement
  if (inner === undefined || inner.type !== "ReturnStatement") return null
  const argument = inner.argument
  if (argument === null || argument.type !== "Literal" || typeof argument.value !== "boolean") {
    return null
  }
  return argument.value
}

/** Ban `if (x) return true; else return false` — return the condition. */
export const noBooleanIfReturnRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow if/else that only returns opposite boolean literals; return the condition instead.",
    },
    messages: {
      booleanIfReturn:
        "Return the condition instead of `if (x) return true; else return false`. Invert with `!` when needed.",
    },
  },
  createOnce(context) {
    return {
      IfStatement(node) {
        if (node.alternate === null) return
        const thenValue = booleanReturn(node.consequent)
        const elseValue = booleanReturn(node.alternate)
        if (thenValue === null || elseValue === null || thenValue === elseValue) return
        context.report({ node, messageId: "booleanIfReturn" })
      },
    }
  },
})
