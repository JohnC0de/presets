import { defineRule } from "@oxlint/plugins"

const FOREIGN = /\b(?:biome-ignore|prettier-ignore)\b/u

/** Ban Biome/Prettier ignore comments; this toolchain is oxlint + oxfmt. */
export const noForeignDirectiveRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `biome-ignore` and `prettier-ignore`; they are dead in an oxlint + oxfmt repo.",
    },
    messages: {
      foreign:
        "`{{kind}}` is not honoured here. Remove it, or use an oxlint disable with a reason.",
    },
  },
  createOnce(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = FOREIGN.exec(comment.value)
          if (match) {
            context.report({
              node: comment,
              messageId: "foreign",
              data: { kind: match[0] },
            })
          }
        }
      },
    }
  },
})
