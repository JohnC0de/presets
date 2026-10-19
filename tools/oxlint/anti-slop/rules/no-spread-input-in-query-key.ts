import { defineRule } from "@oxlint/plugins"

import type { ESTree } from "@oxlint/plugins"

function propertyName(node: ESTree.Property): string | null {
  if (node.computed) {
    return node.key.type === "Literal" && typeof node.key.value === "string" ? node.key.value : null
  }
  return node.key.type === "Identifier" ? node.key.name : null
}

function rootIdentifier(node: ESTree.Expression): ESTree.Identifier | null {
  if (node.type === "Identifier") return node
  if (node.type === "MemberExpression") return rootIdentifier(node.object)
  if (
    node.type === "CallExpression" &&
    node.callee.type !== "Super" &&
    node.callee.type !== "V8IntrinsicExpression"
  ) {
    return rootIdentifier(node.callee)
  }
  if (node.type === "ChainExpression") return rootIdentifier(node.expression)
  return null
}

function isKeysFactory(node: ESTree.Expression): boolean {
  const root = rootIdentifier(node)
  return root !== null && root.name.endsWith("Keys")
}

function isLeakySpread(element: ESTree.SpreadElement | ESTree.Expression | null): boolean {
  if (element === null || element.type !== "SpreadElement") return false
  return !isKeysFactory(element.argument)
}

function arrayHasLeakySpread(node: ESTree.ArrayExpression): boolean {
  return node.elements.some((element) => element !== null && isLeakySpread(element))
}

/** Ban spreading a caller object into a TanStack Query `queryKey` array. */
export const noSpreadInputInQueryKeyRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow `queryKey: [...input]`; spread only `*Keys` factory results and list cache-identity fields explicitly.",
    },
    messages: {
      leaky:
        "Do not spread a caller object into `queryKey`. Spread a `*Keys` factory and list the concrete cache-identity fields.",
    },
  },
  createOnce(context) {
    return {
      Property(node) {
        if (propertyName(node) !== "queryKey") return
        if (node.value.type !== "ArrayExpression") return
        if (!arrayHasLeakySpread(node.value)) return
        context.report({ node, messageId: "leaky" })
      },
    }
  },
})
