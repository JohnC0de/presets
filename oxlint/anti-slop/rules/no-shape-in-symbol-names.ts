import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

const FORBIDDEN_SYMBOL_NAME = "shape";
const GODOT_SHAPE_ALLOWLIST =
  /^(?:_?mouse_shape_(?:enter|exit)|(?:Collision|Rectangle|Circle|Capsule|Cylinder|Sphere|Box|Segment|SeparationRay|WorldBoundary|ConcavePolygon|ConvexPolygon|HeightMap)?Shape[23]D?|ShapeCast[23]D|shape_owner_.*|result_shape_invalid)$/i;

function containsForbiddenSymbolName(name: string): boolean {
  return name.toLowerCase().includes(FORBIDDEN_SYMBOL_NAME) && !GODOT_SHAPE_ALLOWLIST.test(name);
}

function identifierName(node: ESTree.Node | null | undefined): string | null {
  if (!node) return null;
  if (
    node.type === "Identifier" ||
    node.type === "PrivateIdentifier" ||
    node.type === "JSXIdentifier"
  ) {
    return node.name;
  }
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  return null;
}

/** Ban the case-insensitive substring "shape" in custom JavaScript and TypeScript symbol declarations. */
export const noForbiddenTermInSymbolNamesRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        'Disallow the case-insensitive substring "shape" in JavaScript, TypeScript, private, and JSX symbol declarations, except Godot native APIs.',
    },
    messages: {
      forbiddenSymbolName:
        'Rename symbol "{{name}}" for its domain role; "shape" describes structure rather than ownership.',
    },
  },
  createOnce(context) {
    const checkIdentifier = (node: ESTree.Node, name: string | null) => {
      if (name === null || !containsForbiddenSymbolName(name)) return;
      context.report({
        node,
        messageId: "forbiddenSymbolName",
        data: { name },
      });
    };

    return {
      VariableDeclarator(node) {
        if (node.id.type === "Identifier") {
          checkIdentifier(node.id, node.id.name);
        }
      },
      FunctionDeclaration(node) {
        if (node.id !== null) {
          checkIdentifier(node.id, node.id.name);
        }
      },
      FunctionExpression(node) {
        if (node.id !== null) {
          checkIdentifier(node.id, node.id.name);
        }
      },
      ClassDeclaration(node) {
        if (node.id !== null) {
          checkIdentifier(node.id, node.id.name);
        }
      },
      ClassExpression(node) {
        if (node.id !== null) {
          checkIdentifier(node.id, node.id.name);
        }
      },
      TSTypeAliasDeclaration(node) {
        checkIdentifier(node.id, node.id.name);
      },
      TSInterfaceDeclaration(node) {
        checkIdentifier(node.id, node.id.name);
      },
      TSEnumDeclaration(node) {
        checkIdentifier(node.id, node.id.name);
      },
      TSPropertySignature(node) {
        checkIdentifier(node.key, identifierName(node.key));
      },
      PropertyDefinition(node) {
        checkIdentifier(node.key, identifierName(node.key));
      },
      MethodDefinition(node) {
        checkIdentifier(node.key, identifierName(node.key));
      },
      PrivateIdentifier(node) {
        checkIdentifier(node, node.name);
      },
      JSXIdentifier(node) {
        if (node.parent?.type === "JSXOpeningElement" || node.parent?.type === "JSXAttribute") {
          checkIdentifier(node, node.name);
        }
      },
    };
  },
});
