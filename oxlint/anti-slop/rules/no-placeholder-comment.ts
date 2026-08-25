import { defineRule } from "@oxlint/plugins"

const PLACEHOLDER =
  /\b(your code here|implementation here|add your logic|helper function|todo:\s*implement(?:\s+this)?)\b/iu

/** Ban leftover AI/scaffold comments (`// TODO: implement`, `// your code here`). */
export const noPlaceholderCommentRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow placeholder comments that mark unfinished generated code instead of a tracked task.",
    },
    messages: {
      placeholder:
        "Remove this placeholder comment. Track unfinished work with `TODO(#issue, @owner)`, or delete the stub.",
    },
  },
  createOnce(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (PLACEHOLDER.test(comment.value)) {
            context.report({ node: comment, messageId: "placeholder" })
          }
        }
      },
    }
  },
})
