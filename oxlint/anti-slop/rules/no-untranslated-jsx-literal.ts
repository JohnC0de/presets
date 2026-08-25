import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"

const DEFAULT_IGNORED = new Set(["code", "kbd", "pre", "samp", "script", "style", "var"])
const DEFAULT_ALLOWED = new Set([
  "AI",
  "API",
  "AWS",
  "CSV",
  "DOCX",
  "HTML",
  "HTTP",
  "HTTPS",
  "ID",
  "IDs",
  "JSON",
  "MCP",
  "OAuth",
  "PDF",
  "S3",
  "SQL",
  "URL",
  "URLs",
  "UTC",
  "XML",
])
const HAS_LETTER = /\p{L}/u
const HTML_ENTITY = /&(?:[a-zA-Z][a-zA-Z0-9]+|#\d+|#x[\dA-Fa-f]+);/gu
const CONSTANT_LIKE = /^(?=.*[0-9_./+-])[A-Z0-9_./+-]{2,}$/u

function normalizeText(value: string): string {
  return value
    .replace(HTML_ENTITY, " ")
    .replace(/\u00a0/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
}

function reportText(value: string): string {
  return value.length > 40 ? `${value.slice(0, 37)}...` : value
}

function jsxName(node: ESTree.Node): string | null {
  if (node.type === "JSXIdentifier") return node.name
  if (node.type === "JSXMemberExpression") return jsxName(node.property)
  if (node.type === "JSXNamespacedName") return jsxName(node.name)
  return null
}

function hasIgnoredAncestor(node: ESTree.Node, ignored: ReadonlySet<string>): boolean {
  let current: ESTree.Node | null = node.parent
  while (current !== null && current.type !== "Program") {
    if (current.type === "JSXElement") {
      const name = jsxName(current.openingElement.name)
      if (name !== null && ignored.has(name)) return true
    }
    current = current.parent
  }
  return false
}

function stringLiteralValue(node: ESTree.Node): string | null {
  if (node.type === "Literal" && typeof node.value === "string") return node.value
  if (node.type !== "TemplateLiteral" || node.expressions.length > 0) return null
  return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw ?? null
}

function shouldIgnore(text: string, extraAllowed: ReadonlySet<string>): boolean {
  if (text.length <= 1) return true
  if (!HAS_LETTER.test(text)) return true
  if (DEFAULT_ALLOWED.has(text) || extraAllowed.has(text)) return true
  if (CONSTANT_LIKE.test(text) && text.length <= 12) return true
  return false
}

function extraStrings(options: unknown, key: string): string[] {
  if (typeof options !== "object" || options === null || Array.isArray(options)) return []
  const value = (options as Record<string, unknown>)[key]
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : []
}

/** Ban raw user-facing JSX text that never enters a translation catalog. */
export const noUntranslatedJsxLiteralRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow user-facing JSX text literals; wrap copy in the project's translation helper.",
    },
    messages: {
      untranslated:
        "Translate JSX text `{{text}}` with `t(...)` / `useTranslations()`, or disable with a reason for non-user copy.",
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedText: { type: "array", items: { type: "string" } },
          ignoredElementNames: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    const ignored = new Set(DEFAULT_IGNORED)
    const extraAllowed = new Set<string>()

    const check = (node: ESTree.Node, raw: string) => {
      const text = normalizeText(raw)
      if (shouldIgnore(text, extraAllowed)) return
      if (hasIgnoredAncestor(node, ignored)) return
      context.report({ node, messageId: "untranslated", data: { text: reportText(text) } })
    }

    return {
      before() {
        for (const name of extraStrings(context.options?.[0], "ignoredElementNames")) {
          ignored.add(name)
        }
        for (const text of extraStrings(context.options?.[0], "allowedText")) {
          extraAllowed.add(text)
        }
      },
      JSXText(node) {
        if (typeof node.value === "string") check(node, node.value)
      },
      JSXExpressionContainer(node) {
        const parent = node.parent
        if (parent.type !== "JSXElement" && parent.type !== "JSXFragment") return
        const value = stringLiteralValue(node.expression)
        if (value !== null) check(node, value)
      },
    }
  },
})
