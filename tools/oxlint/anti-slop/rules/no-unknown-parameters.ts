import { defineRule } from '@oxlint/plugins';
import type { ESTree } from '@oxlint/plugins';

import {
  containsUnknownType,
  functionParameterBindingName,
  functionParameterTypeAnnotation,
} from '../shared/function-parameters.ts';

const DEFAULT_ALLOWED_NAMES: readonly string[] = ['cause'];

type ParameterOwner =
  | ESTree.ArrowFunctionExpression
  | ESTree.Function
  | ESTree.TSCallSignatureDeclaration
  | ESTree.TSConstructSignatureDeclaration
  | ESTree.TSConstructorType
  | ESTree.TSFunctionType
  | ESTree.TSMethodSignature;

function isTypePredicateSubject(owner: ParameterOwner, parameterName: string): boolean {
  const predicate = owner.returnType?.typeAnnotation;
  return (
    predicate?.type === 'TSTypePredicate' &&
    predicate.parameterName.type === 'Identifier' &&
    predicate.parameterName.name === parameterName
  );
}

/** Disallow unknown inputs except explicitly named error-cause enrichment. */
export const noUnknownParametersRule = defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow explicitly unknown function parameters except `cause` and type-predicate subjects; decode unknown input at its I/O boundary instead.',
    },
    messages: {
      unknownParameter:
        'Parameter `{{parameter}}` leaves input unparsed. Accept a named domain type; run the expected schema or parser at the I/O boundary before calling this function.',
    },
    schema: [{
      type: 'object',
      properties: {
        allowedNames: { type: 'array', items: { type: 'string' } },
        caseInsensitive: { type: 'boolean' },
        allowInTypeGuards: { type: 'boolean' },
      },
      additionalProperties: false,
    }],
  },
  createOnce(context) {
    const checkParameters = (node: ParameterOwner) => {
      const value = context.options[0];
      const options = typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
      if (options?.allowInTypeGuards === true && node.returnType?.typeAnnotation.type === 'TSTypePredicate') return;
      const caseInsensitive = options?.caseInsensitive === true;
      const allowedNames: readonly string[] = Array.isArray(options?.allowedNames)
        ? options.allowedNames.filter((name): name is string => typeof name === 'string')
        : DEFAULT_ALLOWED_NAMES;
      for (const parameter of node.params) {
        const annotation = functionParameterTypeAnnotation(parameter);
        if (annotation === null || annotation === undefined) continue;
        if (!containsUnknownType(annotation.typeAnnotation)) continue;
        const name = functionParameterBindingName(parameter, context.sourceCode);
        if (allowedNames.some(allowed => caseInsensitive
          ? allowed.toLowerCase() === name.toLowerCase() : allowed === name) ||
          isTypePredicateSubject(node, name)) continue;
        context.report({
          node: annotation.typeAnnotation,
          messageId: 'unknownParameter',
          data: { parameter: name },
        });
      }
    };

    return {
      ArrowFunctionExpression: checkParameters,
      FunctionDeclaration: checkParameters,
      FunctionExpression: checkParameters,
      TSCallSignatureDeclaration: checkParameters,
      TSConstructSignatureDeclaration: checkParameters,
      TSConstructorType: checkParameters,
      TSDeclareFunction: checkParameters,
      TSEmptyBodyFunctionExpression: checkParameters,
      TSFunctionType: checkParameters,
      TSMethodSignature: checkParameters,
    };
  },
});
