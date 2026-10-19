import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"

const DOCUMENT_HOSTS = new Set(["document", "globalThis", "window", "self"])

function staticString(node: ESTree.Expression | ESTree.PrivateIdentifier): string | null {
  if (node.type === "Literal" && typeof node.value === "string") return node.value
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? null
  }
  return null
}

function isCookieProperty(node: ESTree.MemberExpression): boolean {
  if (node.computed) {
    return staticString(node.property) === "cookie"
  }
  return node.property.type === "Identifier" && node.property.name === "cookie"
}

function isDocumentCookieAccess(node: ESTree.Node): boolean {
  if (node.type !== "MemberExpression" || !isCookieProperty(node)) return false
  if (node.object.type === "Identifier" && node.object.name === "document") return true
  if (node.object.type !== "MemberExpression" || node.object.computed) return false
  return (
    node.object.property.type === "Identifier" &&
    node.object.property.name === "document" &&
    node.object.object.type === "Identifier" &&
    DOCUMENT_HOSTS.has(node.object.object.name)
  )
}

/** Ban assignment to `document.cookie`; reads stay allowed. */
export const noDocumentCookieRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow writing `document.cookie` directly; cookie attributes belong in one sanctioned helper.",
    },
    messages: {
      assignment:
        "Do not assign to `document.cookie`. It bypasses Secure/SameSite/Path defaults and can clobber unrelated cookies.",
    },
  },
  createOnce(context) {
    return {
      AssignmentExpression(node) {
        if (isDocumentCookieAccess(node.left)) {
          context.report({ node, messageId: "assignment" })
        }
      },
    }
  },
})
