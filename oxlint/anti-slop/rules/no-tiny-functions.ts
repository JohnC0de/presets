import { defineRule } from "@oxlint/plugins";
import type { ESTree } from "@oxlint/plugins";

type FunctionNode = ESTree.ArrowFunctionExpression | ESTree.Function;

function isFunctionNode(node: ESTree.Node): node is FunctionNode {
  return (
    node.type === "ArrowFunctionExpression" ||
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression"
  );
}

function unwrapParenthesizedAncestor(node: ESTree.Node): {
  readonly current: ESTree.Node;
  readonly parent: ESTree.Node;
} {
  let current = node;
  let parent = node.parent;
  while (parent.type === "ParenthesizedExpression" && parent.expression === current) {
    current = parent;
    parent = parent.parent;
  }
  return { current, parent };
}

function isExportDeclaration(node: ESTree.Node): boolean {
  return node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration";
}

/** True only when this function is the exported binding, not a helper nested inside an export. */
function isExported(node: FunctionNode): boolean {
  const { current, parent } = unwrapParenthesizedAncestor(node);
  if (isExportDeclaration(parent)) return true;
  if (parent.type !== "VariableDeclarator" || parent.init !== current) return false;
  const declaration = parent.parent;
  return declaration.type === "VariableDeclaration" && isExportDeclaration(declaration.parent);
}

function isTypeGuard(node: FunctionNode): boolean {
  return node.returnType?.typeAnnotation.type === "TSTypePredicate";
}

function isMethod(node: FunctionNode): boolean {
  const parent = node.parent;
  return (
    parent.type === "MethodDefinition" ||
    parent.type === "TSMethodSignature" ||
    (parent.type === "Property" && parent.method)
  );
}

function isCallback(node: FunctionNode): boolean {
  const { current, parent } = unwrapParenthesizedAncestor(node);
  if (parent.type === "CallExpression" || parent.type === "NewExpression") {
    return parent.arguments.some((argument) => argument === current);
  }
  if (parent.type === "JSXExpressionContainer") {
    return true;
  }
  return parent.type === "Property" && parent.value === current && !parent.method;
}

function returnedExpression(node: FunctionNode): ESTree.Expression | null {
  if (node.type === "ArrowFunctionExpression" && node.expression) return node.body;
  const body = node.body;
  if (body.type !== "BlockStatement" || body.body.length !== 1) return null;
  const statement = body.body[0];
  return statement?.type === "ReturnStatement" ? statement.argument : null;
}

function isTrivialExpression(node: ESTree.Expression): boolean {
  switch (node.type) {
    case "Identifier":
    case "Literal":
    case "TemplateLiteral":
    case "MemberExpression":
    case "UnaryExpression":
    case "BinaryExpression":
    case "LogicalExpression":
    case "ConditionalExpression":
      return true;
    case "ChainExpression":
      return isTrivialExpression(node.expression);
    case "ParenthesizedExpression":
      return isTrivialExpression(node.expression);
    default:
      return false;
  }
}

function isTinyBody(node: FunctionNode): boolean {
  const expression = returnedExpression(node);
  return expression !== null && isTrivialExpression(expression);
}

function functionName(node: FunctionNode): string | null {
  if (node.type !== "ArrowFunctionExpression" && node.id !== null) return node.id.name;
  if (node.parent.type === "VariableDeclarator" && node.parent.id.type === "Identifier") {
    return node.parent.id.name;
  }
  return null;
}

function isNamedContract(name: string | null): boolean {
  return name !== null && /^(?:is|has|assert|as|to|from)[A-Z]/.test(name);
}

/** Ban one-expression wrappers that only rename a value. */
export const noTinyFunctionsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow functions whose whole body is one returned expression, unless they are the exported binding, a type guard, a method, a callback, or a named is/has/assert/as/to/from contract.",
    },
    messages: {
      tinyFunction:
        "This function only wraps one expression. Inline it unless the name is a public contract, type guard, callback, or method.",
    },
  },
  createOnce(context) {
    const check = (node: FunctionNode) => {
      if (!isFunctionNode(node) || !isTinyBody(node)) return;
      if (isExported(node) || isTypeGuard(node) || isMethod(node) || isCallback(node)) return;
      if (isNamedContract(functionName(node))) return;
      context.report({ node, messageId: "tinyFunction" });
    };
    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
});
