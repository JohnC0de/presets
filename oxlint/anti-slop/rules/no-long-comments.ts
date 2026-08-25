import { defineRule } from "@oxlint/plugins"

const DEFAULT_MAX_LINES = 5
const LICENSE = /\b(?:spdx-license-identifier|copyright|licensed under|all rights reserved)\b/iu
const DIRECTIVE = /^\s*(?:oxlint|eslint)-(?:disable|enable|disable-next-line|disable-line)\b/u
const JSDOC_TAG = /@(?:param|returns?|throws|example|see|deprecated|template|type)\b/u

type Comment = {
  type: string
  value: string
  loc: { start: { line: number }; end: { line: number } } | undefined
}

function commentLines(comment: Comment): number {
  if (comment.loc === undefined) return comment.value.split("\n").length
  return comment.loc.end.line - comment.loc.start.line + 1
}

function isSkippable(comment: Comment, isFileHeader: boolean): boolean {
  const text = comment.value
  if (DIRECTIVE.test(text)) return true
  if (isFileHeader) return true
  if (LICENSE.test(text)) return true
  if (comment.type === "Block" && JSDOC_TAG.test(text)) return true
  return false
}

/** Ban walls of comments that narrate code instead of naming things. */
export const noLongCommentsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow block comments or adjacent line-comment runs longer than a small line budget.",
    },
    messages: {
      longComment:
        "This comment is {{lines}} lines. Keep comments to {{max}} lines or fewer; name the code instead of narrating it.",
    },
    schema: [
      {
        type: "object",
        properties: { maxLines: { type: "integer", minimum: 1 } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ maxLines: DEFAULT_MAX_LINES }],
  },
  createOnce(context) {
    return {
      Program() {
        const option = context.options?.[0]
        const maxLines =
          typeof option === "object" &&
          option !== null &&
          !Array.isArray(option) &&
          typeof option.maxLines === "number"
            ? option.maxLines
            : DEFAULT_MAX_LINES

        const comments = context.sourceCode.getAllComments() as Comment[]
        let run: Comment[] = []
        let runStartLine = 0

        const flushRun = () => {
          if (run.length === 0) return
          const first = run[0]
          if (first === undefined) return
          const lines = run.reduce((sum, comment) => sum + commentLines(comment), 0)
          if (lines > maxLines) {
            context.report({
              node: first,
              messageId: "longComment",
              data: { lines: String(lines), max: String(maxLines) },
            })
          }
          run = []
        }

        for (const comment of comments) {
          const startLine = comment.loc?.start.line ?? 1
          const isFileHeader = comment.type === "Block" && startLine <= 3
          if (isSkippable(comment, isFileHeader)) {
            flushRun()
            continue
          }

          if (comment.type === "Block") {
            flushRun()
            const lines = commentLines(comment)
            if (lines > maxLines) {
              context.report({
                node: comment,
                messageId: "longComment",
                data: { lines: String(lines), max: String(maxLines) },
              })
            }
            continue
          }

          const line = comment.loc?.start.line ?? 0
          if (run.length > 0 && line === runStartLine + run.length) {
            run.push(comment)
            continue
          }
          flushRun()
          run = [comment]
          runStartLine = line
        }
        flushRun()
      },
    }
  },
})
