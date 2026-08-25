import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"

function isTypeName(node: ESTree.TSType, name: string): node is ESTree.TSTypeReference {
  return (
    node.type === "TSTypeReference" &&
    node.typeName.type === "Identifier" &&
    node.typeName.name === name
  )
}

function unwrapReadonly(typeNode: ESTree.TSType): ESTree.TSType {
  if (!isTypeName(typeNode, "Readonly")) return typeNode
  const inner = typeNode.typeArguments?.params[0]
  return inner ?? typeNode
}

function isPartialRecordType(typeNode: ESTree.TSType): boolean {
  const outer = unwrapReadonly(typeNode)
  if (!isTypeName(outer, "Partial")) return false
  const inner = unwrapReadonly(outer.typeArguments?.params[0] ?? outer)
  return isTypeName(inner, "Record")
}

function isObjectLiteralExpression(node: ESTree.Expression): boolean {
  if (node.type === "ObjectExpression") return true
  if (node.type !== "TSAsExpression") return false
  const annotation = node.typeAnnotation
  if (annotation.type === "TSTypeReference" && annotation.typeName.type === "Identifier") {
    if (annotation.typeName.name === "const") return isObjectLiteralExpression(node.expression)
  }
  return false
}

/** Ban `satisfies Partial<Record<...>>` on object literals — Partial cancels the totality check. */
export const noPartialRecordSatisfiesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow pinning an object literal with `satisfies Partial<Record<Union, T>>`; Partial drops the exhaustiveness `satisfies` would give you.",
    },
    messages: {
      partialRecord:
        "Do not pin an object literal with `satisfies Partial<Record<...>>`. Make the record total, narrow the key union, or stop using `satisfies` for sparse data.",
    },
  },
  createOnce(context) {
    return {
      TSSatisfiesExpression(node) {
        if (!isPartialRecordType(node.typeAnnotation)) return
        if (!isObjectLiteralExpression(node.expression)) return
        context.report({ node, messageId: "partialRecord" })
      },
    }
  },
})
