import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"

const UNDERSCORE_LOCALE = /^[A-Za-z]{2,3}_[A-Za-z0-9_-]+$/u
const INTL_CTORS = new Set([
  "Collator",
  "DateTimeFormat",
  "DisplayNames",
  "ListFormat",
  "Locale",
  "NumberFormat",
  "PluralRules",
  "RelativeTimeFormat",
  "Segmenter",
])

function isIntlCtor(callee: ESTree.Expression | ESTree.Super): boolean {
  if (callee.type !== "MemberExpression" || callee.computed) return false
  if (callee.object.type !== "Identifier" || callee.object.name !== "Intl") return false
  return callee.property.type === "Identifier" && INTL_CTORS.has(callee.property.name)
}

function localeArg(node: ESTree.NewExpression | ESTree.CallExpression): ESTree.Expression | null {
  const first = node.arguments[0]
  if (first === undefined || first.type === "SpreadElement") return null
  return first
}

function reportIfUnderscore(
  context: { report: (arg: { node: ESTree.Node; messageId: string }) => void },
  node: ESTree.Expression,
) {
  if (
    node.type === "Literal" &&
    typeof node.value === "string" &&
    UNDERSCORE_LOCALE.test(node.value)
  ) {
    context.report({ node, messageId: "invalidLocale" })
  }
}

/** Ban POSIX `en_US` locale tags; BCP 47 uses `en-US`. */
export const noIcuInvalidLocaleRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow underscore locale tags (`en_US`) in `Intl.*` constructors; use BCP 47 (`en-US`).",
    },
    messages: {
      invalidLocale: "Use a BCP 47 locale tag (`en-US`), not a POSIX underscore tag (`en_US`).",
    },
  },
  createOnce(context) {
    return {
      NewExpression(node) {
        if (!isIntlCtor(node.callee)) return
        const arg = localeArg(node)
        if (arg !== null) reportIfUnderscore(context, arg)
      },
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression") return
        if (!isIntlCtor(node.callee)) return
        const arg = localeArg(node)
        if (arg !== null) reportIfUnderscore(context, arg)
      },
    }
  },
})
