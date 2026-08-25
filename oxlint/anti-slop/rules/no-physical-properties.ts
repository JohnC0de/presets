import { defineRule } from "@oxlint/plugins"

import { hasPhysicalProperty } from "../shared/physical-properties.ts"

/** Ban physical CSS/Tailwind directions; use logical start/end equivalents. */
export const noPhysicalPropertiesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow physical directional Tailwind/CSS (`ml-`, `text-left`, `left-`) that break RTL.",
    },
    messages: {
      physical:
        "Physical direction breaks RTL. Use logical equivalents: ml→ms, mr→me, pl→ps, pr→pe, left→start, right→end, text-left→text-start.",
    },
  },
  createOnce(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") return
        if (hasPhysicalProperty(node.value)) {
          context.report({ node, messageId: "physical" })
        }
      },
      TemplateElement(node) {
        if (hasPhysicalProperty(node.value.raw)) {
          context.report({ node, messageId: "physical" })
        }
      },
    }
  },
})
