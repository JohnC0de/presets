import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"

const ALLOWED_RECEIVERS = new Set([
  "abort",
  "arrayBuffer",
  "blob",
  "bytes",
  "cancel",
  "close",
  "formData",
  "json",
  "text",
])

function isLiteralish(node: ESTree.Expression | ESTree.Statement | null): boolean {
  if (node === null) return true
  if (node.type === "Literal") return true
  if (node.type === "Identifier" && (node.name === "undefined" || node.name === "null")) return true
  if (node.type === "ArrayExpression" && node.elements.length === 0) return true
  if (node.type === "ObjectExpression" && node.properties.length === 0) return true
  if (
    node.type === "TemplateLiteral" &&
    node.expressions.length === 0 &&
    (node.quasis[0]?.value.cooked ?? "") === ""
  ) {
    return true
  }
  if (node.type === "BlockStatement") {
    return node.body.length === 0 || (node.body.length === 1 && isLiteralish(node.body[0] ?? null))
  }
  if (node.type === "ExpressionStatement") return isLiteralish(node.expression)
  if (node.type === "ReturnStatement") return isLiteralish(node.argument)
  return false
}

function catchCallbackIsLiteral(node: ESTree.Expression): boolean {
  if (node.type === "ArrowFunctionExpression") {
    if (node.body.type !== "BlockStatement") return isLiteralish(node.body)
    return isLiteralish(node.body)
  }
  if (node.type === "FunctionExpression") return isLiteralish(node.body)
  return false
}

function receiverMethod(callee: ESTree.MemberExpression): string | null {
  const object = callee.object
  if (object.type !== "CallExpression") return null
  if (object.callee.type !== "MemberExpression") return null
  const property = object.callee.property
  if (object.callee.computed) {
    return property.type === "Literal" && typeof property.value === "string" ? property.value : null
  }
  return property.type === "Identifier" ? property.name : null
}

/** Ban `.catch(() => null)`-style handlers that turn failures into empty success. */
export const noSwallowedRejectionRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `.catch(() => <literal>)` except on body-read and teardown methods.",
    },
    messages: {
      swallowed:
        "This `.catch` turns a rejection into an empty success. Handle the error, or use a named empty-body allowlist (json/text/cancel/close).",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression" || node.callee.computed) return
        if (node.callee.property.type !== "Identifier" || node.callee.property.name !== "catch")
          return
        const callback = node.arguments[0]
        if (callback === undefined || callback.type === "SpreadElement") return
        if (!catchCallbackIsLiteral(callback)) return
        const method = receiverMethod(node.callee)
        if (method !== null && ALLOWED_RECEIVERS.has(method)) return
        context.report({ node, messageId: "swallowed" })
      },
    }
  },
})
