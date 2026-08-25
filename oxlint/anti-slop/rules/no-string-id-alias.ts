import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

const ALIAS = /(?:Id|Email|Slug)$/u;

function unwrapType(type: ESTree.TSType): ESTree.TSType {
  let current = type;
  while (
    current.type === "TSParenthesizedType" ||
    (current.type === "TSTypeOperator" && current.operator === "readonly")
  ) {
    current = current.typeAnnotation;
  }
  return current;
}

function isPrimitiveAlias(type: ESTree.TSType): boolean {
  const unwrapped = unwrapType(type);
  if (unwrapped.type === "TSStringKeyword" || unwrapped.type === "TSNumberKeyword") return true;
  if (unwrapped.type === "TSUnionType") {
    return (
      unwrapped.types.length > 0 && unwrapped.types.every((member) => isPrimitiveAlias(member))
    );
  }
  return false;
}

/** Ban `type UserId = string` — brand semantic primitives. */
export const noStringIdAliasRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow type aliases that rename string/number as an Id, Email, or Slug without branding.",
    },
    messages: {
      stringIdAlias:
        'Alias `{{name}}` is still a bare string/number. Brand it (`T & { readonly __brand: "{{name}}" }`) and validate in a constructor.',
    },
  },
  createOnce(context) {
    return {
      TSTypeAliasDeclaration(node) {
        if (!ALIAS.test(node.id.name) || !isPrimitiveAlias(node.typeAnnotation)) return;
        context.report({
          node: node.id,
          messageId: "stringIdAlias",
          data: { name: node.id.name },
        });
      },
    };
  },
});
