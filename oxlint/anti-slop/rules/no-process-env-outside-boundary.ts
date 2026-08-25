import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"
import { filenameOf } from "../shared/filename.ts"

const DEFAULT_ALLOWED = [
  /(?:^|\/)env(?:-base)?\.ts$/u,
  /(?:^|\/)setup-env\.ts$/u,
  /(?:^|\/)(?:scripts|tests|__tests__)\/.+/u,
  /\.(?:config|test|spec)\.[cm]?[jt]sx?$/u,
]

function isAllowedFile(filename: string, extra: readonly string[]): boolean {
  if (DEFAULT_ALLOWED.some((pattern) => pattern.test(filename))) return true
  return extra.some((allowed) => filename.endsWith(allowed.replaceAll("\\", "/")))
}

function staticPropertyName(node: ESTree.MemberExpression): string | null {
  if (!node.computed) {
    return node.property.type === "Identifier" ? node.property.name : null
  }
  return node.property.type === "Literal" && typeof node.property.value === "string"
    ? node.property.value
    : null
}

function isProcessEnvRoot(node: ESTree.Node): node is ESTree.MemberExpression {
  return (
    node.type === "MemberExpression" &&
    node.object.type === "Identifier" &&
    node.object.name === "process" &&
    staticPropertyName(node) === "env"
  )
}

function envNameForAccess(node: ESTree.MemberExpression): string {
  if (isProcessEnvRoot(node)) return "process.env"
  if (!isProcessEnvRoot(node.object)) return "process.env"
  const propertyName = staticPropertyName(node)
  if (propertyName === null) return "process.env[...]"
  return node.computed
    ? `process.env[${JSON.stringify(propertyName)}]`
    : `process.env.${propertyName}`
}

function isNestedProcessEnvRoot(node: ESTree.MemberExpression): boolean {
  if (!isProcessEnvRoot(node)) return false
  const parent = node.parent
  return parent.type === "MemberExpression" && parent.object === node
}

function isProcessEnvAccess(node: ESTree.MemberExpression): boolean {
  if (isNestedProcessEnvRoot(node)) return false
  if (isProcessEnvRoot(node)) return true
  return isProcessEnvRoot(node.object)
}

function extraAllowedFiles(options: unknown): string[] {
  if (typeof options !== "object" || options === null || Array.isArray(options)) return []
  const value = options.allowedFiles
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : []
}

/** Ban raw `process.env` outside env modules, configs, scripts, and tests. */
export const noProcessEnvOutsideBoundaryRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow unvalidated `process.env` reads outside env.ts, configs, scripts, and tests.",
    },
    messages: {
      processEnv:
        "Read {{envName}} through an env module, or add this file to the approved `process.env` boundary.",
    },
    schema: [
      {
        type: "object",
        properties: { allowedFiles: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
  },
  createOnce(context) {
    return {
      before() {
        return !isAllowedFile(filenameOf(context), extraAllowedFiles(context.options?.[0]))
      },
      MemberExpression(node) {
        if (!isProcessEnvAccess(node)) return
        context.report({
          node,
          messageId: "processEnv",
          data: { envName: envNameForAccess(node) },
        })
      },
    }
  },
})
