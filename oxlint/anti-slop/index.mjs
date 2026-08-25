// oxlint/anti-slop/index.ts
import { eslintCompatPlugin } from "@oxlint/plugins";

// oxlint/anti-slop/rules/no-async-context-enter-with.ts
import { defineRule } from "@oxlint/plugins";
var noAsyncContextEnterWithRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `AsyncLocalStorage.enterWith()`; scope async context with `run(...)` so it cannot leak into later work."
    },
    messages: {
      enterWith: "Do not use `enterWith()`. It mutates the ambient async context with no restore, so later work can inherit the wrong store. Use `run(store, fn)`."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "MemberExpression" || callee.computed)
          return;
        if (callee.property.type !== "Identifier" || callee.property.name !== "enterWith")
          return;
        context.report({ node, messageId: "enterWith" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-banner-comments.ts
import { defineRule as defineRule2 } from "@oxlint/plugins";
var BANNER = /^\s*(?:[=*#-]{4,}|(?:phase|step|section|part)\s+\d)\b/iu;
var noBannerCommentsRule = defineRule2({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow decorative section-banner comments (`// =====`, `// Phase 1:`) in source."
    },
    messages: {
      banner: "Remove this section banner. Structure the file with names and modules, not `// Phase N` comments."
    }
  },
  createOnce(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (BANNER.test(comment.value)) {
            context.report({ node: comment, messageId: "banner" });
          }
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-boolean-if-return.ts
import { defineRule as defineRule3 } from "@oxlint/plugins";
function booleanReturn(statement) {
  const inner = statement.type === "BlockStatement" && statement.body.length === 1 ? statement.body[0] : statement;
  if (inner === undefined || inner.type !== "ReturnStatement")
    return null;
  const argument = inner.argument;
  if (argument === null || argument.type !== "Literal" || typeof argument.value !== "boolean") {
    return null;
  }
  return argument.value;
}
var noBooleanIfReturnRule = defineRule3({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow if/else that only returns opposite boolean literals; return the condition instead."
    },
    messages: {
      booleanIfReturn: "Return the condition instead of `if (x) return true; else return false`. Invert with `!` when needed."
    }
  },
  createOnce(context) {
    return {
      IfStatement(node) {
        if (node.alternate === null)
          return;
        const thenValue = booleanReturn(node.consequent);
        const elseValue = booleanReturn(node.alternate);
        if (thenValue === null || elseValue === null || thenValue === elseValue)
          return;
        context.report({ node, messageId: "booleanIfReturn" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-chained-type-assertions.ts
import { defineRule as defineRule4 } from "@oxlint/plugins";
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
var noChainedTypeAssertionsRule = defineRule4({
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

// oxlint/anti-slop/rules/no-closing-brace-label.ts
import { defineRule as defineRule5 } from "@oxlint/plugins";
var END_LABEL = /^\s*end(?:\s+\w+)?\s*$/iu;
var noClosingBraceLabelRule = defineRule5({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow trailing comments that label a closing brace (`} // end if`)."
    },
    messages: {
      braceLabel: "Do not label a closing brace with `// end …`. Indentation already shows the block."
    }
  },
  createOnce(context) {
    return {
      Program() {
        const sourceCode = context.sourceCode;
        for (const comment of sourceCode.getAllComments()) {
          if (!END_LABEL.test(comment.value.trim()))
            continue;
          const before = sourceCode.getText().slice(Math.max(0, comment.start - 24), comment.start);
          if (/\}\s*$/u.test(before)) {
            context.report({ node: comment, messageId: "braceLabel" });
          }
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-conditional-empty-object-spread.ts
import { defineRule as defineRule6 } from "@oxlint/plugins";
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
var noConditionalEmptyObjectSpreadRule = defineRule6({
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

// oxlint/anti-slop/rules/no-document-cookie.ts
import { defineRule as defineRule7 } from "@oxlint/plugins";
var DOCUMENT_HOSTS = new Set(["document", "globalThis", "window", "self"]);
function staticString(node) {
  if (node.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? null;
  }
  return null;
}
function isCookieProperty(node) {
  if (node.computed) {
    return staticString(node.property) === "cookie";
  }
  return node.property.type === "Identifier" && node.property.name === "cookie";
}
function isDocumentCookieAccess(node) {
  if (node.type !== "MemberExpression" || !isCookieProperty(node))
    return false;
  if (node.object.type === "Identifier" && node.object.name === "document")
    return true;
  if (node.object.type !== "MemberExpression" || node.object.computed)
    return false;
  return node.object.property.type === "Identifier" && node.object.property.name === "document" && node.object.object.type === "Identifier" && DOCUMENT_HOSTS.has(node.object.object.name);
}
var noDocumentCookieRule = defineRule7({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow writing `document.cookie` directly; cookie attributes belong in one sanctioned helper."
    },
    messages: {
      assignment: "Do not assign to `document.cookie`. It bypasses Secure/SameSite/Path defaults and can clobber unrelated cookies."
    }
  },
  createOnce(context) {
    return {
      AssignmentExpression(node) {
        if (isDocumentCookieAccess(node.left)) {
          context.report({ node, messageId: "assignment" });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-eager-singleton.ts
import { defineRule as defineRule8 } from "@oxlint/plugins";
var DEFAULT_CALLS = new Set([
  "drizzle",
  "betterAuth",
  "createRedisClient",
  "postgres",
  "createClient"
]);
var DEFAULT_NEWS = new Set([
  "RedisClient",
  "Queue",
  "Worker",
  "S3Client",
  "SQL",
  "PrismaClient",
  "MongoClient"
]);
function isFunctionNode(node) {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration" || node.type === "FunctionExpression";
}
function isDeferred(node) {
  let current = node.parent;
  while (current !== null && current.type !== "Program") {
    if (isFunctionNode(current))
      return true;
    if (current.type === "PropertyDefinition" && current.static !== true)
      return true;
    current = current.parent;
  }
  return false;
}
function identifierName(node) {
  return node.type === "Identifier" ? node.name : null;
}
function extraNames(options, key) {
  if (typeof options !== "object" || options === null || Array.isArray(options))
    return [];
  const value = options[key];
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}
var noEagerSingletonRule = defineRule8({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow constructing DB/auth/queue/S3 clients at module top level; wrap them in a lazy getter."
    },
    messages: {
      eager: "`{{name}}(...)` at module top level constructs a side-effecting singleton at import time. Wrap it in a lazy `getX()` that runs on first use."
    },
    schema: [
      {
        type: "object",
        properties: {
          callNames: { type: "array", items: { type: "string" } },
          newNames: { type: "array", items: { type: "string" } }
        },
        additionalProperties: false
      }
    ]
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (isDeferred(node))
          return;
        const name = identifierName(node.callee);
        if (name === null)
          return;
        const extra = extraNames(context.options?.[0], "callNames");
        if (!DEFAULT_CALLS.has(name) && !extra.includes(name))
          return;
        context.report({ node, messageId: "eager", data: { name } });
      },
      NewExpression(node) {
        if (isDeferred(node))
          return;
        const name = identifierName(node.callee);
        if (name === null)
          return;
        const extra = extraNames(context.options?.[0], "newNames");
        if (!DEFAULT_NEWS.has(name) && !extra.includes(name))
          return;
        context.report({ node, messageId: "eager", data: { name: `new ${name}` } });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-empty-if-chain.ts
import { defineRule as defineRule9 } from "@oxlint/plugins";
function isEmptyStatementish(statement) {
  if (statement.type === "EmptyStatement")
    return true;
  if (statement.type !== "BlockStatement")
    return false;
  return statement.body.every((inner) => isEmptyStatementish(inner));
}
function isEmptyBranch(node) {
  if (node.type === "IfStatement") {
    if (!isEmptyBranch(node.consequent))
      return false;
    return node.alternate === null ? true : isEmptyBranch(node.alternate);
  }
  return isEmptyStatementish(node);
}
var noEmptyIfChainRule = defineRule9({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow if/else-if/else chains where every branch is an empty block."
    },
    messages: {
      emptyIfChain: "This if/else chain has no statements. Delete it or put the real work in a branch."
    }
  },
  createOnce(context) {
    return {
      IfStatement(node) {
        const parent = node.parent;
        if (parent.type === "IfStatement" && parent.alternate === node)
          return;
        if (node.alternate === null)
          return;
        if (isEmptyBranch(node))
          context.report({ node, messageId: "emptyIfChain" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-foreign-directive.ts
import { defineRule as defineRule10 } from "@oxlint/plugins";
var FOREIGN = /\b(?:biome-ignore|prettier-ignore)\b/u;
var noForeignDirectiveRule = defineRule10({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `biome-ignore` and `prettier-ignore`; they are dead in an oxlint + oxfmt repo."
    },
    messages: {
      foreign: "`{{kind}}` is not honoured here. Remove it, or use an oxlint disable with a reason."
    }
  },
  createOnce(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const match = FOREIGN.exec(comment.value);
          if (match) {
            context.report({
              node: comment,
              messageId: "foreign",
              data: { kind: match[0] }
            });
          }
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-icu-invalid-locale.ts
import { defineRule as defineRule11 } from "@oxlint/plugins";
var UNDERSCORE_LOCALE = /^[A-Za-z]{2,3}_[A-Za-z0-9_-]+$/u;
var INTL_CTORS = new Set([
  "Collator",
  "DateTimeFormat",
  "DisplayNames",
  "ListFormat",
  "Locale",
  "NumberFormat",
  "PluralRules",
  "RelativeTimeFormat",
  "Segmenter"
]);
function isIntlCtor(callee) {
  if (callee.type !== "MemberExpression" || callee.computed)
    return false;
  if (callee.object.type !== "Identifier" || callee.object.name !== "Intl")
    return false;
  return callee.property.type === "Identifier" && INTL_CTORS.has(callee.property.name);
}
function localeArg(node) {
  const first = node.arguments[0];
  if (first === undefined || first.type === "SpreadElement")
    return null;
  return first;
}
function reportIfUnderscore(context, node) {
  if (node.type === "Literal" && typeof node.value === "string" && UNDERSCORE_LOCALE.test(node.value)) {
    context.report({ node, messageId: "invalidLocale" });
  }
}
var noIcuInvalidLocaleRule = defineRule11({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow underscore locale tags (`en_US`) in `Intl.*` constructors; use BCP 47 (`en-US`)."
    },
    messages: {
      invalidLocale: "Use a BCP 47 locale tag (`en-US`), not a POSIX underscore tag (`en_US`)."
    }
  },
  createOnce(context) {
    return {
      NewExpression(node) {
        if (!isIntlCtor(node.callee))
          return;
        const arg = localeArg(node);
        if (arg !== null)
          reportIfUnderscore(context, arg);
      },
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression")
          return;
        if (!isIntlCtor(node.callee))
          return;
        const arg = localeArg(node);
        if (arg !== null)
          reportIfUnderscore(context, arg);
      }
    };
  }
});

// oxlint/anti-slop/rules/no-icu-missing-other.ts
import { defineRule as defineRule12 } from "@oxlint/plugins";
var KIND = /,\s*(?:plural|selectordinal|select)\s*,/u;
var OTHER = /\bother\s*\{/u;
function missingOther(value) {
  return KIND.test(value) && !OTHER.test(value);
}
var noIcuMissingOtherRule = defineRule12({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow ICU `plural` / `select` / `selectordinal` messages that have no `other` fallback."
    },
    messages: {
      missingOther: "ICU `plural`/`select`/`selectordinal` must include an `other` case; without it, formatting throws on unmatched values."
    }
  },
  createOnce(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string")
          return;
        if (missingOther(node.value))
          context.report({ node, messageId: "missingOther" });
      },
      TemplateElement(node) {
        const cooked = node.value.cooked;
        if (typeof cooked === "string" && missingOther(cooked)) {
          context.report({ node, messageId: "missingOther" });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-inline-cast-access.ts
import { defineRule as defineRule13 } from "@oxlint/plugins";
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
var noInlineCastAccessRule = defineRule13({
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
import { defineRule as defineRule14 } from "@oxlint/plugins";

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
var noKnownValueWideningRule = defineRule14({
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

// oxlint/anti-slop/rules/no-long-comments.ts
import { defineRule as defineRule15 } from "@oxlint/plugins";
var DEFAULT_MAX_LINES = 5;
var LICENSE = /\b(?:spdx-license-identifier|copyright|licensed under|all rights reserved)\b/iu;
var DIRECTIVE = /^\s*(?:oxlint|eslint)-(?:disable|enable|disable-next-line|disable-line)\b/u;
var JSDOC_TAG = /@(?:param|returns?|throws|example|see|deprecated|template|type)\b/u;
function commentLines(comment) {
  if (comment.loc === undefined)
    return comment.value.split(`
`).length;
  return comment.loc.end.line - comment.loc.start.line + 1;
}
function isSkippable(comment, isFileHeader) {
  const text = comment.value;
  if (DIRECTIVE.test(text))
    return true;
  if (isFileHeader)
    return true;
  if (LICENSE.test(text))
    return true;
  if (comment.type === "Block" && JSDOC_TAG.test(text))
    return true;
  return false;
}
var noLongCommentsRule = defineRule15({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow block comments or adjacent line-comment runs longer than a small line budget."
    },
    messages: {
      longComment: "This comment is {{lines}} lines. Keep comments to {{max}} lines or fewer; name the code instead of narrating it."
    },
    schema: [
      {
        type: "object",
        properties: { maxLines: { type: "integer", minimum: 1 } },
        additionalProperties: false
      }
    ],
    defaultOptions: [{ maxLines: DEFAULT_MAX_LINES }]
  },
  createOnce(context) {
    return {
      Program() {
        const option = context.options?.[0];
        const maxLines = typeof option === "object" && option !== null && !Array.isArray(option) && typeof option.maxLines === "number" ? option.maxLines : DEFAULT_MAX_LINES;
        const comments = context.sourceCode.getAllComments();
        let run = [];
        let runStartLine = 0;
        const flushRun = () => {
          if (run.length === 0)
            return;
          const first = run[0];
          if (first === undefined)
            return;
          const lines = run.reduce((sum, comment) => sum + commentLines(comment), 0);
          if (lines > maxLines) {
            context.report({
              node: first,
              messageId: "longComment",
              data: { lines: String(lines), max: String(maxLines) }
            });
          }
          run = [];
        };
        for (const comment of comments) {
          const startLine = comment.loc?.start.line ?? 1;
          const isFileHeader = comment.type === "Block" && startLine <= 3;
          if (isSkippable(comment, isFileHeader)) {
            flushRun();
            continue;
          }
          if (comment.type === "Block") {
            flushRun();
            const lines = commentLines(comment);
            if (lines > maxLines) {
              context.report({
                node: comment,
                messageId: "longComment",
                data: { lines: String(lines), max: String(maxLines) }
              });
            }
            continue;
          }
          const line = comment.loc?.start.line ?? 0;
          if (run.length > 0 && line === runStartLine + run.length) {
            run.push(comment);
            continue;
          }
          flushRun();
          run = [comment];
          runStartLine = line;
        }
        flushRun();
      }
    };
  }
});

// oxlint/anti-slop/rules/no-module-mocking.ts
import { defineRule as defineRule16 } from "@oxlint/plugins";
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
var noModuleMockingRule = defineRule16({
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
import { defineRule as defineRule17 } from "@oxlint/plugins";
var noNewPromiseRule = defineRule17({
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
import { defineRule as defineRule18 } from "@oxlint/plugins";

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
var noObjectParametersRule = defineRule18({
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

// oxlint/anti-slop/rules/no-partial-record-satisfies.ts
import { defineRule as defineRule19 } from "@oxlint/plugins";
function isTypeName(node, name) {
  return node.type === "TSTypeReference" && node.typeName.type === "Identifier" && node.typeName.name === name;
}
function unwrapReadonly(typeNode) {
  if (!isTypeName(typeNode, "Readonly"))
    return typeNode;
  const inner = typeNode.typeArguments?.params[0];
  return inner ?? typeNode;
}
function isPartialRecordType(typeNode) {
  const outer = unwrapReadonly(typeNode);
  if (!isTypeName(outer, "Partial"))
    return false;
  const inner = unwrapReadonly(outer.typeArguments?.params[0] ?? outer);
  return isTypeName(inner, "Record");
}
function isObjectLiteralExpression(node) {
  if (node.type === "ObjectExpression")
    return true;
  if (node.type !== "TSAsExpression")
    return false;
  const annotation = node.typeAnnotation;
  if (annotation.type === "TSTypeReference" && annotation.typeName.type === "Identifier") {
    if (annotation.typeName.name === "const")
      return isObjectLiteralExpression(node.expression);
  }
  return false;
}
var noPartialRecordSatisfiesRule = defineRule19({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow pinning an object literal with `satisfies Partial<Record<Union, T>>`; Partial drops the exhaustiveness `satisfies` would give you."
    },
    messages: {
      partialRecord: "Do not pin an object literal with `satisfies Partial<Record<...>>`. Make the record total, narrow the key union, or stop using `satisfies` for sparse data."
    }
  },
  createOnce(context) {
    return {
      TSSatisfiesExpression(node) {
        if (!isPartialRecordType(node.typeAnnotation))
          return;
        if (!isObjectLiteralExpression(node.expression))
          return;
        context.report({ node, messageId: "partialRecord" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-path-prefix-containment.ts
import { defineRule as defineRule20 } from "@oxlint/plugins";
var PATH_APIS = new Set(["dirname", "join", "normalize", "resolve"]);
function propertyName(node) {
  if (node.computed) {
    return node.property.type === "Literal" && typeof node.property.value === "string" ? node.property.value : null;
  }
  return node.property.type === "Identifier" ? node.property.name : null;
}
function isPathCall(node) {
  if (node.type !== "CallExpression")
    return false;
  const callee = node.callee;
  if (callee.type !== "MemberExpression")
    return false;
  const method = propertyName(callee);
  if (method === null || !PATH_APIS.has(method))
    return false;
  if (callee.object.type === "Identifier" && (callee.object.name === "path" || callee.object.name === "posix" || callee.object.name === "win32")) {
    return true;
  }
  return false;
}
function looksLikePathName(name) {
  return /(?:path|dir|root|file|folder|resolved|candidate|baseDir|basePath)$/iu.test(name);
}
function argumentUsesSep(arg) {
  if (arg.type !== "TemplateLiteral")
    return false;
  return arg.expressions.some((expression) => {
    if (expression.type !== "MemberExpression")
      return false;
    return propertyName(expression) === "sep";
  });
}
function startsWithObjectLooksLikePath(object) {
  if (isPathCall(object))
    return true;
  if (object.type === "Identifier")
    return looksLikePathName(object.name);
  if (object.type === "CallExpression" && object.callee.type === "MemberExpression") {
    const method = propertyName(object.callee);
    return method === "resolve" || method === "normalize" || method === "join";
  }
  return false;
}
var noPathPrefixContainmentRule = defineRule20({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow path containment via `startsWith(root)`; `/safe/root-backup` matches `/safe/root`."
    },
    messages: {
      prefix: "`startsWith(root)` is not containment: a sibling path shares the prefix. Use `path.relative` and reject `..`, or compare with `${root}${path.sep}`."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression")
          return;
        if (propertyName(node.callee) !== "startsWith")
          return;
        if (!startsWithObjectLooksLikePath(node.callee.object))
          return;
        const first = node.arguments[0];
        if (first !== undefined && first.type !== "SpreadElement" && argumentUsesSep(first))
          return;
        context.report({ node, messageId: "prefix" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-physical-properties.ts
import { defineRule as defineRule21 } from "@oxlint/plugins";

// oxlint/anti-slop/shared/physical-properties.ts
var PHYSICAL_PATTERNS = [
  /(?:^|[\s"'`{(])(?:-?)(?:[\w[\]:]*:)?(?:ml|mr|pl|pr)-/u,
  /(?:^|[\s"'`{(])(?:[\w[\]:]*:)?text-(?:left|right)(?=["'\s`})]|$)/u,
  /(?:^|[\s"'`{(])(?:[\w[\]:]*:)?border-[lr](?=[-\s"'`})]|$)/u,
  /(?:^|[\s"'`{(])(?:[\w[\]:]*:)?rounded-(?:l|r|tl|tr|bl|br)(?=[-\s"'`})]|$)/u,
  /(?:^|[\s"'`{(])(?:-?)(?:[\w[\]:]*:)?(?:left|right)-/u,
  /(?:^|[\s"'`{(])(?:[\w[\]:]*:)?scroll-(?:ml|mr|pl|pr)-/u,
  /(?:^|[\s"'`{(])(?:[\w[\]:]*:)?float-(?:left|right)(?=["'\s`})]|$)/u,
  /(?:^|[\s"'`{(])(?:[\w[\]:]*:)?clear-(?:left|right)(?=["'\s`})]|$)/u
];
function hasPhysicalProperty(value) {
  return PHYSICAL_PATTERNS.some((pattern) => pattern.test(value));
}

// oxlint/anti-slop/rules/no-physical-properties.ts
var noPhysicalPropertiesRule = defineRule21({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow physical directional Tailwind/CSS (`ml-`, `text-left`, `left-`) that break RTL."
    },
    messages: {
      physical: "Physical direction breaks RTL. Use logical equivalents: ml→ms, mr→me, pl→ps, pr→pe, left→start, right→end, text-left→text-start."
    }
  },
  createOnce(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string")
          return;
        if (hasPhysicalProperty(node.value)) {
          context.report({ node, messageId: "physical" });
        }
      },
      TemplateElement(node) {
        if (hasPhysicalProperty(node.value.raw)) {
          context.report({ node, messageId: "physical" });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-placeholder-comment.ts
import { defineRule as defineRule22 } from "@oxlint/plugins";
var PLACEHOLDER = /\b(your code here|implementation here|add your logic|helper function|todo:\s*implement(?:\s+this)?)\b/iu;
var noPlaceholderCommentRule = defineRule22({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow placeholder comments that mark unfinished generated code instead of a tracked task."
    },
    messages: {
      placeholder: "Remove this placeholder comment. Track unfinished work with `TODO(#issue, @owner)`, or delete the stub."
    }
  },
  createOnce(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (PLACEHOLDER.test(comment.value)) {
            context.report({ node: comment, messageId: "placeholder" });
          }
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-process-env-outside-boundary.ts
import { defineRule as defineRule23 } from "@oxlint/plugins";

// oxlint/anti-slop/shared/filename.ts
function filenameOf(context) {
  return (context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/");
}
function isTestPath(filename) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(filename) || /\/(?:test|tests|__tests__)(?:\/|$)/u.test(filename);
}

// oxlint/anti-slop/rules/no-process-env-outside-boundary.ts
var DEFAULT_ALLOWED = [
  /(?:^|\/)env(?:-base)?\.ts$/u,
  /(?:^|\/)setup-env\.ts$/u,
  /(?:^|\/)(?:scripts|tests|__tests__)\/.+/u,
  /\.(?:config|test|spec)\.[cm]?[jt]sx?$/u
];
function isAllowedFile(filename, extra) {
  if (DEFAULT_ALLOWED.some((pattern) => pattern.test(filename)))
    return true;
  return extra.some((allowed) => filename.endsWith(allowed.replaceAll("\\", "/")));
}
function staticPropertyName(node) {
  if (!node.computed) {
    return node.property.type === "Identifier" ? node.property.name : null;
  }
  return node.property.type === "Literal" && typeof node.property.value === "string" ? node.property.value : null;
}
function isProcessEnvRoot(node) {
  return node.type === "MemberExpression" && node.object.type === "Identifier" && node.object.name === "process" && staticPropertyName(node) === "env";
}
function envNameForAccess(node) {
  if (isProcessEnvRoot(node))
    return "process.env";
  if (!isProcessEnvRoot(node.object))
    return "process.env";
  const propertyName2 = staticPropertyName(node);
  if (propertyName2 === null)
    return "process.env[...]";
  return node.computed ? `process.env[${JSON.stringify(propertyName2)}]` : `process.env.${propertyName2}`;
}
function isNestedProcessEnvRoot(node) {
  if (!isProcessEnvRoot(node))
    return false;
  const parent = node.parent;
  return parent.type === "MemberExpression" && parent.object === node;
}
function isProcessEnvAccess(node) {
  if (isNestedProcessEnvRoot(node))
    return false;
  if (isProcessEnvRoot(node))
    return true;
  return isProcessEnvRoot(node.object);
}
function extraAllowedFiles(options) {
  if (typeof options !== "object" || options === null || Array.isArray(options))
    return [];
  const value = options.allowedFiles;
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}
var noProcessEnvOutsideBoundaryRule = defineRule23({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow unvalidated `process.env` reads outside env.ts, configs, scripts, and tests."
    },
    messages: {
      processEnv: "Read {{envName}} through an env module, or add this file to the approved `process.env` boundary."
    },
    schema: [
      {
        type: "object",
        properties: { allowedFiles: { type: "array", items: { type: "string" } } },
        additionalProperties: false
      }
    ]
  },
  createOnce(context) {
    return {
      before() {
        return !isAllowedFile(filenameOf(context), extraAllowedFiles(context.options?.[0]));
      },
      MemberExpression(node) {
        if (!isProcessEnvAccess(node))
          return;
        context.report({
          node,
          messageId: "processEnv",
          data: { envName: envNameForAccess(node) }
        });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-reflect-apply.ts
import { defineRule as defineRule24 } from "@oxlint/plugins";
var noReflectApplyRule = defineRule24({
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
import { defineRule as defineRule25 } from "@oxlint/plugins";
var noReflectGetRule = defineRule25({
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
import { defineRule as defineRule26 } from "@oxlint/plugins";
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
var noReturnTypeUtilityRule = defineRule26({
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
import { defineRule as defineRule27 } from "@oxlint/plugins";
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
var noRuntimeTypeofRule = defineRule27({
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
import { defineRule as defineRule28 } from "@oxlint/plugins";
var FORBIDDEN_SYMBOL_NAME = "shape";
var GODOT_SHAPE_ALLOWLIST = /^(?:_?mouse_shape_(?:enter|exit)|(?:Collision|Rectangle|Circle|Capsule|Cylinder|Sphere|Box|Segment|SeparationRay|WorldBoundary|ConcavePolygon|ConvexPolygon|HeightMap)?Shape[23]D?|ShapeCast[23]D|shape_owner_.*|result_shape_invalid)$/i;
function containsForbiddenSymbolName(name) {
  return name.toLowerCase().includes(FORBIDDEN_SYMBOL_NAME) && !GODOT_SHAPE_ALLOWLIST.test(name);
}
function identifierName2(node) {
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
var noForbiddenTermInSymbolNamesRule = defineRule28({
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
        checkIdentifier(node.key, identifierName2(node.key));
      },
      PropertyDefinition(node) {
        checkIdentifier(node.key, identifierName2(node.key));
      },
      MethodDefinition(node) {
        checkIdentifier(node.key, identifierName2(node.key));
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

// oxlint/anti-slop/rules/no-silent-skip.ts
import { defineRule as defineRule29 } from "@oxlint/plugins";
var SKIP_CALLEES = new Set(["xit", "xtest", "xdescribe"]);
var TEST_CALLEES = new Set(["it", "test", "describe"]);
var SKIP_PROPS = new Set(["skip", "skipIf"]);
var REASON = /(?:#\d+|FIXME|TODO|flaky|reason:|skip:)/iu;
function calleeName(callee) {
  if (callee.type === "Identifier")
    return callee.name;
  if (callee.type !== "MemberExpression" || callee.computed)
    return null;
  if (callee.object.type !== "Identifier" || callee.property.type !== "Identifier")
    return null;
  return `${callee.object.name}.${callee.property.name}`;
}
function isTestCallName(name) {
  if (TEST_CALLEES.has(name) || SKIP_CALLEES.has(name))
    return true;
  const dot = name.indexOf(".");
  if (dot === -1)
    return false;
  return TEST_CALLEES.has(name.slice(0, dot));
}
function skipKind(name) {
  if (SKIP_CALLEES.has(name))
    return "skip";
  const property = name.split(".").at(-1);
  if (property !== undefined && SKIP_PROPS.has(property)) {
    return property === "skipIf" ? "skipIf" : "skip";
  }
  return null;
}
function titleHasReason(node) {
  const first = node.arguments[0];
  if (first === undefined)
    return false;
  if (first.type === "Literal" && typeof first.value === "string")
    return REASON.test(first.value);
  return false;
}
function isLiteralTrue(node) {
  return node.type === "Literal" && node.value === true;
}
function unwrapBlock(statement) {
  if (statement.type === "BlockStatement" && statement.body.length === 1) {
    const only = statement.body[0];
    if (only !== undefined)
      return only;
  }
  return statement;
}
function isBareReturn(statement) {
  const inner = unwrapBlock(statement);
  return inner.type === "ReturnStatement" && inner.argument === null;
}
function insideTestCallback(node) {
  let current = node.parent;
  while (current !== null && current.type !== "Program") {
    if (current.type === "CallExpression") {
      const name = calleeName(current.callee);
      if (name !== null && isTestCallName(name))
        return true;
    }
    current = current.parent;
  }
  return false;
}
var noSilentSkipRule = defineRule29({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow skipped tests without a reason, constant skipIf(true), and early returns that swallow a failing test."
    },
    messages: {
      skipWithoutReason: "Do not skip a test without a reason in the title (`#issue`, `FIXME`, `flaky`, `reason:`). Fix it or delete it.",
      skipIfTrue: "`skipIf(true)` is a silent skip. Delete the test or name the reason in the title.",
      earlyReturn: "This test returns early when a condition fails, so a missing UI/state becomes a pass. Assert the condition; do not skip it."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isTestPath(filenameOf(context)))
          return;
        const name = calleeName(node.callee);
        if (name === null)
          return;
        const kind = skipKind(name);
        if (kind === null)
          return;
        if (kind === "skipIf") {
          const first = node.arguments[0];
          if (first !== undefined && first.type !== "SpreadElement" && isLiteralTrue(first)) {
            context.report({ node, messageId: "skipIfTrue" });
            return;
          }
        }
        if (!titleHasReason(node)) {
          context.report({ node, messageId: "skipWithoutReason" });
        }
      },
      IfStatement(node) {
        if (!isTestPath(filenameOf(context)))
          return;
        if (!insideTestCallback(node))
          return;
        if (node.alternate !== null)
          return;
        if (!isBareReturn(node.consequent))
          return;
        context.report({ node, messageId: "earlyReturn" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-source-text-assertions.ts
import { defineRule as defineRule30 } from "@oxlint/plugins";
var SOURCE_PROPS = new Set(["innerHTML", "outerHTML", "outerText"]);
var SOURCE_IDENTIFIERS = new Set([
  "sourceText",
  "rawSource",
  "fileContents",
  "astSource",
  "htmlSource"
]);
var SOURCE_MATCHERS = new Set(["toHaveHTML", "toMatchHTML"]);
function propertyName2(node) {
  if (node.computed) {
    return node.property.type === "Literal" && typeof node.property.value === "string" ? node.property.value : null;
  }
  return node.property.type === "Identifier" ? node.property.name : null;
}
function isExpectCall(node) {
  return node.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "expect";
}
function expectArgument(node) {
  let current = node;
  while (current !== null && current.type !== "Program") {
    if (current.type === "CallExpression" && isExpectCall(current)) {
      const first = current.arguments[0];
      if (first === undefined || first.type === "SpreadElement")
        return null;
      return first;
    }
    current = current.parent;
  }
  return null;
}
function isSourceSubject(node) {
  if (node.type === "Identifier")
    return SOURCE_IDENTIFIERS.has(node.name);
  if (node.type !== "MemberExpression")
    return false;
  const name = propertyName2(node);
  if (name !== null && SOURCE_PROPS.has(name))
    return true;
  if (name === "getText")
    return true;
  return false;
}
var noSourceTextAssertionsRule = defineRule30({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow tests that assert on innerHTML, outerHTML, source dumps, or HTML matchers."
    },
    messages: {
      sourceText: "Do not assert on source/HTML dumps. Query by role/name and assert on behavior, not `innerHTML`/`outerHTML`/`getText()`."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isTestPath(filenameOf(context)))
          return;
        if (node.callee.type !== "MemberExpression")
          return;
        const matcher = propertyName2(node.callee);
        if (matcher !== null && SOURCE_MATCHERS.has(matcher)) {
          context.report({ node, messageId: "sourceText" });
          return;
        }
        const argument = expectArgument(node);
        if (argument !== null && isSourceSubject(argument)) {
          context.report({ node, messageId: "sourceText" });
        }
      },
      MemberExpression(node) {
        if (!isTestPath(filenameOf(context)))
          return;
        if (!isExpectCall(node.parent))
          return;
        if (node.parent.arguments[0] !== node)
          return;
        if (isSourceSubject(node)) {
          context.report({ node, messageId: "sourceText" });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/no-spread-input-in-query-key.ts
import { defineRule as defineRule31 } from "@oxlint/plugins";
function propertyName3(node) {
  if (node.computed) {
    return node.key.type === "Literal" && typeof node.key.value === "string" ? node.key.value : null;
  }
  return node.key.type === "Identifier" ? node.key.name : null;
}
function rootIdentifier(node) {
  if (node.type === "Identifier")
    return node;
  if (node.type === "MemberExpression")
    return rootIdentifier(node.object);
  if (node.type === "CallExpression" && node.callee.type !== "Super" && node.callee.type !== "V8IntrinsicExpression") {
    return rootIdentifier(node.callee);
  }
  if (node.type === "ChainExpression")
    return rootIdentifier(node.expression);
  return null;
}
function isKeysFactory(node) {
  const root = rootIdentifier(node);
  return root !== null && root.name.endsWith("Keys");
}
function isLeakySpread(element) {
  if (element === null || element.type !== "SpreadElement")
    return false;
  return !isKeysFactory(element.argument);
}
function arrayHasLeakySpread(node) {
  return node.elements.some((element) => element !== null && isLeakySpread(element));
}
var noSpreadInputInQueryKeyRule = defineRule31({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `queryKey: [...input]`; spread only `*Keys` factory results and list cache-identity fields explicitly."
    },
    messages: {
      leaky: "Do not spread a caller object into `queryKey`. Spread a `*Keys` factory and list the concrete cache-identity fields."
    }
  },
  createOnce(context) {
    return {
      Property(node) {
        if (propertyName3(node) !== "queryKey")
          return;
        if (node.value.type !== "ArrayExpression")
          return;
        if (!arrayHasLeakySpread(node.value))
          return;
        context.report({ node, messageId: "leaky" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-static-set-map.ts
import { defineRule as defineRule32 } from "@oxlint/plugins";
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
var noStaticSetMapRule = defineRule32({
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
import { defineRule as defineRule33 } from "@oxlint/plugins";
var BOOLEAN_STATE = new Set(["loading", "isLoading", "completed", "success", "hasError"]);
var STRING_DISCRIMINANT = new Set(["kind", "status"]);
function propertyName4(node) {
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
var noStringDiscriminantRule = defineRule33({
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
      const name = propertyName4(node);
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

// oxlint/anti-slop/rules/no-swallowed-error.ts
import { defineRule as defineRule34 } from "@oxlint/plugins";
function isConsoleCall(statement) {
  if (statement.type !== "ExpressionStatement")
    return false;
  const expression = statement.expression;
  if (expression.type !== "CallExpression")
    return false;
  const callee = expression.callee;
  return callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier" && callee.object.name === "console" && callee.property.type === "Identifier";
}
var noSwallowedErrorRule = defineRule34({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow catch clauses whose body only logs to console without rethrowing or returning."
    },
    messages: {
      swallowed: "This catch only logs. Rethrow, return a typed error, or handle a named case — do not swallow."
    }
  },
  createOnce(context) {
    return {
      CatchClause(node) {
        const statements = node.body.body;
        if (statements.length === 0)
          return;
        if (!statements.every((statement) => isConsoleCall(statement)))
          return;
        context.report({ node, messageId: "swallowed" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-string-id-alias.ts
import { defineRule as defineRule35 } from "@oxlint/plugins";
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
var noStringIdAliasRule = defineRule35({
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

// oxlint/anti-slop/rules/no-swallowed-rejection.ts
import { defineRule as defineRule36 } from "@oxlint/plugins";
var ALLOWED_RECEIVERS = new Set([
  "abort",
  "arrayBuffer",
  "blob",
  "bytes",
  "cancel",
  "close",
  "formData",
  "json",
  "text"
]);
function isLiteralish(node) {
  if (node === null)
    return true;
  if (node.type === "Literal")
    return true;
  if (node.type === "Identifier" && (node.name === "undefined" || node.name === "null"))
    return true;
  if (node.type === "ArrayExpression" && node.elements.length === 0)
    return true;
  if (node.type === "ObjectExpression" && node.properties.length === 0)
    return true;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0 && (node.quasis[0]?.value.cooked ?? "") === "") {
    return true;
  }
  if (node.type === "BlockStatement") {
    return node.body.length === 0 || node.body.length === 1 && isLiteralish(node.body[0] ?? null);
  }
  if (node.type === "ExpressionStatement")
    return isLiteralish(node.expression);
  if (node.type === "ReturnStatement")
    return isLiteralish(node.argument);
  return false;
}
function catchCallbackIsLiteral(node) {
  if (node.type === "ArrowFunctionExpression") {
    if (node.body.type !== "BlockStatement")
      return isLiteralish(node.body);
    return isLiteralish(node.body);
  }
  if (node.type === "FunctionExpression")
    return isLiteralish(node.body);
  return false;
}
function receiverMethod(callee) {
  const object = callee.object;
  if (object.type !== "CallExpression")
    return null;
  if (object.callee.type !== "MemberExpression")
    return null;
  const property = object.callee.property;
  if (object.callee.computed) {
    return property.type === "Literal" && typeof property.value === "string" ? property.value : null;
  }
  return property.type === "Identifier" ? property.name : null;
}
var noSwallowedRejectionRule = defineRule36({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `.catch(() => <literal>)` except on body-read and teardown methods."
    },
    messages: {
      swallowed: "This `.catch` turns a rejection into an empty success. Handle the error, or use a named empty-body allowlist (json/text/cancel/close)."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression" || node.callee.computed)
          return;
        if (node.callee.property.type !== "Identifier" || node.callee.property.name !== "catch")
          return;
        const callback = node.arguments[0];
        if (callback === undefined || callback.type === "SpreadElement")
          return;
        if (!catchCallbackIsLiteral(callback))
          return;
        const method = receiverMethod(node.callee);
        if (method !== null && ALLOWED_RECEIVERS.has(method))
          return;
        context.report({ node, messageId: "swallowed" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-tiny-functions.ts
import { defineRule as defineRule37 } from "@oxlint/plugins";
function isFunctionNode2(node) {
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
var noTinyFunctionsRule = defineRule37({
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
      if (!isFunctionNode2(node) || !isTinyBody(node))
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
import { defineRule as defineRule38 } from "@oxlint/plugins";
function importedName2(node) {
  if (node.type !== "ImportSpecifier")
    return null;
  return node.imported.type === "Identifier" ? node.imported.name : String(node.imported.value);
}
var noTypescriptEnumRule = defineRule38({
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

// oxlint/anti-slop/rules/no-ui-presence-tests.ts
import { defineRule as defineRule39 } from "@oxlint/plugins";
var PRESENCE_MATCHERS = new Set(["toBeInTheDocument", "toBeVisible", "toBeEmptyDOMElement"]);
function propertyName5(node) {
  if (node.computed) {
    return node.property.type === "Literal" && typeof node.property.value === "string" ? node.property.value : null;
  }
  return node.property.type === "Identifier" ? node.property.name : null;
}
function chainRoot(node) {
  let current = node;
  while (current.type === "MemberExpression")
    current = current.object;
  while (current.type === "CallExpression") {
    if (current.callee.type === "MemberExpression") {
      current = current.callee.object;
      continue;
    }
    break;
  }
  return current;
}
function isExpectCall2(node) {
  return node.type === "CallExpression" && node.callee.type === "Identifier" && node.callee.name === "expect";
}
var noUiPresenceTestsRule = defineRule39({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow Testing Library presence matchers (`toBeInTheDocument`, `toBeVisible`) as the assertion."
    },
    messages: {
      presence: "`{{matcher}}` only proves presence. Assert on the text, value, or action the user cares about."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isTestPath(filenameOf(context)))
          return;
        if (node.callee.type !== "MemberExpression")
          return;
        const matcher = propertyName5(node.callee);
        if (matcher === null || !PRESENCE_MATCHERS.has(matcher))
          return;
        if (!isExpectCall2(chainRoot(node.callee.object)))
          return;
        context.report({
          node,
          messageId: "presence",
          data: { matcher }
        });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-unknown-parameters.ts
import { defineRule as defineRule40 } from "@oxlint/plugins";
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
var noUnknownParametersRule = defineRule40({
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
import { defineRule as defineRule41 } from "@oxlint/plugins";
function referencedAliasName(type) {
  if (type.type === "TSParenthesizedType")
    return referencedAliasName(type.typeAnnotation);
  if (type.type !== "TSTypeReference" || type.typeName.type !== "Identifier")
    return null;
  return type.typeArguments === null || type.typeArguments === undefined || type.typeArguments.params.length === 0 ? type.typeName.name : null;
}
var noUnknownReturnsRule = defineRule41({
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
import { defineRule as defineRule42 } from "@oxlint/plugins";
function referencedAliasName2(type) {
  if (type.type === "TSParenthesizedType")
    return referencedAliasName2(type.typeAnnotation);
  if (type.type !== "TSTypeReference" || type.typeName.type !== "Identifier")
    return null;
  return type.typeArguments === null || type.typeArguments === undefined || type.typeArguments.params.length === 0 ? type.typeName.name : null;
}
var noUnknownTypeAliasesRule = defineRule42({
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
import { defineRule as defineRule43 } from "@oxlint/plugins";
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
var noUnsafeDictionaryTypeRule = defineRule43({
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

// oxlint/anti-slop/rules/no-unsafe-inner-html.ts
import { defineRule as defineRule44 } from "@oxlint/plugins";
var SAFE_HTML = /^\s*safe-html:/u;
function isStaticHtml(node) {
  if (node.type === "Literal" && typeof node.value === "string")
    return true;
  if (node.type === "TemplateLiteral")
    return node.expressions.every(isStaticHtml);
  return false;
}
function hasSafeHtmlComment(sourceCode, node) {
  return sourceCode.getCommentsBefore(node).some((comment) => SAFE_HTML.test(comment.value));
}
function propertyName6(key, computed) {
  if (computed)
    return key.type === "Literal" && typeof key.value === "string" ? key.value : null;
  return key.type === "Identifier" ? key.name : null;
}
function isInnerHtmlLhs(node) {
  if (node.type !== "MemberExpression")
    return false;
  const name = node.computed ? node.property.type === "Literal" && node.property.value === "innerHTML" : node.property.type === "Identifier" && node.property.name === "innerHTML";
  return name === true;
}
var noUnsafeInnerHtmlRule = defineRule44({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow dynamic HTML sinks unless the value is a static string or annotated `// safe-html:`."
    },
    messages: {
      unsafe: "Dynamic HTML needs a `// safe-html:` comment on the line above naming the sanitizer. Function names are not proof."
    }
  },
  createOnce(context) {
    return {
      AssignmentExpression(node) {
        if (!isInnerHtmlLhs(node.left))
          return;
        if (isStaticHtml(node.right))
          return;
        if (hasSafeHtmlComment(context.sourceCode, node))
          return;
        context.report({ node, messageId: "unsafe" });
      },
      Property(node) {
        if (propertyName6(node.key, node.computed) !== "__html")
          return;
        if (node.parent.type !== "ObjectExpression")
          return;
        if (node.value.type === "AssignmentPattern" || node.value.type === "RestElement")
          return;
        if (isStaticHtml(node.value))
          return;
        if (hasSafeHtmlComment(context.sourceCode, node))
          return;
        context.report({ node, messageId: "unsafe" });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-untranslated-jsx-literal.ts
import { defineRule as defineRule45 } from "@oxlint/plugins";
var DEFAULT_IGNORED = new Set(["code", "kbd", "pre", "samp", "script", "style", "var"]);
var DEFAULT_ALLOWED2 = new Set([
  "AI",
  "API",
  "AWS",
  "CSV",
  "DOCX",
  "HTML",
  "HTTP",
  "HTTPS",
  "ID",
  "IDs",
  "JSON",
  "MCP",
  "OAuth",
  "PDF",
  "S3",
  "SQL",
  "URL",
  "URLs",
  "UTC",
  "XML"
]);
var HAS_LETTER = /\p{L}/u;
var HTML_ENTITY = /&(?:[a-zA-Z][a-zA-Z0-9]+|#\d+|#x[\dA-Fa-f]+);/gu;
var CONSTANT_LIKE = /^(?=.*[0-9_./+-])[A-Z0-9_./+-]{2,}$/u;
function normalizeText(value) {
  return value.replace(HTML_ENTITY, " ").replace(/\u00a0/gu, " ").replace(/\s+/gu, " ").trim();
}
function reportText(value) {
  return value.length > 40 ? `${value.slice(0, 37)}...` : value;
}
function jsxName(node) {
  if (node.type === "JSXIdentifier")
    return node.name;
  if (node.type === "JSXMemberExpression")
    return jsxName(node.property);
  if (node.type === "JSXNamespacedName")
    return jsxName(node.name);
  return null;
}
function hasIgnoredAncestor(node, ignored) {
  let current = node.parent;
  while (current !== null && current.type !== "Program") {
    if (current.type === "JSXElement") {
      const name = jsxName(current.openingElement.name);
      if (name !== null && ignored.has(name))
        return true;
    }
    current = current.parent;
  }
  return false;
}
function stringLiteralValue(node) {
  if (node.type === "Literal" && typeof node.value === "string")
    return node.value;
  if (node.type !== "TemplateLiteral" || node.expressions.length > 0)
    return null;
  return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw ?? null;
}
function shouldIgnore(text, extraAllowed) {
  if (text.length <= 1)
    return true;
  if (!HAS_LETTER.test(text))
    return true;
  if (DEFAULT_ALLOWED2.has(text) || extraAllowed.has(text))
    return true;
  if (CONSTANT_LIKE.test(text) && text.length <= 12)
    return true;
  return false;
}
function extraStrings(options, key) {
  if (typeof options !== "object" || options === null || Array.isArray(options))
    return [];
  const value = options[key];
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}
var noUntranslatedJsxLiteralRule = defineRule45({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow user-facing JSX text literals; wrap copy in the project's translation helper."
    },
    messages: {
      untranslated: "Translate JSX text `{{text}}` with `t(...)` / `useTranslations()`, or disable with a reason for non-user copy."
    },
    schema: [
      {
        type: "object",
        properties: {
          allowedText: { type: "array", items: { type: "string" } },
          ignoredElementNames: { type: "array", items: { type: "string" } }
        },
        additionalProperties: false
      }
    ]
  },
  createOnce(context) {
    const ignored = new Set(DEFAULT_IGNORED);
    const extraAllowed = new Set;
    const check = (node, raw) => {
      const text = normalizeText(raw);
      if (shouldIgnore(text, extraAllowed))
        return;
      if (hasIgnoredAncestor(node, ignored))
        return;
      context.report({ node, messageId: "untranslated", data: { text: reportText(text) } });
    };
    return {
      before() {
        for (const name of extraStrings(context.options?.[0], "ignoredElementNames")) {
          ignored.add(name);
        }
        for (const text of extraStrings(context.options?.[0], "allowedText")) {
          extraAllowed.add(text);
        }
      },
      JSXText(node) {
        if (typeof node.value === "string")
          check(node, node.value);
      },
      JSXExpressionContainer(node) {
        const parent = node.parent;
        if (parent.type !== "JSXElement" && parent.type !== "JSXFragment")
          return;
        const value = stringLiteralValue(node.expression);
        if (value !== null)
          check(node, value);
      }
    };
  }
});

// oxlint/anti-slop/rules/no-unused-catch-binding.ts
import { defineRule as defineRule46 } from "@oxlint/plugins";
var noUnusedCatchBindingRule = defineRule46({
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

// oxlint/anti-slop/rules/no-vacuous-throw-assertion.ts
import { defineRule as defineRule47 } from "@oxlint/plugins";
var THROW_MATCHERS = new Set(["toThrow", "toThrowError"]);
function propertyName7(node) {
  if (node.computed || node.property.type !== "Identifier")
    return null;
  return node.property.name;
}
function describeChain(start) {
  let current = start;
  let negated = false;
  while (current.type === "MemberExpression") {
    if (propertyName7(current) === "not")
      negated = true;
    current = current.object;
  }
  const rootedAtExpect = current.type === "CallExpression" && current.callee.type === "Identifier" && current.callee.name === "expect";
  return { negated, rootedAtExpect };
}
var noVacuousThrowAssertionRule = defineRule47({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `expect(...).toThrow()` with no argument; name the error so an unrelated throw fails the test."
    },
    messages: {
      vacuousThrow: "`{{matcher}}()` with no argument passes for any thrown value. Name the expected error (message, regex, class, or `{ message }`)."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (!isTestPath(filenameOf(context)))
          return;
        if (node.arguments.length > 0)
          return;
        if (node.callee.type !== "MemberExpression")
          return;
        const matcher = propertyName7(node.callee);
        if (matcher === null || !THROW_MATCHERS.has(matcher))
          return;
        const { negated, rootedAtExpect } = describeChain(node.callee.object);
        if (negated || !rootedAtExpect)
          return;
        context.report({ node, messageId: "vacuousThrow", data: { matcher } });
      }
    };
  }
});

// oxlint/anti-slop/rules/no-widen-then-assert.ts
import { defineRule as defineRule48 } from "@oxlint/plugins";
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
var noWidenThenAssertRule = defineRule48({
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

// oxlint/anti-slop/rules/no-window-open.ts
import { defineRule as defineRule49 } from "@oxlint/plugins";
var HOSTS = new Set(["window", "globalThis", "self"]);
function isGlobalOpen(sourceCode, callee) {
  if (callee.type === "Identifier") {
    return callee.name === "open" && sourceCode.isGlobalReference(callee);
  }
  if (callee.type !== "MemberExpression")
    return false;
  const property = callee.computed ? callee.property.type === "Literal" && callee.property.value === "open" : callee.property.type === "Identifier" && callee.property.name === "open";
  if (!property)
    return false;
  if (callee.object.type === "Identifier")
    return HOSTS.has(callee.object.name);
  if (callee.object.type === "MemberExpression" && !callee.object.computed) {
    return callee.object.property.type === "Identifier" && callee.object.property.name === "window" && callee.object.object.type === "Identifier" && HOSTS.has(callee.object.object.name);
  }
  return false;
}
var noWindowOpenRule = defineRule49({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow `window.open` and global `open()`; opener isolation belongs in one helper."
    },
    messages: {
      windowOpen: "Do not call `window.open` / `open()` directly. Use a helper that sets `noopener` and sanitizes the URL."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression")
          return;
        if (isGlobalOpen(context.sourceCode, node.callee)) {
          context.report({ node, messageId: "windowOpen" });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/require-fetch-timeout.ts
import { defineRule as defineRule50 } from "@oxlint/plugins";
function isFetchCallee(callee) {
  if (callee.type === "Identifier")
    return callee.name === "fetch";
  if (callee.type !== "MemberExpression")
    return false;
  const property = callee.computed ? callee.property.type === "Literal" && callee.property.value === "fetch" : callee.property.type === "Identifier" && callee.property.name === "fetch";
  if (!property)
    return false;
  if (callee.object.type !== "Identifier")
    return false;
  return callee.object.name === "window" || callee.object.name === "globalThis" || callee.object.name === "self";
}
function hasSignal(node) {
  if (node.type !== "ObjectExpression")
    return true;
  let sawSpread = false;
  for (const property of node.properties) {
    if (property.type === "SpreadElement") {
      sawSpread = true;
      continue;
    }
    if (property.type !== "Property" || property.computed)
      continue;
    if (property.key.type === "Identifier" && property.key.name === "signal")
      return true;
    if (property.key.type === "Literal" && property.key.value === "signal")
      return true;
  }
  return sawSpread;
}
var requireFetchTimeoutRule = defineRule50({
  meta: {
    type: "problem",
    docs: {
      description: "Require `fetch(url, { signal })` so every request has a timeout or abort."
    },
    messages: {
      noSignal: "`fetch` needs a `signal` (`AbortSignal.timeout(...)` or a controller). A hung peer otherwise stalls this work forever."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        if (node.callee.type === "Super" || node.callee.type === "V8IntrinsicExpression")
          return;
        if (!isFetchCallee(node.callee))
          return;
        const options = node.arguments[1];
        if (options === undefined || options.type === "SpreadElement") {
          context.report({ node, messageId: "noSignal" });
          return;
        }
        if (options.type === "ObjectExpression" && !hasSignal(options)) {
          context.report({ node, messageId: "noSignal" });
        }
      }
    };
  }
});

// oxlint/anti-slop/rules/require-safety-comment-for-type-assertion.ts
import { defineRule as defineRule51 } from "@oxlint/plugins";
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
var requireSafetyCommentForTypeAssertionRule = defineRule51({
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

// oxlint/anti-slop/rules/require-suppression-description.ts
import { defineRule as defineRule52 } from "@oxlint/plugins";
var DISABLE = /\b(?:eslint|oxlint)-disable(?:-next-line|-line)?\b/u;
var ENABLE = /\b(?:eslint|oxlint)-enable\b/u;
var INLINE = /--\s*\S/u;
function isDirective(text) {
  return DISABLE.test(text) || ENABLE.test(text);
}
var requireSuppressionDescriptionRule = defineRule52({
  meta: {
    type: "problem",
    docs: {
      description: "Require every `oxlint-disable` / `eslint-disable` directive to include `-- <reason>` or a comment on the line above."
    },
    messages: {
      missing: "Suppression needs a reason: add `-- <why>` on the directive, or a comment on the line above."
    }
  },
  createOnce(context) {
    return {
      Program() {
        const comments = context.sourceCode.getAllComments();
        for (const comment of comments) {
          if (!DISABLE.test(comment.value))
            continue;
          if (INLINE.test(comment.value))
            continue;
          const lineAbove = (comment.loc?.start.line ?? 0) - 1;
          const documented = comments.some((other) => other !== comment && !isDirective(other.value) && other.loc?.end.line === lineAbove);
          if (documented)
            continue;
          context.report({ node: comment, messageId: "missing" });
        }
      }
    };
  }
});

// oxlint/anti-slop/index.ts
var antiSlopPlugin = eslintCompatPlugin({
  meta: { name: "anti-slop" },
  rules: {
    "no-async-context-enter-with": noAsyncContextEnterWithRule,
    "no-banner-comments": noBannerCommentsRule,
    "no-boolean-if-return": noBooleanIfReturnRule,
    "no-chained-type-assertions": noChainedTypeAssertionsRule,
    "no-closing-brace-label": noClosingBraceLabelRule,
    "no-conditional-empty-object-spread": noConditionalEmptyObjectSpreadRule,
    "no-document-cookie": noDocumentCookieRule,
    "no-eager-singleton": noEagerSingletonRule,
    "no-empty-if-chain": noEmptyIfChainRule,
    "no-foreign-directive": noForeignDirectiveRule,
    "no-icu-invalid-locale": noIcuInvalidLocaleRule,
    "no-icu-missing-other": noIcuMissingOtherRule,
    "no-inline-cast-access": noInlineCastAccessRule,
    "no-known-value-widening": noKnownValueWideningRule,
    "no-long-comments": noLongCommentsRule,
    "no-module-mocking": noModuleMockingRule,
    "no-new-promise": noNewPromiseRule,
    "no-object-parameters": noObjectParametersRule,
    "no-partial-record-satisfies": noPartialRecordSatisfiesRule,
    "no-path-prefix-containment": noPathPrefixContainmentRule,
    "no-physical-properties": noPhysicalPropertiesRule,
    "no-placeholder-comment": noPlaceholderCommentRule,
    "no-process-env-outside-boundary": noProcessEnvOutsideBoundaryRule,
    "no-reflect-apply": noReflectApplyRule,
    "no-reflect-get": noReflectGetRule,
    "no-return-type-utility": noReturnTypeUtilityRule,
    "no-runtime-typeof": noRuntimeTypeofRule,
    "no-silent-skip": noSilentSkipRule,
    "no-source-text-assertions": noSourceTextAssertionsRule,
    "no-spread-input-in-query-key": noSpreadInputInQueryKeyRule,
    "no-static-set-map": noStaticSetMapRule,
    "no-string-discriminant": noStringDiscriminantRule,
    "no-swallowed-error": noSwallowedErrorRule,
    "no-string-id-alias": noStringIdAliasRule,
    "no-swallowed-rejection": noSwallowedRejectionRule,
    "no-tiny-functions": noTinyFunctionsRule,
    "no-typescript-enum": noTypescriptEnumRule,
    "no-ui-presence-tests": noUiPresenceTestsRule,
    "no-unused-catch-binding": noUnusedCatchBindingRule,
    "no-unsafe-dictionary-type": noUnsafeDictionaryTypeRule,
    "no-unsafe-inner-html": noUnsafeInnerHtmlRule,
    "no-untranslated-jsx-literal": noUntranslatedJsxLiteralRule,
    "no-shape-in-symbol-names": noForbiddenTermInSymbolNamesRule,
    "no-unknown-parameters": noUnknownParametersRule,
    "no-unknown-returns": noUnknownReturnsRule,
    "no-unknown-type-aliases": noUnknownTypeAliasesRule,
    "no-vacuous-throw-assertion": noVacuousThrowAssertionRule,
    "no-widen-then-assert": noWidenThenAssertRule,
    "no-window-open": noWindowOpenRule,
    "require-fetch-timeout": requireFetchTimeoutRule,
    "require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertionRule,
    "require-suppression-description": requireSuppressionDescriptionRule
  }
});
var anti_slop_default = antiSlopPlugin;
export {
  anti_slop_default as default
};
