import { defineRule } from "@oxlint/plugins"

const END_LABEL = /^\s*end(?:\s+\w+)?\s*$/iu

/** Ban `} // end if` / `} // end function` — AI brace narration. */
export const noClosingBraceLabelRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow trailing comments that label a closing brace (`} // end if`).",
    },
    messages: {
      braceLabel:
        "Do not label a closing brace with `// end …`. Indentation already shows the block.",
    },
  },
  createOnce(context) {
    return {
      Program() {
        const sourceCode = context.sourceCode
        for (const comment of sourceCode.getAllComments()) {
          if (!END_LABEL.test(comment.value.trim())) continue
          const before = sourceCode.getText().slice(Math.max(0, comment.start - 24), comment.start)
          if (/\}\s*$/u.test(before)) {
            context.report({ node: comment, messageId: "braceLabel" })
          }
        }
      },
    }
  },
})
