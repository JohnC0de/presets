import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"

const PATH_APIS = new Set(["dirname", "join", "normalize", "resolve"])

function propertyName(node: ESTree.MemberExpression): string | null {
  if (node.computed) {
    return node.property.type === "Literal" && typeof node.property.value === "string"
      ? node.property.value
      : null
  }
  return node.property.type === "Identifier" ? node.property.name : null
}

function isPathCall(node: ESTree.Expression): boolean {
  if (node.type !== "CallExpression") return false
  const callee = node.callee
  if (callee.type !== "MemberExpression") return false
  const method = propertyName(callee)
  if (method === null || !PATH_APIS.has(method)) return false
  if (
    callee.object.type === "Identifier" &&
    (callee.object.name === "path" ||
      callee.object.name === "posix" ||
      callee.object.name === "win32")
  ) {
    return true
  }
  return false
}

function looksLikePathName(name: string): boolean {
  return /(?:path|dir|root|file|folder|resolved|candidate|baseDir|basePath)$/iu.test(name)
}

function argumentUsesSep(arg: ESTree.Expression): boolean {
  if (arg.type !== "TemplateLiteral") return false
  return arg.expressions.some((expression) => {
    if (expression.type !== "MemberExpression") return false
    return propertyName(expression) === "sep"
  })
}

function startsWithObjectLooksLikePath(object: ESTree.Expression): boolean {
  if (isPathCall(object)) return true
  if (object.type === "Identifier") return looksLikePathName(object.name)
  if (object.type === "CallExpression" && object.callee.type === "MemberExpression") {
    const method = propertyName(object.callee)
    return method === "resolve" || method === "normalize" || method === "join"
  }
  return false
}

/** Ban `startsWith(root)` as a filesystem containment check — it also matches siblings. */
export const noPathPrefixContainmentRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow path containment via `startsWith(root)`; `/safe/root-backup` matches `/safe/root`.",
    },
    messages: {
      prefix:
        "`startsWith(root)` is not containment: a sibling path shares the prefix. Use `path.relative` and reject `..`, or compare with `${root}${path.sep}`.",
    },
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression") return
        if (propertyName(node.callee) !== "startsWith") return
        if (!startsWithObjectLooksLikePath(node.callee.object)) return
        const first = node.arguments[0]
        if (first !== undefined && first.type !== "SpreadElement" && argumentUsesSep(first)) return
        context.report({ node, messageId: "prefix" })
      },
    }
  },
})
