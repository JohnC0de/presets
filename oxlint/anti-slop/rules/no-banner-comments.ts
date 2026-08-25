import { defineRule } from "@oxlint/plugins"

const BANNER = /^\s*(?:[=*#-]{4,}|(?:phase|step|section|part)\s+\d)\b/iu

/** Ban `// =====` / `// Phase 1:` section banners that agents paste into diffs. */
export const noBannerCommentsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow decorative section-banner comments (`// =====`, `// Phase 1:`) in source.",
    },
    messages: {
      banner:
        "Remove this section banner. Structure the file with names and modules, not `// Phase N` comments.",
    },
  },
  createOnce(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (BANNER.test(comment.value)) {
            context.report({ node: comment, messageId: "banner" })
          }
        }
      },
    }
  },
})
