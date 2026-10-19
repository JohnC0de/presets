import { defineRule } from '@oxlint/plugins';
import type { ESTree } from '@oxlint/plugins';

const FORBIDDEN_SYMBOL_NAME = 'shape';

function containsForbiddenSymbolName(name: string): boolean {
  return name.toLowerCase().includes(FORBIDDEN_SYMBOL_NAME);
}

/** Return whether an identifier names a statically accessed member owned by another value. */
function isBorrowedMemberName(node: ESTree.Node): boolean {
  const parent = node.parent;
  if (parent === null || parent.type !== 'MemberExpression') return false;
  return parent.property === node && parent.computed === false;
}

/** Ban the case-insensitive substring "shape" in every JavaScript and TypeScript symbol name. */
export const noForbiddenTermInSymbolNamesRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow the case-insensitive substring "shape" in JavaScript, TypeScript, private, and JSX symbol names.',
    },
    messages: {
      forbiddenSymbolName:
        'Rename symbol "{{name}}" for its domain role; "shape" describes structure rather than ownership.',
    },
    schema: [{
      type: 'object',
      properties: {
        targets: { enum: ['symbols', 'declarations'] },
        allowedPatterns: { type: 'array', items: { type: 'string', format: 'regex' } },
        caseInsensitive: { type: 'boolean' },
      },
      additionalProperties: false,
    }],
  },
  createOnce(context) {
    let declarations = false;
    let allowed: RegExp[] = [];
    const reportName = (node: ESTree.Node, name: string) => {
      if (!containsForbiddenSymbolName(name) || allowed.some(pattern => pattern.test(name))) return;
      context.report({ node, messageId: 'forbiddenSymbolName', data: { name } });
    };
    const reportSymbol = (node: ESTree.Node & { name: string }) => {
      if (!declarations && !isBorrowedMemberName(node)) reportName(node, node.name);
    };
    const reportDeclaration = (node: ESTree.Node) => {
      if (!declarations) return;
      const binding = 'id' in node ? node.id : 'key' in node ? node.key : null;
      if (binding?.type === 'Identifier' || binding?.type === 'PrivateIdentifier') {
        reportName(binding, binding.name);
      } else if (binding?.type === 'Literal' && typeof binding.value === 'string') {
        reportName(binding, binding.value);
      }
    };
    return {
      before() {
        declarations = false;
        allowed = [];
        const options = context.options[0];
        if (options === undefined) return;
        declarations = options.targets === 'declarations';
        if (options.allowedPatterns === undefined) return;
        allowed = options.allowedPatterns.map((pattern: string) =>
          new RegExp(pattern, options.caseInsensitive === false ? 'u' : 'iu'));
      },
      Identifier: reportSymbol,
      PrivateIdentifier(node) {
        if (declarations) reportName(node, node.name);
        else reportSymbol(node);
      },
      JSXIdentifier(node) {
        if (!declarations) reportSymbol(node);
        else if (node.parent?.type === 'JSXOpeningElement' || node.parent?.type === 'JSXAttribute') {
          reportName(node, node.name);
        }
      },
      VariableDeclarator: reportDeclaration,
      FunctionDeclaration: reportDeclaration,
      FunctionExpression: reportDeclaration,
      ClassDeclaration: reportDeclaration,
      ClassExpression: reportDeclaration,
      TSTypeAliasDeclaration: reportDeclaration,
      TSInterfaceDeclaration: reportDeclaration,
      TSEnumDeclaration: reportDeclaration,
      TSPropertySignature: reportDeclaration,
      PropertyDefinition: reportDeclaration,
      MethodDefinition: reportDeclaration,
    };
  },
});
