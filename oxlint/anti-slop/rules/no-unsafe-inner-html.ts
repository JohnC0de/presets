import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"

const SAFE_HTML = /^\s*safe-html:/u

function isStaticHtml(node: ESTree.Expression): boolean {
  if (node.type === "Literal" && typeof node.value === "string") return true
  if (node.type === "TemplateLiteral") return node.expressions.every(isStaticHtml)
  return false
}

function hasSafeHtmlComment(
  sourceCode: { getCommentsBefore: (node: ESTree.Node) => { value: string }[] },
  node: ESTree.Node,
): boolean {
  return sourceCode.getCommentsBefore(node).some((comment) => SAFE_HTML.test(comment.value))
}

function propertyName(
  key: ESTree.Expression | ESTree.PrivateIdentifier,
  computed: boolean,
): string | null {
  if (computed) return key.type === "Literal" && typeof key.value === "string" ? key.value : null
  return key.type === "Identifier" ? key.name : null
}

function isInnerHtmlLhs(node: ESTree.Node): boolean {
  if (node.type !== "MemberExpression") return false
  const name = node.computed
    ? node.property.type === "Literal" && node.property.value === "innerHTML"
    : node.property.type === "Identifier" && node.property.name === "innerHTML"
  return name === true
}

/** Ban dynamic `innerHTML` / `dangerouslySetInnerHTML` without a `safe-html:` provenance comment. */
export const noUnsafeInnerHtmlRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow dynamic HTML sinks unless the value is a static string or annotated `// safe-html:`.",
    },
    messages: {
      unsafe:
        "Dynamic HTML needs a `// safe-html:` comment on the line above naming the sanitizer. Function names are not proof.",
    },
  },
  createOnce(context) {
    return {
      AssignmentExpression(node) {
        if (!isInnerHtmlLhs(node.left)) return
        if (isStaticHtml(node.right)) return
        if (hasSafeHtmlComment(context.sourceCode, node)) return
        context.report({ node, messageId: "unsafe" })
      },
      Property(node) {
        if (propertyName(node.key, node.computed) !== "__html") return
        if (node.parent.type !== "ObjectExpression") return
        if (node.value.type === "AssignmentPattern" || node.value.type === "RestElement") return
        if (isStaticHtml(node.value)) return
        if (hasSafeHtmlComment(context.sourceCode, node)) return
        context.report({ node, messageId: "unsafe" })
      },
    }
  },
})
