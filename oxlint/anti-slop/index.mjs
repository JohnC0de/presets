// oxlint/anti-slop/index.ts
import { eslintCompatPlugin } from "@oxlint/plugins";

// oxlint/anti-slop/rules/no-chained-type-assertions.ts
import { defineRule } from "@oxlint/plugins";
function isTypeAssertionExpression(node) {
  return node.type === "TSAsExpression" || node.type === "TSTypeAssertion";
}
function unwrapParenthesizedExpression(expression) {
  let current = expression;
  while (current.type === "ParenthesizedExpression") {
    current = current.expression;
  }
  return current;
}
function isConstAssertion(node) {
  const { typeAnnotation } = node;
  return typeAnnotation.type === "TSTypeReference" && typeAnnotation.typeName.type === "Identifier" && typeAnnotation.typeName.name === "const";
}
function isOutermostAssertionInChain(node) {
  let current = node;
  let parent = node.parent;
  while (parent.type === "ParenthesizedExpression" && parent.expression === current) {
    current = parent;
    parent = parent.parent;
  }
  return !isTypeAssertionExpression(parent) || parent.expression !== current;
}
function isForbiddenAssertionChain(node) {
  let assertionCount = 0;
  let hasNonConstAssertion = false;
  let current = node;
  while (isTypeAssertionExpression(current)) {
    assertionCount += 1;
    hasNonConstAssertion ||= !isConstAssertion(current);
    current = unwrapParenthesizedExpression(current.expression);
  }
  return assertionCount > 1 && hasNonConstAssertion;
}
var noChainedTypeAssertionsRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow chained TypeScript as and angle-bracket assertions, including parenthesized chains."
    },
    messages: {
      chained: "This assertion chain discards type evidence. Keep the original precise type, or parse untrusted input at its boundary before narrowing it."
    }
  },
  createOnce(context) {
    const checkTypeAssertion = (node) => {
      if (!isOutermostAssertionInChain(node) || !isForbiddenAssertionChain(node))
        return;
      context.report({ node, messageId: "chained" });
    };
    return {
      TSAsExpression: checkTypeAssertion,
      TSTypeAssertion: checkTypeAssertion
    };
  }
});

// oxlint/anti-slop/rules/no-conditional-empty-object-spread.ts
import { defineRule as defineRule2 } from "@oxlint/plugins";
function unwrapParentheses(node) {
  let current = node;
  while (current.type === "ParenthesizedExpression") {
    current = current.expression;
  }
  return current;
}
function isEmptyObjectExpression(node) {
  return node.type === "ObjectExpression" && node.properties.length === 0;
}
function isConditionalEmptyObjectSpread(node) {
  const conditional = unwrapParentheses(node);
  return conditional.type === "ConditionalExpression" && (isEmptyObjectExpression(conditional.consequent) || isEmptyObjectExpression(conditional.alternate));
}
var noConditionalEmptyObjectSpreadRule = defineRule2({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow object spreads that conditionally spread an empty object to omit fields."
    },
    messages: {
      avoid: "This conditional spread hides property omission behind an empty object. Build the object in separate statements and add the property only when present."
    }
  },
  createOnce(context) {
    return {
      SpreadElement(node) {
        if (node.parent.type !== "ObjectExpression")
          return;
        if (isConditionalEmptyObjectSpread(node.argument)) {
          context.report({ node, messageId: "avoid" });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-inline-cast-access.ts
import { defineRule as defineRule3 } from "@oxlint/plugins";
function isInlineObjectAssertion(node) {
  return node.typeAnnotation.type === "TSTypeLiteral";
}
function isImmediatePropertyRead(node) {
  let current = node;
  let parent = node.parent;
  while (parent.type === "ParenthesizedExpression" && parent.expression === current) {
    current = parent;
    parent = parent.parent;
  }
  if (parent.type === "MemberExpression" && parent.object === current)
    return true;
  if (parent.type !== "ChainExpression")
    return false;
  const expression = parent.expression;
  return expression.type === "MemberExpression" && expression.object === current;
}
var noInlineCastAccessRule = defineRule3({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow asserting an inline object type and immediately reading a property from it."
    },
    messages: {
      inlineCastAccess: "Do not assert an inline object type just to read a field. Parse at the boundary, narrow with `in`/`typeof`, or use a named type that was already validated."
    }
  },
  createOnce(context) {
    const checkAssertion = (node) => {
      if (!isInlineObjectAssertion(node) || !isImmediatePropertyRead(node))
        return;
      context.report({ node, messageId: "inlineCastAccess" });
    };
    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion
    };
  }
});

// oxlint/anti-slop/rules/no-known-value-widening.ts
import { defineRule as defineRule4 } from "@oxlint/plugins";

// oxlint/anti-slop/shared/dictionary-types.ts
var BUILT_INS = new Set([
  "Record",
  "Readonly",
  "Partial",
  "Required",
  "Pick",
  "Omit",
  "PropertyKey",
  "NonNullable"
]);
var TRANSPARENT_WRAPPERS = new Set(["Readonly", "Partial", "Required", "NonNullable"]);
function declaredStatement(statement) {
  return statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration" ? statement.declaration ?? null : statement;
}
function createTypeEnvironment(program) {
  const aliases = new Map;
  const interfaces = new Map;
  const shadowedBuiltIns = new Set;
  for (const statement of program.body) {
    const declaration = declaredStatement(statement);
    if (declaration?.type === "ImportDeclaration") {
      for (const specifier of declaration.specifiers) {
        if (BUILT_INS.has(specifier.local.name))
          shadowedBuiltIns.add(specifier.local.name);
      }
      continue;
    }
    if (declaration?.type === "TSTypeAliasDeclaration") {
      const existing = aliases.get(declaration.id.name);
      if (existing === undefined)
        aliases.set(declaration.id.name, declaration);
      else
        shadowedBuiltIns.add(declaration.id.name);
      if (BUILT_INS.has(declaration.id.name))
        shadowedBuiltIns.add(declaration.id.name);
      continue;
    }
    if (declaration?.type === "TSInterfaceDeclaration") {
      const declarations = interfaces.get(declaration.id.name) ?? [];
      declarations.push(declaration);
      interfaces.set(declaration.id.name, declarations);
      if (BUILT_INS.has(declaration.id.name))
        shadowedBuiltIns.add(declaration.id.name);
      continue;
    }
    if (declaration?.type === "TSEnumDeclaration") {
      if (BUILT_INS.has(declaration.id.name))
        shadowedBuiltIns.add(declaration.id.name);
      continue;
    }
    if ((declaration?.type === "ClassDeclaration" || declaration?.type === "FunctionDeclaration") && declaration.id !== null) {
      if (BUILT_INS.has(declaration.id.name))
        shadowedBuiltIns.add(declaration.id.name);
    }
  }
  return { aliases, interfaces, shadowedBuiltIns };
}
function typeReferenceName(type) {
  return type.typeName.type === "Identifier" ? type.typeName.name : null;
}
function isBuiltIn(name, environment) {
  return BUILT_INS.has(name) && !environment.shadowedBuiltIns.has(name);
}
function isUnappliedReferenceTo(type, name) {
  const unwrapped = unwrapTransparentType(type);
  return unwrapped.type === "TSTypeReference" && typeReferenceName(unwrapped) === name && (unwrapped.typeArguments === null || unwrapped.typeArguments === undefined || unwrapped.typeArguments.params.length === 0);
}
function unwrapTransparentType(type) {
  let current = type;
  while (current.type === "TSParenthesizedType" || current.type === "TSTypeOperator" && current.operator === "readonly") {
    current = current.typeAnnotation;
  }
  return current;
}
function isNeverType(type) {
  return unwrapTransparentType(type).type === "TSNeverKeyword";
}
function isEffectivelyEmptyMember(member) {
  return member.type === "TSPropertySignature" && member.optional === true && member.typeAnnotation !== null && member.typeAnnotation !== undefined && isNeverType(member.typeAnnotation.typeAnnotation);
}
function isEffectivelyEmptyTypeLiteral(type) {
  return type.members.length === 0 || type.members.every(isEffectivelyEmptyMember);
}
function isEffectivelyEmptyInterface(declarations) {
  if (declarations.length !== 1)
    return false;
  const [type] = declarations;
  return type !== undefined && type.extends.length === 0 && (type.body.body.length === 0 || type.body.body.every(isEffectivelyEmptyMember));
}
function resolvedSubstitutionArgument(type, base, resolving = new Set) {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type !== "TSTypeReference")
    return type;
  const name = typeReferenceName(unwrapped);
  if (name === null || resolving.has(name))
    return type;
  const substitution = base.get(name);
  if (substitution === undefined)
    return type;
  const nextResolving = new Set(resolving);
  nextResolving.add(name);
  return resolvedSubstitutionArgument(substitution, base, nextResolving);
}
function aliasSubstitution(alias, type, base) {
  const parameters = alias.typeParameters?.params ?? [];
  const arguments_ = type.typeArguments?.params ?? [];
  const next = new Map(base);
  for (const [index, parameter] of parameters.entries()) {
    const argument = arguments_[index] ?? parameter.default;
    if (argument === null || argument === undefined)
      return null;
    next.set(parameter.name.name, resolvedSubstitutionArgument(argument, next));
  }
  return next;
}
function unsafeDirectValue(type, environment, substitutions, resolvingAliases) {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSUnknownKeyword")
    return "unknown";
  if (unwrapped.type === "TSAnyKeyword")
    return "any";
  if (unwrapped.type === "TSObjectKeyword")
    return "object";
  if (unwrapped.type === "TSTypeLiteral" && isEffectivelyEmptyTypeLiteral(unwrapped))
    return "empty-object";
  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.some((member) => unsafeDirectValue(member, environment, substitutions, resolvingAliases) !== null) ? "union" : null;
  }
  if (unwrapped.type === "TSIntersectionType") {
    const unsafeMembers = unwrapped.types.map((member) => unsafeDirectValue(member, environment, substitutions, resolvingAliases));
    if (unsafeMembers.includes("any"))
      return "any";
    return unsafeMembers.length > 0 && unsafeMembers.every((member) => member !== null) ? unsafeMembers[0] : null;
  }
  if (unwrapped.type !== "TSTypeReference")
    return null;
  const name = typeReferenceName(unwrapped);
  if (name === null)
    return null;
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined ? null : unsafeDirectValue(wrapped, environment, substitutions, resolvingAliases);
  }
  const substitution = substitutions.get(name);
  if (substitution !== undefined) {
    return isUnappliedReferenceTo(substitution, name) ? null : unsafeDirectValue(substitution, environment, substitutions, resolvingAliases);
  }
  const interfaceDeclarations = environment.interfaces.get(name);
  if (interfaceDeclarations !== undefined) {
    return isEffectivelyEmptyInterface(interfaceDeclarations) ? "empty-object" : null;
  }
  const alias = environment.aliases.get(name);
  if (alias === undefined || resolvingAliases.has(name))
    return null;
  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
  if (nextSubstitutions === null)
    return null;
  const nextResolving = new Set(resolvingAliases);
  nextResolving.add(name);
  return unsafeDirectValue(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}
function dictionaryValueFromLiteral(unwrapped, substitutions) {
  if (unwrapped.type === "TSMappedType") {
    return unwrapped.typeAnnotation === null ? [] : [{ type: unwrapped.typeAnnotation, substitutions }];
  }
  return unwrapped.members.flatMap((member) => member.type === "TSIndexSignature" && member.typeAnnotation !== null ? [{ type: member.typeAnnotation.typeAnnotation, substitutions }] : []);
}
function dictionaryValueFromReference(unwrapped, environment, substitutions, resolvingAliases) {
  const name = typeReferenceName(unwrapped);
  if (name === null)
    return [];
  const substitution = substitutions.get(name);
  if (substitution !== undefined) {
    return isUnappliedReferenceTo(substitution, name) ? [] : dictionaryValueTypes(substitution, environment, substitutions, resolvingAliases);
  }
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined ? [] : dictionaryValueTypes(wrapped, environment, substitutions, resolvingAliases);
  }
  if (name === "Record" && isBuiltIn(name, environment)) {
    const value = unwrapped.typeArguments?.params[1] ?? null;
    return value === null ? [] : [{ type: value, substitutions }];
  }
  if ((name === "Pick" || name === "Omit") && isBuiltIn(name, environment)) {
    const source = unwrapped.typeArguments?.params[0];
    return source === undefined ? [] : dictionaryValueTypes(source, environment, substitutions, resolvingAliases);
  }
  const alias = environment.aliases.get(name);
  if (alias === undefined || resolvingAliases.has(name))
    return [];
  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
  if (nextSubstitutions === null)
    return [];
  const nextResolving = new Set(resolvingAliases);
  nextResolving.add(name);
  return dictionaryValueTypes(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}
function dictionaryValueTypes(type, environment, substitutions, resolvingAliases) {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSTypeLiteral" || unwrapped.type === "TSMappedType") {
    return dictionaryValueFromLiteral(unwrapped, substitutions);
  }
  if (unwrapped.type !== "TSTypeReference")
    return [];
  return dictionaryValueFromReference(unwrapped, environment, substitutions, resolvingAliases);
}
function classifyUnsafeDictionaryValue(valueType, environment) {
  const unsafeValue = unsafeDirectValue(valueType, environment, new Map, new Set);
  return unsafeValue === null ? null : { kind: "unsafe-dictionary", unsafeValue };
}
function classifyUnsafeDictionary(type, environment) {
  for (const valueType of dictionaryValueTypes(type, environment, new Map, new Set)) {
    const unsafeValue = unsafeDirectValue(valueType.type, environment, valueType.substitutions, new Set);
    if (unsafeValue !== null)
      return { kind: "unsafe-dictionary", unsafeValue };
  }
  return null;
}
function resolvesToDictionary(type, environment, substitutions, resolvingAliases) {
  return dictionaryValueTypes(type, environment, substitutions, resolvingAliases).length > 0;
}
function classifyWideningTarget(type, environment) {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSUnknownKeyword")
    return { kind: "unknown" };
  if (unwrapped.type === "TSObjectKeyword")
    return { kind: "object" };
  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.some((member) => member.type === "TSIndexSignature") ? { kind: "open dictionary" } : unwrapped.members.length > 0 ? { kind: "anonymous object" } : null;
  }
  if (unwrapped.type === "TSMappedType")
    return { kind: "open dictionary" };
  if (unwrapped.type !== "TSTypeReference")
    return null;
  const name = typeReferenceName(unwrapped);
  if (name === null)
    return null;
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined ? null : classifyWideningTarget(wrapped, environment);
  }
  if (name === "Record" && isBuiltIn(name, environment))
    return { kind: "open dictionary" };
  const alias = environment.aliases.get(name);
  if (alias === undefined)
    return null;
  if ((alias.typeParameters?.params.length ?? 0) > 0) {
    const substitutions2 = aliasSubstitution(alias, unwrapped, new Map);
    return substitutions2 !== null && resolvesToDictionary(alias.typeAnnotation, environment, substitutions2, new Set([name])) ? { kind: "generic container" } : null;
  }
  const substitutions = aliasSubstitution(alias, unwrapped, new Map);
  if (substitutions === null)
    return null;
  const resolved = classifyAliasBroadTarget(alias.typeAnnotation, environment, substitutions, new Set([name]));
  return resolved;
}
function isBroadMappedKey(type, environment, substitutions) {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSStringKeyword" || unwrapped.type === "TSNumberKeyword" || unwrapped.type === "TSSymbolKeyword") {
    return true;
  }
  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.every((member) => isBroadMappedKey(member, environment, substitutions));
  }
  if (unwrapped.type !== "TSTypeReference")
    return false;
  const name = typeReferenceName(unwrapped);
  if (name === null)
    return false;
  const substitution = substitutions.get(name);
  if (substitution !== undefined && !isUnappliedReferenceTo(substitution, name)) {
    return isBroadMappedKey(substitution, environment, substitutions);
  }
  return name === "PropertyKey" && isBuiltIn(name, environment);
}
function classifyAliasBroadTarget(type, environment, substitutions, resolvingAliases) {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSUnknownKeyword")
    return { kind: "unknown" };
  if (unwrapped.type === "TSObjectKeyword")
    return { kind: "object" };
  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.some((member) => member.type === "TSIndexSignature") ? { kind: "open dictionary" } : null;
  }
  if (unwrapped.type === "TSMappedType") {
    return isBroadMappedKey(unwrapped.constraint, environment, substitutions) ? { kind: "open dictionary" } : null;
  }
  if (unwrapped.type !== "TSTypeReference")
    return null;
  const name = typeReferenceName(unwrapped);
  if (name === null)
    return null;
  const substitution = substitutions.get(name);
  if (substitution !== undefined) {
    return isUnappliedReferenceTo(substitution, name) ? null : classifyAliasBroadTarget(substitution, environment, substitutions, resolvingAliases);
  }
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined ? null : classifyAliasBroadTarget(wrapped, environment, substitutions, resolvingAliases);
  }
  if (name === "Record" && isBuiltIn(name, environment)) {
    return { kind: "open dictionary" };
  }
  const alias = environment.aliases.get(name);
  if (alias === undefined || resolvingAliases.has(name))
    return null;
  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
  if (nextSubstitutions === null)
    return null;
  const nextResolving = new Set(resolvingAliases);
  nextResolving.add(name);
  return classifyAliasBroadTarget(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}
function isKnownEvidenceExpression(expression) {
  let current = expression;
  while (current.type === "ParenthesizedExpression" || current.type === "TSAsExpression" || current.type === "TSTypeAssertion" || current.type === "TSNonNullExpression" || current.type === "TSSatisfiesExpression") {
    current = current.expression;
  }
  if (current.type === "ObjectExpression")
    return true;
  return current.type === "ArrayExpression" || current.type === "ArrowFunctionExpression" || current.type === "ClassExpression" || current.type === "FunctionExpression" || current.type === "NewExpression" || current.type === "Literal" || current.type === "TemplateLiteral" || current.type === "UnaryExpression";
}

// oxlint/anti-slop/shared/reflect-method.ts
function resolveSourceCodeVariable(sourceCode, identifier) {
  let scope = sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined)
      return variable;
    scope = scope.upper;
  }
  return null;
}
function isGlobalReflect(sourceCode, expression) {
  if (expression.type !== "Identifier" || expression.name !== "Reflect")
    return false;
  if (sourceCode.isGlobalReference(expression))
    return true;
  const variable = resolveSourceCodeVariable(sourceCode, expression);
  return variable === null || variable.defs.length === 0;
}
function isGlobalReflectMethodCall(sourceCode, callee, methodName) {
  if (!("property" in callee) || !("object" in callee) || !("computed" in callee))
    return false;
  if (!isGlobalReflect(sourceCode, callee.object))
    return false;
  const property = callee.property;
  return callee.computed ? property.type === "Literal" && property.value === methodName : property.type === "Identifier" && property.name === methodName;
}

// oxlint/anti-slop/rules/no-known-value-widening.ts
function unwrapExpression(expression) {
  let current = expression;
  while (current.type === "ParenthesizedExpression" || current.type === "TSAsExpression" || current.type === "TSSatisfiesExpression" || current.type === "TSTypeAssertion" || current.type === "TSNonNullExpression") {
    current = current.expression;
  }
  return current;
}
function variableDeclarator(variable) {
  if (variable.defs.length !== 1)
    return null;
  const [definition] = variable.defs;
  return definition?.type === "Variable" && definition.node.type === "VariableDeclarator" ? definition.node : null;
}
function isStableConstVariable(variable, declarator) {
  return declarator.parent.type === "VariableDeclaration" && declarator.parent.kind === "const" && variable.references.every((reference) => reference.init || !reference.isWrite());
}
function hasKnownEvidence(sourceCode, expression, visitedVariables = new Set) {
  if (isKnownEvidenceExpression(expression))
    return true;
  const unwrapped = unwrapExpression(expression);
  if (unwrapped.type !== "Identifier")
    return false;
  const variable = resolveSourceCodeVariable(sourceCode, unwrapped);
  if (variable === null || visitedVariables.has(variable))
    return false;
  const declarator = variableDeclarator(variable);
  if (declarator === null || declarator.init === null || !isStableConstVariable(variable, declarator)) {
    return false;
  }
  visitedVariables.add(variable);
  return hasKnownEvidence(sourceCode, declarator.init, visitedVariables);
}
function annotationTarget(annotation, environment) {
  return annotation === null || annotation === undefined ? null : classifyWideningTarget(annotation.typeAnnotation, environment);
}
function enclosingFunction(node) {
  let current = node.parent;
  while (current !== null && current.type !== "Program") {
    if (current.type === "ArrowFunctionExpression" || current.type === "FunctionDeclaration" || current.type === "FunctionExpression") {
      return current;
    }
    current = current.parent;
  }
  return null;
}
function sourceKeyName(sourceCode, key) {
  if (key.type === "Identifier" || key.type === "PrivateIdentifier")
    return key.name;
  if (key.type === "Literal")
    return String(key.value);
  return sourceCode.getText(key);
}
function functionName(sourceCode, owner) {
  if (owner === null)
    return "anonymous function";
  if (owner.id !== null)
    return owner.id.name;
  const parent = owner.parent;
  if (parent.type === "VariableDeclarator" && parent.id.type === "Identifier")
    return parent.id.name;
  if (parent.type === "MethodDefinition")
    return sourceKeyName(sourceCode, parent.key);
  return "anonymous function";
}
function isEmptyObjectExpression2(expression) {
  const unwrapped = unwrapExpression(expression);
  return unwrapped.type === "ObjectExpression" && unwrapped.properties.length === 0;
}
function isDictionaryAccumulatorTarget(destination) {
  return destination.kind === "open dictionary" || destination.kind === "generic container";
}
function hasParentAssertion(node) {
  return node.parent?.type === "TSAsExpression" || node.parent?.type === "TSTypeAssertion";
}
var noKnownValueWideningRule = defineRule4({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow syntactically established values from flowing into explicitly broad or anonymous target types that discard useful evidence."
    },
    messages: {
      widening: "The explicit {{target}} type on {{subject}} discards known type evidence. Keep inference, validate with `satisfies`, or use a named owner contract."
    }
  },
  createOnce(context) {
    let environment = null;
    const reportFlow = (expression, destination, subject) => {
      if (destination === null)
        return;
      if (isDictionaryAccumulatorTarget(destination) && isEmptyObjectExpression2(expression)) {
        return;
      }
      if (!hasKnownEvidence(context.sourceCode, expression))
        return;
      context.report({
        node: expression,
        messageId: "widening",
        data: { subject, target: destination.kind }
      });
    };
    const targetFromAnnotation = (annotation) => environment === null ? null : annotationTarget(annotation, environment);
    return {
      Program(node) {
        environment = createTypeEnvironment(node);
      },
      VariableDeclarator(node) {
        if (node.init === null || node.id.type !== "Identifier")
          return;
        reportFlow(node.init, targetFromAnnotation(node.id.typeAnnotation), `binding \`${node.id.name}\``);
      },
      PropertyDefinition(node) {
        if (node.value === null)
          return;
        reportFlow(node.value, targetFromAnnotation(node.typeAnnotation), `property \`${sourceKeyName(context.sourceCode, node.key)}\``);
      },
      AccessorProperty(node) {
        if (node.value === null)
          return;
        reportFlow(node.value, targetFromAnnotation(node.typeAnnotation), `property \`${sourceKeyName(context.sourceCode, node.key)}\``);
      },
      AssignmentExpression(node) {
        if (node.operator !== "=" || node.left.type !== "Identifier")
          return;
        const variable = resolveSourceCodeVariable(context.sourceCode, node.left);
        if (variable === null)
          return;
        const declarator = variableDeclarator(variable);
        if (declarator === null || declarator.id.type !== "Identifier")
          return;
        reportFlow(node.right, targetFromAnnotation(declarator.id.typeAnnotation), `binding \`${declarator.id.name}\``);
      },
      ReturnStatement(node) {
        if (node.argument === null)
          return;
        const owner = enclosingFunction(node);
        reportFlow(node.argument, targetFromAnnotation(owner?.returnType), `return value of \`${functionName(context.sourceCode, owner)}\``);
      },
      ArrowFunctionExpression(node) {
        if (node.body.type === "BlockStatement")
          return;
        reportFlow(node.body, targetFromAnnotation(node.returnType), `return value of \`${functionName(context.sourceCode, node)}\``);
      },
      TSAsExpression(node) {
        if (environment === null || hasParentAssertion(node))
          return;
        reportFlow(node.expression, classifyWideningTarget(node.typeAnnotation, environment), "assertion");
      },
      TSTypeAssertion(node) {
        if (environment === null || hasParentAssertion(node))
          return;
        reportFlow(node.expression, classifyWideningTarget(node.typeAnnotation, environment), "assertion");
      }
    };
  }
});

// oxlint/anti-slop/rules/no-module-mocking.ts
import { defineRule as defineRule5 } from "@oxlint/plugins";
var moduleMockMethods = new Set(["doMock", "mock", "unstable_mockModule"]);
function importedName(node) {
  if (node.type !== "ImportSpecifier")
    return null;
  return node.imported.type === "Identifier" ? node.imported.name : node.imported.value;
}
function isTestFrameworkObject(sourceCode, expression) {
  if (expression.type !== "Identifier")
    return false;
  if ((expression.name === "vi" || expression.name === "jest") && sourceCode.isGlobalReference(expression)) {
    return true;
  }
  const variable = resolveSourceCodeVariable(sourceCode, expression);
  if (variable === null || variable.defs.length === 0) {
    return expression.name === "vi" || expression.name === "jest";
  }
  return variable.defs.some((definition) => {
    if (definition.type !== "ImportBinding" || definition.parent?.type !== "ImportDeclaration") {
      return false;
    }
    const source = definition.parent.source.value;
    const name = importedName(definition.node);
    return source === "vitest" && name === "vi" || source === "@jest/globals" && name === "jest";
  });
}
function moduleMockCall(sourceCode, callee) {
  if (!("property" in callee) || !("object" in callee) || !("computed" in callee))
    return false;
  if (!isTestFrameworkObject(sourceCode, callee.object))
    return false;
  const property = callee.property;
  const method = callee.computed ? property.type === "Literal" && (property.value === "doMock" || property.value === "mock" || property.value === "unstable_mockModule") ? property.value : null : property.type === "Identifier" ? property.name : null;
  return method !== null && moduleMockMethods.has(method);
}
var noModuleMockingRule = defineRule5({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Vitest and Jest module mocking; tests must replace dependencies through real interfaces."
    },
    messages: {
      moduleMock: "Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression")
          return;
        if (moduleMockCall(context.sourceCode, node.callee)) {
          context.report({ node, messageId: "moduleMock" });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-new-promise.ts
import { defineRule as defineRule6 } from "@oxlint/plugins";
var noNewPromiseRule = defineRule6({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow the Promise constructor executor form; use Promise.withResolvers()."
    },
    messages: {
      newPromise: "Use `Promise.withResolvers()` instead of `new Promise((resolve, reject) => ...)`. Keep the executor only when an API requires that callback shape."
    }
  },
  createOnce(context) {
    return {
      NewExpression(node) {
        if (node.callee.type !== "Identifier" || node.callee.name !== "Promise")
          return;
        context.report({ node, messageId: "newPromise" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-object-parameters.ts
import { defineRule as defineRule7 } from "@oxlint/plugins";

// oxlint/anti-slop/shared/lexical-type-parameters.ts
function isNode(value) {
  return typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
}
function collectInferTypeParameterNames(node, visitorKeys, names) {
  if (node.type === "TSInferType")
    names.add(node.typeParameter.name.name);
  const record = node;
  for (const key of visitorKeys[node.type] ?? []) {
    const value = record[key];
    if (isNode(value)) {
      collectInferTypeParameterNames(value, visitorKeys, names);
      continue;
    }
    if (!Array.isArray(value))
      continue;
    for (const child of value) {
      if (isNode(child))
        collectInferTypeParameterNames(child, visitorKeys, names);
    }
  }
}
function lexicalTypeParameterNames(node, visitorKeys) {
  const names = new Set;
  let descendant = node;
  let current = node;
  while (current !== null && current.type !== "Program") {
    if ("typeParameters" in current) {
      for (const parameter of current.typeParameters?.params ?? []) {
        names.add(parameter.name.name);
      }
    }
    if (current.type === "TSMappedType" && (descendant === current.nameType || descendant === current.typeAnnotation)) {
      names.add(current.key.name);
    }
    if (current.type === "TSConditionalType" && descendant === current.trueType) {
      collectInferTypeParameterNames(current.extendsType, visitorKeys, names);
    }
    descendant = current;
    current = current.parent;
  }
  return names;
}

// oxlint/anti-slop/rules/no-object-parameters.ts
function parameterAnnotation(parameter) {
  if (parameter.type === "TSParameterProperty") {
    return parameterAnnotation(parameter.parameter);
  }
  if (parameter.type === "RestElement") {
    return parameter.typeAnnotation ?? parameterAnnotation(parameter.argument);
  }
  if (parameter.type === "AssignmentPattern") {
    return parameter.typeAnnotation ?? parameter.left.typeAnnotation;
  }
  return parameter.typeAnnotation;
}
function parameterName(parameter, sourceCode) {
  return parameter.type === "Identifier" ? parameter.name : sourceCode.getText(parameter).replace(/\s*:\s*object\s*$/u, "");
}
var noObjectParametersRule = defineRule7({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow object function parameters; inputs must use an owner-provided type and be parsed at their boundary."
    },
    messages: {
      objectParameter: "Parameter `{{parameter}}` uses the broad `object` type. Accept a named owner type; parse external input at its boundary before calling this function."
    }
  },
  createOnce(context) {
    const aliases = new Map;
    const resolvesToObject = (type, shadowedAliases, visited = new Set) => {
      if (type.type === "TSObjectKeyword")
        return true;
      if (type.type === "TSParenthesizedType")
        return resolvesToObject(type.typeAnnotation, shadowedAliases, visited);
      if (type.type === "TSUnionType") {
        return type.types.some((member) => resolvesToObject(member, shadowedAliases, visited));
      }
      if (type.type !== "TSTypeReference" || type.typeName.type !== "Identifier" || type.typeArguments !== null && type.typeArguments !== undefined && type.typeArguments.params.length > 0 || visited.has(type.typeName.name) || shadowedAliases.has(type.typeName.name)) {
        return false;
      }
      const alias = aliases.get(type.typeName.name);
      if (alias === undefined)
        return false;
      const nextVisited = new Set(visited);
      nextVisited.add(type.typeName.name);
      return resolvesToObject(alias, shadowedAliases, nextVisited);
    };
    const checkParameters = (node) => {
      const shadowedAliases = lexicalTypeParameterNames(node, context.sourceCode.visitorKeys);
      for (const parameter of node.params) {
        const annotation = parameterAnnotation(parameter);
        if (annotation === null || annotation === undefined)
          continue;
        if (!resolvesToObject(annotation.typeAnnotation, shadowedAliases))
          continue;
        context.report({
          node: annotation.typeAnnotation,
          messageId: "objectParameter",
          data: { parameter: parameterName(parameter, context.sourceCode) }
        });
      }
    };
    return {
      Program(node) {
        aliases.clear();
        for (const statement of node.body) {
          const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
          if (declaration?.type === "TSTypeAliasDeclaration" && (declaration.typeParameters === null || declaration.typeParameters === undefined)) {
            aliases.set(declaration.id.name, declaration.typeAnnotation);
          }
        }
      },
      ArrowFunctionExpression: checkParameters,
      FunctionDeclaration: checkParameters,
      FunctionExpression: checkParameters,
      TSCallSignatureDeclaration: checkParameters,
      TSConstructSignatureDeclaration: checkParameters,
      TSConstructorType: checkParameters,
      TSDeclareFunction: checkParameters,
      TSEmptyBodyFunctionExpression: checkParameters,
      TSFunctionType: checkParameters,
      TSMethodSignature: checkParameters
    };
  }
});

// oxlint/anti-slop/rules/no-reflect-apply.ts
import { defineRule as defineRule8 } from "@oxlint/plugins";
var noReflectApplyRule = defineRule8({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Reflect.apply; call typed functions directly or model dynamic dispatch behind an interface."
    },
    messages: {
      reflectApply: "Replace `Reflect.apply` with a typed function call. Model dynamic dispatch behind a named interface."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression")
          return;
        if (isGlobalReflectMethodCall(context.sourceCode, node.callee, "apply")) {
          context.report({ node, messageId: "reflectApply" });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-reflect-get.ts
import { defineRule as defineRule9 } from "@oxlint/plugins";
var noReflectGetRule = defineRule9({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Reflect.get; use typed property access or parse dynamic input into a domain type."
    },
    messages: {
      reflectGet: "Replace `Reflect.get` with typed property access. Parse dynamic input into a named domain type before reading it."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression")
          return;
        if (isGlobalReflectMethodCall(context.sourceCode, node.callee, "get")) {
          context.report({ node, messageId: "reflectGet" });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-return-type-utility.ts
import { defineRule as defineRule10 } from "@oxlint/plugins";
var ALLOWED_TYPEOF_QUERIES = new Set([
  "setTimeout",
  "setInterval",
  "setImmediate",
  "window.setTimeout",
  "window.setInterval",
  "window.setImmediate",
  "globalThis.setTimeout",
  "globalThis.setInterval",
  "globalThis.setImmediate",
  "global.setTimeout",
  "global.setInterval",
  "global.setImmediate"
]);
function typeReferenceName2(node) {
  return node.typeName.type === "Identifier" ? node.typeName.name : null;
}
function typeNamePath(node) {
  if (node.type === "Identifier")
    return node.name;
  if (node.type === "ThisExpression")
    return "this";
  if (node.type !== "TSQualifiedName")
    return null;
  const left = typeNamePath(node.left);
  return left === null ? null : `${left}.${node.right.name}`;
}
function typeofQueryPath(type) {
  if (type.type !== "TSTypeQuery")
    return null;
  return typeNamePath(type.exprName);
}
function isAllowedReturnType(node) {
  const argument = node.typeArguments?.params[0];
  if (argument === undefined)
    return false;
  const path = typeofQueryPath(argument);
  if (path !== null && ALLOWED_TYPEOF_QUERIES.has(path))
    return true;
  return argument.type === "TSTypeQuery" && argument.typeArguments !== null && argument.typeArguments !== undefined;
}
var noReturnTypeUtilityRule = defineRule10({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow ReturnType of a concrete function. Name the type at the owner module. Timer handles and generic typeof applications are allowed."
    },
    messages: {
      returnType: "Do not publish a contract as `ReturnType<...>`. Export a named type from the module that owns the value."
    }
  },
  createOnce(context) {
    return {
      TSTypeReference(node) {
        if (typeReferenceName2(node) !== "ReturnType" || isAllowedReturnType(node))
          return;
        context.report({ node, messageId: "returnType" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-runtime-typeof.ts
import { defineRule as defineRule11 } from "@oxlint/plugins";
function isRuntimeFunction(node) {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration" || node.type === "FunctionExpression";
}
function isInsideTypeGuard(node) {
  let current = node.parent;
  while (current !== null && current.type !== "Program") {
    if (isRuntimeFunction(current)) {
      return current.returnType?.typeAnnotation.type === "TSTypePredicate";
    }
    current = current.parent;
  }
  return false;
}
var noRuntimeTypeofRule = defineRule11({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow runtime typeof checks; external values must be decoded into meaningful types at their I/O boundary."
    },
    messages: {
      runtimeTypeof: "A `typeof` check narrows a representation without establishing its contract. Parse input at its I/O boundary, then branch on the domain value."
    },
    schema: [
      {
        type: "object",
        properties: {
          allowInTypeGuards: { type: "boolean" }
        },
        additionalProperties: false
      }
    ],
    defaultOptions: [{ allowInTypeGuards: false }]
  },
  createOnce(context) {
    return {
      UnaryExpression(node) {
        const option = context.options?.[0];
        const allowInTypeGuards = typeof option === "object" && option !== null && !Array.isArray(option) && option.allowInTypeGuards === true;
        if (node.operator === "typeof" && (!allowInTypeGuards || !isInsideTypeGuard(node))) {
          context.report({ node, messageId: "runtimeTypeof" });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-shape-in-symbol-names.ts
import { defineRule as defineRule12 } from "@oxlint/plugins";
var FORBIDDEN_SYMBOL_NAME = "shape";
var GODOT_SHAPE_ALLOWLIST = /^(?:_?mouse_shape_(?:enter|exit)|(?:Collision|Rectangle|Circle|Capsule|Cylinder|Sphere|Box|Segment|SeparationRay|WorldBoundary|ConcavePolygon|ConvexPolygon|HeightMap)?Shape[23]D?|ShapeCast[23]D|shape_owner_.*|result_shape_invalid)$/i;
function containsForbiddenSymbolName(name) {
  return name.toLowerCase().includes(FORBIDDEN_SYMBOL_NAME) && !GODOT_SHAPE_ALLOWLIST.test(name);
}
function identifierName(node) {
  if (!node)
    return null;
  if (node.type === "Identifier" || node.type === "PrivateIdentifier" || node.type === "JSXIdentifier") {
    return node.name;
  }
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  return null;
}
var noForbiddenTermInSymbolNamesRule = defineRule12({
  meta: {
    type: "problem",
    docs: {
      description: 'Disallow the case-insensitive substring "shape" in JavaScript, TypeScript, private, and JSX symbol declarations, except Godot native APIs.'
    },
    messages: {
      forbiddenSymbolName: 'Rename symbol "{{name}}" for its domain role; "shape" describes structure rather than ownership.'
    }
  },
  createOnce(context) {
    const checkIdentifier = (node, name) => {
      if (name === null || !containsForbiddenSymbolName(name))
        return;
      context.report({
        node,
        messageId: "forbiddenSymbolName",
        data: { name }
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
      }
    };
  }
});

// oxlint/anti-slop/rules/no-static-set-map.ts
import { defineRule as defineRule13 } from "@oxlint/plugins";
function unwrapExpression2(expression) {
  let current = expression;
  while (current.type === "ParenthesizedExpression" || current.type === "TSAsExpression" || current.type === "TSTypeAssertion" || current.type === "TSNonNullExpression" || current.type === "TSSatisfiesExpression") {
    current = current.expression;
  }
  return current;
}
function isLiteralKey(node) {
  const unwrapped = unwrapExpression2(node);
  return unwrapped.type === "Literal" && (typeof unwrapped.value === "string" || typeof unwrapped.value === "number") || unwrapped.type === "TemplateLiteral" && unwrapped.expressions.length === 0;
}
function isStaticMapEntry(node) {
  const unwrapped = unwrapExpression2(node);
  if (unwrapped.type !== "ArrayExpression" || unwrapped.elements.length !== 2)
    return false;
  const key = unwrapped.elements[0];
  return key !== null && key.type !== "SpreadElement" && isLiteralKey(key);
}
function isStaticSetArgument(node) {
  const unwrapped = unwrapExpression2(node);
  if (unwrapped.type !== "ArrayExpression" || unwrapped.elements.length === 0)
    return false;
  return unwrapped.elements.every((element) => element !== null && element.type !== "SpreadElement" && isLiteralKey(element));
}
function isStaticMapArgument(node) {
  const unwrapped = unwrapExpression2(node);
  if (unwrapped.type !== "ArrayExpression" || unwrapped.elements.length === 0)
    return false;
  return unwrapped.elements.every((element) => element !== null && element.type !== "SpreadElement" && isStaticMapEntry(element));
}
function collectionName(callee) {
  return callee.type === "Identifier" && (callee.name === "Set" || callee.name === "Map") ? callee.name : null;
}
var noStaticSetMapRule = defineRule13({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Set/Map constructed from a static literal table; use Record for fixed string/number keys."
    },
    messages: {
      staticCollection: "This `{{name}}` is a static literal table. Use `Record<K, V>` / `Record<K, true>` and keep Set/Map for runtime insertion, non-string keys, or iterator APIs."
    }
  },
  createOnce(context) {
    return {
      NewExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression")
          return;
        const name = collectionName(node.callee);
        if (name === null)
          return;
        const argument = node.arguments[0];
        if (argument === undefined || argument.type === "SpreadElement")
          return;
        const unwrappedArgument = unwrapExpression2(argument);
        const staticTable = name === "Set" ? isStaticSetArgument(unwrappedArgument) : isStaticMapArgument(unwrappedArgument);
        if (!staticTable)
          return;
        context.report({ node, messageId: "staticCollection", data: { name } });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-string-discriminant.ts
import { defineRule as defineRule14 } from "@oxlint/plugins";
var BOOLEAN_STATE = new Set(["loading", "isLoading", "completed", "success", "hasError"]);
var STRING_DISCRIMINANT = new Set(["kind", "status"]);
function propertyName(node) {
  if (node.computed || node.key.type !== "Identifier")
    return null;
  return node.key.name;
}
function unwrapType(type) {
  let current = type;
  while (current.type === "TSParenthesizedType" || current.type === "TSTypeOperator" && current.operator === "readonly") {
    current = current.typeAnnotation;
  }
  return current;
}
function annotation(node) {
  return node.typeAnnotation?.typeAnnotation ?? null;
}
function isBoolean(type) {
  return unwrapType(type).type === "TSBooleanKeyword";
}
function isBareString(type) {
  return unwrapType(type).type === "TSStringKeyword";
}
var noStringDiscriminantRule = defineRule14({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow optional-state booleans and string discriminants on type properties. Use a literal-tagged union."
    },
    messages: {
      booleanState: "Property `{{name}}: boolean` is a state bag. Model variants as a discriminated union with a literal tag.",
      stringDiscriminant: 'Property `{{name}}: string` is not a discriminant. Use a literal union (`"func" | "signal"`) or a named alias of one.'
    }
  },
  createOnce(context) {
    const checkProperty = (node) => {
      const name = propertyName(node);
      const type = annotation(node);
      if (name === null || type === null)
        return;
      if (BOOLEAN_STATE.has(name) && isBoolean(type)) {
        context.report({ node: node.key, messageId: "booleanState", data: { name } });
        return;
      }
      if (STRING_DISCRIMINANT.has(name) && isBareString(type)) {
        context.report({ node: node.key, messageId: "stringDiscriminant", data: { name } });
      }
    };
    return {
      TSPropertySignature: checkProperty,
      PropertyDefinition: checkProperty
    };
  }
});

// oxlint/anti-slop/rules/no-string-id-alias.ts
import { defineRule as defineRule15 } from "@oxlint/plugins";
var ALIAS = /(?:Id|Email|Slug)$/u;
function unwrapType2(type) {
  let current = type;
  while (current.type === "TSParenthesizedType" || current.type === "TSTypeOperator" && current.operator === "readonly") {
    current = current.typeAnnotation;
  }
  return current;
}
function isPrimitiveAlias(type) {
  const unwrapped = unwrapType2(type);
  if (unwrapped.type === "TSStringKeyword" || unwrapped.type === "TSNumberKeyword")
    return true;
  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.length > 0 && unwrapped.types.every((member) => isPrimitiveAlias(member));
  }
  return false;
}
var noStringIdAliasRule = defineRule15({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow type aliases that rename string/number as an Id, Email, or Slug without branding."
    },
    messages: {
      stringIdAlias: 'Alias `{{name}}` is still a bare string/number. Brand it (`T & { readonly __brand: "{{name}}" }`) and validate in a constructor.'
    }
  },
  createOnce(context) {
    return {
      TSTypeAliasDeclaration(node) {
        if (!ALIAS.test(node.id.name) || !isPrimitiveAlias(node.typeAnnotation))
          return;
        context.report({
          node: node.id,
          messageId: "stringIdAlias",
          data: { name: node.id.name }
        });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-tiny-functions.ts
import { defineRule as defineRule16 } from "@oxlint/plugins";
function isFunctionNode(node) {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration" || node.type === "FunctionExpression";
}
function unwrapParenthesizedAncestor(node) {
  let current = node;
  let parent = node.parent;
  while (parent.type === "ParenthesizedExpression" && parent.expression === current) {
    current = parent;
    parent = parent.parent;
  }
  return { current, parent };
}
function isExportDeclaration(node) {
  return node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration";
}
function isExported(node) {
  const { current, parent } = unwrapParenthesizedAncestor(node);
  if (isExportDeclaration(parent))
    return true;
  if (parent.type !== "VariableDeclarator" || parent.init !== current)
    return false;
  const declaration = parent.parent;
  return declaration.type === "VariableDeclaration" && isExportDeclaration(declaration.parent);
}
function isTypeGuard(node) {
  return node.returnType?.typeAnnotation.type === "TSTypePredicate";
}
function isMethod(node) {
  const parent = node.parent;
  return parent.type === "MethodDefinition" || parent.type === "TSMethodSignature" || parent.type === "Property" && parent.method;
}
function isCallback(node) {
  const { current, parent } = unwrapParenthesizedAncestor(node);
  if (parent.type === "CallExpression" || parent.type === "NewExpression") {
    return parent.arguments.some((argument) => argument === current);
  }
  if (parent.type === "JSXExpressionContainer") {
    return true;
  }
  return parent.type === "Property" && parent.value === current && !parent.method;
}
function returnedExpression(node) {
  if (node.type === "ArrowFunctionExpression" && node.expression)
    return node.body;
  const body = node.body;
  if (body.type !== "BlockStatement" || body.body.length !== 1)
    return null;
  const statement = body.body[0];
  return statement?.type === "ReturnStatement" ? statement.argument : null;
}
function isTrivialExpression(node) {
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
function isTinyBody(node) {
  const expression = returnedExpression(node);
  return expression !== null && isTrivialExpression(expression);
}
function functionName2(node) {
  if (node.type !== "ArrowFunctionExpression" && node.id !== null)
    return node.id.name;
  if (node.parent.type === "VariableDeclarator" && node.parent.id.type === "Identifier") {
    return node.parent.id.name;
  }
  return null;
}
function isNamedContract(name) {
  return name !== null && /^(?:is|has|assert|as|to|from)[A-Z]/.test(name);
}
var noTinyFunctionsRule = defineRule16({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow functions whose whole body is one returned expression, unless they are the exported binding, a type guard, a method, a callback, or a named is/has/assert/as/to/from contract."
    },
    messages: {
      tinyFunction: "This function only wraps one expression. Inline it unless the name is a public contract, type guard, callback, or method."
    }
  },
  createOnce(context) {
    const check = (node) => {
      if (!isFunctionNode(node) || !isTinyBody(node))
        return;
      if (isExported(node) || isTypeGuard(node) || isMethod(node) || isCallback(node))
        return;
      if (isNamedContract(functionName2(node)))
        return;
      context.report({ node, messageId: "tinyFunction" });
    };
    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check
    };
  }
});

// oxlint/anti-slop/rules/no-typescript-enum.ts
import { defineRule as defineRule17 } from "@oxlint/plugins";
function importedName2(node) {
  if (node.type !== "ImportSpecifier")
    return null;
  return node.imported.type === "Identifier" ? node.imported.name : String(node.imported.value);
}
var noTypescriptEnumRule = defineRule17({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow TypeScript enum declarations and React.FC; use a literal union and a plain function."
    },
    messages: {
      typescriptEnum: "Do not declare a TypeScript enum. Use a string or number literal union, or `as const` on an object.",
      reactFc: "Do not type a component as `React.FC`. Use a plain function that takes a named props type."
    }
  },
  createOnce(context) {
    const reactImports = new Set;
    return {
      Program(node) {
        reactImports.clear();
        for (const statement of node.body) {
          if (statement.type === "ImportDeclaration" && (statement.source.value === "react" || statement.source.value === "preact" || statement.source.value === "react/jsx-runtime")) {
            for (const specifier of statement.specifiers) {
              if (specifier.type === "ImportSpecifier") {
                const name = importedName2(specifier);
                if (name === "FC" || name === "FunctionComponent") {
                  reactImports.add(specifier.local.name);
                }
              }
            }
          }
        }
      },
      TSEnumDeclaration(node) {
        context.report({ node, messageId: "typescriptEnum" });
      },
      TSTypeReference(node) {
        const name = node.typeName;
        if (name.type === "TSQualifiedName" && name.left.type === "Identifier" && (name.left.name === "React" || name.left.name === "Preact") && name.right.type === "Identifier" && (name.right.name === "FC" || name.right.name === "FunctionComponent")) {
          context.report({ node, messageId: "reactFc" });
          return;
        }
        if (name.type === "Identifier" && (reactImports.has(name.name) || name.name === "FC" || name.name === "FunctionComponent")) {
          context.report({ node, messageId: "reactFc" });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-unknown-parameters.ts
import { defineRule as defineRule18 } from "@oxlint/plugins";
function parameterAnnotation2(parameter) {
  if (parameter.type === "TSParameterProperty") {
    return parameterAnnotation2(parameter.parameter);
  }
  if (parameter.type === "RestElement") {
    return parameter.typeAnnotation ?? parameterAnnotation2(parameter.argument);
  }
  if (parameter.type === "AssignmentPattern") {
    return parameter.typeAnnotation ?? parameter.left.typeAnnotation;
  }
  return parameter.typeAnnotation;
}
function parameterName2(parameter, sourceText) {
  if (parameter.type === "TSParameterProperty") {
    return parameterName2(parameter.parameter, sourceText);
  }
  if (parameter.type === "AssignmentPattern") {
    return parameterName2(parameter.left, sourceText);
  }
  if (parameter.type === "RestElement") {
    return parameterName2(parameter.argument, sourceText);
  }
  return parameter.type === "Identifier" ? parameter.name : sourceText.replace(/\s*:\s*unknown\s*$/u, "");
}
var ALLOWED_UNKNOWN_NAMES = new Set([
  "cause",
  "raw",
  "input",
  "untrusted",
  "unparsed",
  "wire",
  "payload"
]);
function isTypeGuard2(node) {
  if (node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "TSDeclareFunction" || node.type === "TSFunctionType" || node.type === "TSMethodSignature" || node.type === "TSCallSignatureDeclaration" || node.type === "TSEmptyBodyFunctionExpression") {
    return node.returnType?.typeAnnotation.type === "TSTypePredicate";
  }
  return false;
}
var noUnknownParametersRule = defineRule18({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow explicitly unknown function parameters except type guards, parser boundary inputs, and `cause`."
    },
    messages: {
      unknownParameter: "Parameter `{{parameter}}` leaves input unparsed. Accept a named domain type; run the expected schema or parser at the I/O boundary before calling this function."
    }
  },
  createOnce(context) {
    const checkParameters = (node) => {
      if (isTypeGuard2(node))
        return;
      for (const parameter of node.params) {
        const annotation2 = parameterAnnotation2(parameter);
        if (annotation2?.typeAnnotation.type !== "TSUnknownKeyword")
          continue;
        const name = parameterName2(parameter, context.sourceCode.getText(parameter));
        if (ALLOWED_UNKNOWN_NAMES.has(name.toLowerCase()))
          continue;
        context.report({
          node: annotation2.typeAnnotation,
          messageId: "unknownParameter",
          data: { parameter: name }
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
      TSMethodSignature: checkParameters
    };
  }
});

// oxlint/anti-slop/rules/no-unknown-returns.ts
import { defineRule as defineRule19 } from "@oxlint/plugins";
function referencedAliasName(type) {
  if (type.type === "TSParenthesizedType")
    return referencedAliasName(type.typeAnnotation);
  if (type.type !== "TSTypeReference" || type.typeName.type !== "Identifier")
    return null;
  return type.typeArguments === null || type.typeArguments === undefined || type.typeArguments.params.length === 0 ? type.typeName.name : null;
}
var noUnknownReturnsRule = defineRule19({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow functions whose explicit return contract is unknown or Promise<unknown>."
    },
    messages: {
      unknownReturn: "This function exposes `unknown` to its caller. Parse the value at its boundary and return a named domain type."
    }
  },
  createOnce(context) {
    const aliases = new Map;
    const resolvesToUnknown = (type, shadowedAliases, visited = new Set) => {
      if (type.type === "TSUnknownKeyword")
        return true;
      if (type.type === "TSParenthesizedType") {
        return resolvesToUnknown(type.typeAnnotation, shadowedAliases, visited);
      }
      if (type.type === "TSUnionType") {
        return type.types.some((member) => resolvesToUnknown(member, shadowedAliases, visited));
      }
      if (type.type === "TSTypeReference" && type.typeName.type === "Identifier" && (type.typeName.name === "Promise" || type.typeName.name === "PromiseLike")) {
        const value = type.typeArguments?.params[0];
        return value !== undefined && resolvesToUnknown(value, shadowedAliases, visited);
      }
      const name = referencedAliasName(type);
      if (name === null || visited.has(name) || shadowedAliases.has(name))
        return false;
      const alias = aliases.get(name);
      if (alias === undefined || alias.typeParameters !== null && alias.typeParameters !== undefined) {
        return false;
      }
      const nextVisited = new Set(visited);
      nextVisited.add(name);
      return resolvesToUnknown(alias.typeAnnotation, shadowedAliases, nextVisited);
    };
    const checkReturnType = (node) => {
      const annotation2 = node.returnType;
      if (annotation2 === null || annotation2 === undefined)
        return;
      if (!resolvesToUnknown(annotation2.typeAnnotation, lexicalTypeParameterNames(node, context.sourceCode.visitorKeys))) {
        return;
      }
      context.report({ node: annotation2.typeAnnotation, messageId: "unknownReturn" });
    };
    return {
      Program(node) {
        aliases.clear();
        for (const statement of node.body) {
          const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
          if (declaration?.type === "TSTypeAliasDeclaration") {
            aliases.set(declaration.id.name, declaration);
          }
        }
      },
      ArrowFunctionExpression: checkReturnType,
      FunctionDeclaration: checkReturnType,
      FunctionExpression: checkReturnType,
      TSCallSignatureDeclaration: checkReturnType,
      TSConstructSignatureDeclaration: checkReturnType,
      TSConstructorType: checkReturnType,
      TSDeclareFunction: checkReturnType,
      TSEmptyBodyFunctionExpression: checkReturnType,
      TSFunctionType: checkReturnType,
      TSMethodSignature: checkReturnType
    };
  }
});

// oxlint/anti-slop/rules/no-unknown-type-aliases.ts
import { defineRule as defineRule20 } from "@oxlint/plugins";
function referencedAliasName2(type) {
  if (type.type === "TSParenthesizedType")
    return referencedAliasName2(type.typeAnnotation);
  if (type.type !== "TSTypeReference" || type.typeName.type !== "Identifier")
    return null;
  return type.typeArguments === null || type.typeArguments === undefined || type.typeArguments.params.length === 0 ? type.typeName.name : null;
}
var noUnknownTypeAliasesRule = defineRule20({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow type aliases whose resolved type is unknown; unknown must remain visible at an allowed boundary."
    },
    messages: {
      unknownAlias: "Type alias `{{alias}}` hides `unknown`. Keep `unknown` explicit at the parsing boundary or on an allowed `cause` field; otherwise use the parsed owner type."
    }
  },
  createOnce(context) {
    const aliases = new Map;
    const resolvesToUnknown = (type, visited = new Set) => {
      if (type.type === "TSUnknownKeyword")
        return true;
      if (type.type === "TSParenthesizedType")
        return resolvesToUnknown(type.typeAnnotation, visited);
      const name = referencedAliasName2(type);
      if (name === null || visited.has(name))
        return false;
      const alias = aliases.get(name);
      if (alias === undefined || alias.typeParameters !== null && alias.typeParameters !== undefined) {
        return false;
      }
      const nextVisited = new Set(visited);
      nextVisited.add(name);
      return resolvesToUnknown(alias.typeAnnotation, nextVisited);
    };
    return {
      Program(node) {
        aliases.clear();
        for (const statement of node.body) {
          const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
          if (declaration?.type === "TSTypeAliasDeclaration") {
            aliases.set(declaration.id.name, declaration);
          }
        }
        for (const alias of aliases.values()) {
          if (!resolvesToUnknown(alias.typeAnnotation, new Set([alias.id.name])))
            continue;
          context.report({
            node: alias.id,
            messageId: "unknownAlias",
            data: { alias: alias.id.name }
          });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-unsafe-dictionary-type.ts
import { defineRule as defineRule21 } from "@oxlint/plugins";
var typeNodeKinds = new Set([
  "JSDocNonNullableType",
  "JSDocNullableType",
  "JSDocUnknownType",
  "TSAnyKeyword",
  "TSArrayType",
  "TSBigIntKeyword",
  "TSBooleanKeyword",
  "TSConditionalType",
  "TSConstructorType",
  "TSFunctionType",
  "TSImportType",
  "TSIndexedAccessType",
  "TSInferType",
  "TSIntersectionType",
  "TSIntrinsicKeyword",
  "TSLiteralType",
  "TSMappedType",
  "TSNamedTupleMember",
  "TSNeverKeyword",
  "TSNullKeyword",
  "TSNumberKeyword",
  "TSObjectKeyword",
  "TSParenthesizedType",
  "TSStringKeyword",
  "TSSymbolKeyword",
  "TSTemplateLiteralType",
  "TSThisType",
  "TSTupleType",
  "TSTypeLiteral",
  "TSTypeOperator",
  "TSTypePredicate",
  "TSTypeQuery",
  "TSTypeReference",
  "TSUndefinedKeyword",
  "TSUnionType",
  "TSUnknownKeyword",
  "TSVoidKeyword"
]);
function isTypeNode(node) {
  return typeNodeKinds.has(node.type);
}
function typeReferenceName3(type) {
  return type.typeName.type === "Identifier" ? type.typeName.name : null;
}
function isInsideTypeAliasDeclaration(node) {
  let current = node.parent;
  while (current !== null && current.type !== "Program") {
    if (current.type === "TSTypeAliasDeclaration")
      return true;
    current = current.parent;
  }
  return false;
}
function isPlainAliasConsumerUse(node, environment) {
  if (node.type !== "TSTypeReference" || node.typeArguments?.params.length)
    return false;
  const name = typeReferenceName3(node);
  return name !== null && environment.aliases.has(name) && !isInsideTypeAliasDeclaration(node);
}
function shouldReportType(node, environment) {
  if (isPlainAliasConsumerUse(node, environment))
    return false;
  if (classifyUnsafeDictionary(node, environment) === null)
    return false;
  let current = node.parent;
  while (current !== null && current.type !== "Program") {
    if (isTypeNode(current) && classifyUnsafeDictionary(current, environment) !== null)
      return false;
    current = current.parent;
  }
  return true;
}
var noUnsafeDictionaryTypeRule = defineRule21({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow object-dictionary contracts whose direct value type is unknown, any, object, {}, or a union/alias containing one of those escape hatches."
    },
    messages: {
      unsafeDictionary: "This dictionary's {{value}} value type gives callers no concrete value contract. Use an owner/schema-derived value type; parse external payloads before insertion."
    }
  },
  createOnce(context) {
    let environment = null;
    const report = (node, value) => {
      context.report({ node, messageId: "unsafeDictionary", data: { value } });
    };
    const reportIfUnsafe = (node) => {
      if (environment === null || !shouldReportType(node, environment))
        return;
      const unsafe = classifyUnsafeDictionary(node, environment);
      if (unsafe === null)
        return;
      report(node, unsafe.unsafeValue);
    };
    return {
      Program(node) {
        environment = createTypeEnvironment(node);
      },
      TSTypeReference: reportIfUnsafe,
      TSTypeLiteral: reportIfUnsafe,
      TSMappedType: reportIfUnsafe,
      TSIndexSignature(node) {
        if (environment === null || node.typeAnnotation === null || node.parent.type === "TSTypeLiteral")
          return;
        const unsafe = classifyUnsafeDictionaryValue(node.typeAnnotation.typeAnnotation, environment);
        if (unsafe !== null)
          report(node, unsafe.unsafeValue);
      }
    };
  }
});

// oxlint/anti-slop/rules/no-unused-catch-binding.ts
import { defineRule as defineRule22 } from "@oxlint/plugins";
var noUnusedCatchBindingRule = defineRule22({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow underscore-prefixed catch bindings; use a bare catch clause instead."
    },
    messages: {
      unusedCatch: "This catch binding is unused. Write `catch {` when the error value is discarded."
    }
  },
  createOnce(context) {
    return {
      CatchClause(node) {
        const param = node.param;
        if (param === null || param === undefined || param.type !== "Identifier")
          return;
        if (!param.name.startsWith("_"))
          return;
        context.report({ node: param, messageId: "unusedCatch" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-widen-then-assert.ts
import { defineRule as defineRule23 } from "@oxlint/plugins";
var functionBoundaryTypes = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "TSDeclareFunction",
  "TSEmptyBodyFunctionExpression"
]);
function unwrapExpressionParentheses(expression) {
  let current = expression;
  while (current.type === "ParenthesizedExpression")
    current = current.expression;
  return current;
}
function unwrapTypeParentheses(type) {
  let current = type;
  while (current.type === "TSParenthesizedType")
    current = current.typeAnnotation;
  return current;
}
function typeReferenceName4(type) {
  return type.typeName.type === "Identifier" ? type.typeName.name : null;
}
function isUnknownOrAnyType(type) {
  const unwrapped = unwrapTypeParentheses(type);
  return unwrapped.type === "TSUnknownKeyword" || unwrapped.type === "TSAnyKeyword";
}
function isBroadRecordKeyType(type) {
  const unwrapped = unwrapTypeParentheses(type);
  if (unwrapped.type === "TSStringKeyword" || unwrapped.type === "TSNumberKeyword" || unwrapped.type === "TSSymbolKeyword") {
    return true;
  }
  if (unwrapped.type === "TSUnionType")
    return unwrapped.types.every(isBroadRecordKeyType);
  return unwrapped.type === "TSTypeReference" && typeReferenceName4(unwrapped) === "PropertyKey";
}
function isBroadRecordType(type) {
  const unwrapped = unwrapTypeParentheses(type);
  if (unwrapped.type === "TSTypeReference") {
    if (typeReferenceName4(unwrapped) === "Readonly") {
      const [inner] = unwrapped.typeArguments?.params ?? [];
      return inner !== undefined && isBroadRecordType(inner);
    }
    if (typeReferenceName4(unwrapped) !== "Record")
      return false;
    const parameters = unwrapped.typeArguments?.params ?? [];
    return parameters.length === 2 && parameters[0] !== undefined && parameters[1] !== undefined && isBroadRecordKeyType(parameters[0]) && isUnknownOrAnyType(parameters[1]);
  }
  if (unwrapped.type !== "TSTypeLiteral" || unwrapped.members.length !== 1)
    return false;
  const [member] = unwrapped.members;
  const [parameter] = member?.type === "TSIndexSignature" ? member.parameters : [];
  return member?.type === "TSIndexSignature" && member.parameters.length === 1 && parameter !== undefined && isBroadRecordKeyType(parameter.typeAnnotation.typeAnnotation) && isUnknownOrAnyType(member.typeAnnotation.typeAnnotation);
}
function broadTypeKind(type) {
  const unwrapped = unwrapTypeParentheses(type);
  if (unwrapped.type === "TSUnknownKeyword" || unwrapped.type === "TSAnyKeyword")
    return "top";
  if (unwrapped.type === "TSObjectKeyword")
    return "object";
  return isBroadRecordType(unwrapped) ? "record" : null;
}
function assertedExpression(node) {
  return unwrapExpressionParentheses(node.expression);
}
function assertionFromExpression(expression) {
  const unwrapped = unwrapExpressionParentheses(expression);
  return unwrapped.type === "TSAsExpression" || unwrapped.type === "TSTypeAssertion" ? unwrapped : null;
}
function normalizedTypeText(sourceText, type) {
  return sourceText.slice(type.start, type.end).replaceAll(/\s+/gu, "");
}
function typesHaveSameSyntax(sourceText, left, right) {
  return left !== null && normalizedTypeText(sourceText, unwrapTypeParentheses(left)) === normalizedTypeText(sourceText, unwrapTypeParentheses(right));
}
function isDefinitelyObjectType(type) {
  const unwrapped = unwrapTypeParentheses(type);
  switch (unwrapped.type) {
    case "TSArrayType":
    case "TSConstructorType":
    case "TSFunctionType":
    case "TSMappedType":
    case "TSObjectKeyword":
    case "TSTupleType":
      return true;
    case "TSTypeLiteral":
      return unwrapped.members.length > 0;
    case "TSIntersectionType":
      return unwrapped.types.every(isDefinitelyObjectType);
    case "TSTypeOperator":
      return unwrapped.operator === "readonly" && isDefinitelyObjectType(unwrapped.typeAnnotation);
    default:
      return false;
  }
}
function isDefinitelyNarrowerRecordType(type) {
  const unwrapped = unwrapTypeParentheses(type);
  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.some((member) => member.type !== "TSIndexSignature");
  }
  if (unwrapped.type !== "TSTypeReference")
    return false;
  if (typeReferenceName4(unwrapped) === "Readonly") {
    const [inner] = unwrapped.typeArguments?.params ?? [];
    return inner !== undefined && isDefinitelyNarrowerRecordType(inner);
  }
  if (typeReferenceName4(unwrapped) !== "Record")
    return false;
  const parameters = unwrapped.typeArguments?.params ?? [];
  return parameters.length === 2 && parameters[1] !== undefined && !isUnknownOrAnyType(parameters[1]);
}
function functionBoundary(node) {
  let current = node.parent;
  while (current !== null && current.type !== "Program") {
    if (functionBoundaryTypes.has(current.type))
      return current;
    current = current.parent;
  }
  return null;
}
function variableDeclarator2(variable) {
  for (const definition of variable.defs) {
    if (definition.type === "Variable" && definition.node.type === "VariableDeclarator") {
      return definition.node;
    }
  }
  return null;
}
function knownValueFromIdentifier(identifier, sourceCode, boundary, visitedVariables) {
  const variable = resolveSourceCodeVariable(sourceCode, identifier);
  if (variable === null || visitedVariables.has(variable))
    return null;
  const annotatedIdentifier = variable.identifiers.find((item) => item.typeAnnotation !== null && item.typeAnnotation !== undefined);
  const annotation2 = annotatedIdentifier?.typeAnnotation?.typeAnnotation;
  if (annotation2 !== undefined && annotatedIdentifier !== undefined) {
    if (functionBoundary(annotatedIdentifier) !== boundary || broadTypeKind(annotation2) !== null) {
      return null;
    }
    return { type: annotation2 };
  }
  const declarator = variableDeclarator2(variable);
  if (declarator === null || declarator.parent.type !== "VariableDeclaration" || declarator.parent.kind !== "const" || declarator.init === null || variable.references.some((reference) => reference.isWrite() && !reference.init) || functionBoundary(declarator) !== boundary) {
    return null;
  }
  return knownValueEvidence(declarator.init, sourceCode, boundary, new Set([...visitedVariables, variable]));
}
function knownValueEvidence(expression, sourceCode, boundary, visitedVariables) {
  const unwrapped = unwrapExpressionParentheses(expression);
  if (unwrapped.type === "TSAsExpression" || unwrapped.type === "TSTypeAssertion") {
    if (broadTypeKind(unwrapped.typeAnnotation) !== null)
      return null;
    return { type: unwrapped.typeAnnotation };
  }
  if (unwrapped.type === "Literal" || unwrapped.type === "TemplateLiteral") {
    return { type: null };
  }
  if (unwrapped.type === "ArrayExpression" || unwrapped.type === "ArrowFunctionExpression" || unwrapped.type === "ClassExpression" || unwrapped.type === "FunctionExpression" || unwrapped.type === "NewExpression" || unwrapped.type === "ObjectExpression") {
    return { type: null };
  }
  if (unwrapped.type !== "Identifier")
    return null;
  return knownValueFromIdentifier(unwrapped, sourceCode, boundary, visitedVariables);
}
function widenedBinding(variable, sourceCode) {
  const declarator = variableDeclarator2(variable);
  if (declarator === null || declarator.parent.type !== "VariableDeclaration" || declarator.parent.kind !== "const" || declarator.id.type !== "Identifier" || declarator.init === null || variable.references.some((reference) => reference.isWrite() && !reference.init)) {
    return null;
  }
  const boundary = functionBoundary(declarator);
  const declaredType = declarator.id.typeAnnotation?.typeAnnotation;
  const initializerAssertion = assertionFromExpression(declarator.init);
  const initializerBroadKind = initializerAssertion === null ? null : broadTypeKind(initializerAssertion.typeAnnotation);
  const declaredBroadKind = declaredType === undefined ? null : broadTypeKind(declaredType);
  const broadKind = declaredBroadKind ?? initializerBroadKind;
  if (broadKind === null)
    return null;
  const originalExpression = initializerAssertion !== null && initializerBroadKind !== null ? assertedExpression(initializerAssertion) : declarator.init;
  const evidence = knownValueEvidence(originalExpression, sourceCode, boundary, new Set([variable]));
  return evidence === null ? null : { broadKind, evidence, declaredAt: declarator.end, boundary };
}
function assertionIsNarrower(sourceText, broadKind, evidence, assertedType) {
  if (broadTypeKind(assertedType) !== null)
    return false;
  if (broadKind === "top")
    return true;
  if (typesHaveSameSyntax(sourceText, evidence.type, assertedType))
    return true;
  if (broadKind === "object")
    return isDefinitelyObjectType(assertedType);
  return isDefinitelyNarrowerRecordType(assertedType);
}
var noWidenThenAssertRule = defineRule23({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow local const flows that explicitly widen a known value before asserting the widened binding to a narrower type."
    },
    messages: {
      widenThenAssert: 'Binding "{{name}}" discards type evidence and later recreates it with an assertion. Keep the precise type from initialization through use; parse boundary input once.'
    }
  },
  createOnce(context) {
    const checkAssertion = (node) => {
      const expression = assertedExpression(node);
      if (expression.type !== "Identifier")
        return;
      const variable = resolveSourceCodeVariable(context.sourceCode, expression);
      if (variable === null)
        return;
      const widened = widenedBinding(variable, context.sourceCode);
      if (widened === null || node.start <= widened.declaredAt || functionBoundary(node) !== widened.boundary || !assertionIsNarrower(context.sourceCode.text, widened.broadKind, widened.evidence, node.typeAnnotation)) {
        return;
      }
      context.report({
        node,
        messageId: "widenThenAssert",
        data: { name: expression.name }
      });
    };
    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion
    };
  }
});

// oxlint/anti-slop/rules/require-safety-comment-for-type-assertion.ts
import { defineRule as defineRule24 } from "@oxlint/plugins";
var commentOwnerKinds = new Set([
  "ExpressionStatement",
  "PropertyDefinition",
  "ReturnStatement",
  "ThrowStatement",
  "VariableDeclaration"
]);
function isConstAssertion2(node) {
  return node.typeAnnotation.type === "TSTypeReference" && node.typeAnnotation.typeName.type === "Identifier" && node.typeAnnotation.typeName.name === "const";
}
function hasSafetyComment(sourceCode, node) {
  let current = node;
  while (current !== null && current.type !== "Program") {
    if (sourceCode.getCommentsBefore(current).some((comment) => comment.end <= node.start && /\bSAFETY\s*:/u.test(comment.value))) {
      return true;
    }
    if (current.type === "ExportNamedDeclaration" || current.type === "ExportDefaultDeclaration") {
      return false;
    }
    if (commentOwnerKinds.has(current.type)) {
      const parent = current.parent;
      if (parent?.type === "ExportNamedDeclaration" || parent?.type === "ExportDefaultDeclaration") {
        current = parent;
        continue;
      }
      return false;
    }
    current = current.parent;
  }
  return false;
}
var requireSafetyCommentForTypeAssertionRule = defineRule24({
  meta: {
    type: "problem",
    docs: {
      description: "Require a nearby SAFETY comment for every TypeScript type assertion except const assertions."
    },
    messages: {
      missingSafetyComment: "This type assertion has no `SAFETY:` justification. State the checked invariant immediately before the assertion or its containing statement."
    }
  },
  createOnce(context) {
    const checkAssertion = (node) => {
      if (isConstAssertion2(node) || hasSafetyComment(context.sourceCode, node))
        return;
      context.report({ node, messageId: "missingSafetyComment" });
    };
    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion
    };
  }
});

// oxlint/anti-slop/index.ts
var antiSlopPlugin = eslintCompatPlugin({
  meta: { name: "anti-slop" },
  rules: {
    "no-chained-type-assertions": noChainedTypeAssertionsRule,
    "no-conditional-empty-object-spread": noConditionalEmptyObjectSpreadRule,
    "no-inline-cast-access": noInlineCastAccessRule,
    "no-known-value-widening": noKnownValueWideningRule,
    "no-module-mocking": noModuleMockingRule,
    "no-new-promise": noNewPromiseRule,
    "no-object-parameters": noObjectParametersRule,
    "no-reflect-apply": noReflectApplyRule,
    "no-reflect-get": noReflectGetRule,
    "no-return-type-utility": noReturnTypeUtilityRule,
    "no-runtime-typeof": noRuntimeTypeofRule,
    "no-static-set-map": noStaticSetMapRule,
    "no-string-discriminant": noStringDiscriminantRule,
    "no-string-id-alias": noStringIdAliasRule,
    "no-tiny-functions": noTinyFunctionsRule,
    "no-typescript-enum": noTypescriptEnumRule,
    "no-unused-catch-binding": noUnusedCatchBindingRule,
    "no-unsafe-dictionary-type": noUnsafeDictionaryTypeRule,
    "no-shape-in-symbol-names": noForbiddenTermInSymbolNamesRule,
    "no-unknown-parameters": noUnknownParametersRule,
    "no-unknown-returns": noUnknownReturnsRule,
    "no-unknown-type-aliases": noUnknownTypeAliasesRule,
    "no-widen-then-assert": noWidenThenAssertRule,
    "require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertionRule
  }
});
var anti_slop_default = antiSlopPlugin;
export {
  anti_slop_default as default
};
