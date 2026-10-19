import { defineRule } from "@oxlint/plugins"

const KIND = /,\s*(?:plural|selectordinal|select)\s*,/u
const OTHER = /\bother\s*\{/u

function missingOther(value: string): boolean {
  return KIND.test(value) && !OTHER.test(value)
}

/** Ban ICU plural/select/selectordinal blocks that omit the required `other` case. */
export const noIcuMissingOtherRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow ICU `plural` / `select` / `selectordinal` messages that have no `other` fallback.",
    },
    messages: {
      missingOther:
        "ICU `plural`/`select`/`selectordinal` must include an `other` case; without it, formatting throws on unmatched values.",
    },
  },
  createOnce(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") return
        if (missingOther(node.value)) context.report({ node, messageId: "missingOther" })
      },
      TemplateElement(node) {
        const cooked = node.value.cooked
        if (typeof cooked === "string" && missingOther(cooked)) {
          context.report({ node, messageId: "missingOther" })
        }
      },
    }
  },
})
