import { defineRule } from "@oxlint/plugins"
import type { ESTree } from "@oxlint/plugins"

function importedName(node: ESTree.Node): string | null {
  if (node.type !== "ImportSpecifier") return null
  return node.imported.type === "Identifier" ? node.imported.name : String(node.imported.value)
}

/** Ban TypeScript `enum` and `React.FC` — literal unions and plain functions. */
export const noTypescriptEnumRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow TypeScript enum declarations and React.FC; use a literal union and a plain function.",
    },
    messages: {
      typescriptEnum:
        "Do not declare a TypeScript enum. Use a string or number literal union, or `as const` on an object.",
      reactFc:
        "Do not type a component as `React.FC`. Use a plain function that takes a named props type.",
    },
  },
  createOnce(context) {
    const reactImports = new Set<string>()

    return {
      Program(node) {
        reactImports.clear()
        for (const statement of node.body) {
          if (
            statement.type === "ImportDeclaration" &&
            (statement.source.value === "react" ||
              statement.source.value === "preact" ||
              statement.source.value === "react/jsx-runtime")
          ) {
            for (const specifier of statement.specifiers) {
              if (specifier.type === "ImportSpecifier") {
                const name = importedName(specifier)
                if (name === "FC" || name === "FunctionComponent") {
                  reactImports.add(specifier.local.name)
                }
              }
            }
          }
        }
      },
      TSEnumDeclaration(node) {
        context.report({ node, messageId: "typescriptEnum" })
      },
      TSTypeReference(node) {
        const name = node.typeName
        if (
          name.type === "TSQualifiedName" &&
          name.left.type === "Identifier" &&
          (name.left.name === "React" || name.left.name === "Preact") &&
          name.right.type === "Identifier" &&
          (name.right.name === "FC" || name.right.name === "FunctionComponent")
        ) {
          context.report({ node, messageId: "reactFc" })
          return
        }
        if (
          name.type === "Identifier" &&
          (reactImports.has(name.name) || name.name === "FC" || name.name === "FunctionComponent")
        ) {
          context.report({ node, messageId: "reactFc" })
        }
      },
    }
  },
})
