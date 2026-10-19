import { defineRule } from "@oxlint/plugins"

const DISABLE = /\b(?:eslint|oxlint)-disable(?:-next-line|-line)?\b/u
const ENABLE = /\b(?:eslint|oxlint)-enable\b/u
const INLINE = /--\s*\S/u

function isDirective(text: string): boolean {
  return DISABLE.test(text) || ENABLE.test(text)
}

/** Ban oxlint/eslint disable comments that do not explain the exception. */
export const requireSuppressionDescriptionRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Require every `oxlint-disable` / `eslint-disable` directive to include `-- <reason>` or a comment on the line above.",
    },
    messages: {
      missing:
        "Suppression needs a reason: add `-- <why>` on the directive, or a comment on the line above.",
    },
  },
  createOnce(context) {
    return {
      Program() {
        const comments = context.sourceCode.getAllComments()
        for (const comment of comments) {
          if (!DISABLE.test(comment.value)) continue
          if (INLINE.test(comment.value)) continue
          const lineAbove = (comment.loc?.start.line ?? 0) - 1
          const documented = comments.some(
            (other) =>
              other !== comment && !isDirective(other.value) && other.loc?.end.line === lineAbove,
          )
          if (documented) continue
          context.report({ node: comment, messageId: "missing" })
        }
      },
    }
  },
})
