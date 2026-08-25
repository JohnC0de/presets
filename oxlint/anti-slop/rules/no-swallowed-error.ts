import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

function isConsoleCall(statement: ESTree.Statement): boolean {
  if (statement.type !== "ExpressionStatement") return false
  const expression = statement.expression
  if (expression.type !== "CallExpression") return false
  const callee = expression.callee
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "console" &&
    callee.property.type === "Identifier"
  )
}

/** Ban `catch (e) { console.error(e) }` with no throw/return — log-and-forget AI catch. */
export const noSwallowedErrorRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow catch clauses whose body only logs to console without rethrowing or returning.",
    },
    messages: {
      swallowed:
        "This catch only logs. Rethrow, return a typed error, or handle a named case — do not swallow.",
    },
  },
  createOnce(context) {
    return {
      CatchClause(node) {
        const statements = node.body.body
        if (statements.length === 0) return
        if (!statements.every((statement) => isConsoleCall(statement))) return
        context.report({ node, messageId: "swallowed" })
      },
    }
  },
})
