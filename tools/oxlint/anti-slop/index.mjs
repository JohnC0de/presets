// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/index.ts
import { eslintCompatPlugin } from "@oxlint/plugins";

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-array-filter-map.ts
import { defineRule } from "@oxlint/plugins";

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/shared/array-method.ts
function unwrapArrayExpression(node) {
  while (node.type === "ParenthesizedExpression" || node.type === "ChainExpression" || node.type === "TSAsExpression" || node.type === "TSTypeAssertion" || node.type === "TSNonNullExpression" || node.type === "TSSatisfiesExpression") {
    node = node.expression;
  }
  return node;
}
function resolveArrayBinding(sourceCode, node) {
  node = unwrapArrayExpression(node);
  if (node.type !== "Identifier")
    return null;
  let scope = sourceCode.getScope(node);
  while (scope !== null) {
    const variable = scope.set.get(node.name);
    if (variable !== undefined)
      return variable;
    scope = scope.upper;
  }
  return null;
}
function arrayMethodTarget(node) {
  node = unwrapArrayExpression(node);
  if (node.type !== "MemberExpression")
    return null;
  const property = node.property;
  if (!node.computed && property.type === "Identifier") {
    return { name: property.name, object: node.object };
  }
  if (node.computed && property.type === "Literal" && typeof property.value === "string") {
    return { name: property.value, object: node.object };
  }
  return null;
}
function isArrayAnnotation(type) {
  if (type.type === "TSArrayType" || type.type === "TSTupleType")
    return true;
  if (type.type === "TSParenthesizedType")
    return isArrayAnnotation(type.typeAnnotation);
  if (type.type === "TSTypeOperator" && type.operator === "readonly") {
    return isArrayAnnotation(type.typeAnnotation);
  }
  return type.type === "TSTypeReference" && type.typeName.type === "Identifier" && (type.typeName.name === "Array" || type.typeName.name === "ReadonlyArray");
}
function isKnownArrayExpression(sourceCode, node, visited = new Set) {
  node = unwrapArrayExpression(node);
  if (node.type === "ArrayExpression")
    return true;
  if (node.type === "CallExpression") {
    const method = arrayMethodTarget(node.callee);
    return method !== null && ["map", "filter", "flatMap", "slice", "concat", "toSorted", "toReversed", "toSpliced"].includes(method.name) && isKnownArrayExpression(sourceCode, method.object, visited);
  }
  if (node.type !== "Identifier")
    return false;
  const variable = resolveArrayBinding(sourceCode, node);
  if (variable === null || visited.has(variable))
    return false;
  visited.add(variable);
  if (variable.references.some((reference) => reference.isWrite() && !reference.init))
    return false;
  for (const identifier of variable.identifiers) {
    const annotation = identifier.typeAnnotation?.typeAnnotation;
    if (annotation !== undefined)
      return isArrayAnnotation(annotation);
  }
  for (const definition of variable.defs) {
    if (definition.type === "Variable" && definition.node.type === "VariableDeclarator" && definition.node.id.type === "Identifier" && definition.node.init !== null && definition.node.parent.type === "VariableDeclaration" && definition.node.parent.kind === "const") {
      return isKnownArrayExpression(sourceCode, definition.node.init, visited);
    }
  }
  return false;
}

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-array-filter-map.ts
var noArrayFilterMapRule = defineRule({
  meta: {
    type: "suggestion",
    docs: {
      description: "Disallow adjacent array filter/map passes in favor of lazy iterator helpers or a single transformation."
    },
    messages: {
      arrayFilterMap: "Avoid consecutive array `{{first}}` and `{{second}}` passes. Prefer `.values().{{first}}(...).{{second}}(...).toArray()` where iterator helpers are supported, or a single `flatMap`/mutating reducer. Preserve callback ordering, indexes, and filtering semantics."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const outer = arrayMethodTarget(node.callee);
        if (outer === null || outer.name !== "map" && outer.name !== "filter")
          return;
        const innerCall = unwrapArrayExpression(outer.object);
        if (innerCall.type !== "CallExpression")
          return;
        const inner = arrayMethodTarget(innerCall.callee);
        if (inner === null || inner.name !== (outer.name === "map" ? "filter" : "map"))
          return;
        if (!isKnownArrayExpression(context.sourceCode, inner.object))
          return;
        context.report({
          node,
          messageId: "arrayFilterMap",
          data: { first: inner.name, second: outer.name }
        });
      }
    };
  }
});

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-reduce-accumulator-copy.ts
import { defineRule as defineRule2 } from "@oxlint/plugins";
function enclosingReducer(node) {
  let parent = node.parent;
  while (parent !== null) {
    if (parent.type === "FunctionDeclaration")
      return null;
    if (parent.type === "ArrowFunctionExpression" || parent.type === "FunctionExpression") {
      const callback = parent;
      let owner = callback.parent;
      while (owner !== null && unwrapArrayExpression(owner) === callback)
        owner = owner.parent;
      if (owner?.type !== "CallExpression")
        return null;
      const method = arrayMethodTarget(owner.callee);
      const firstArgument = owner.arguments[0];
      if (method === null || method.name !== "reduce" && method.name !== "reduceRight" || owner.arguments.length > 2 || firstArgument === undefined || unwrapArrayExpression(firstArgument) !== callback)
        return null;
      const firstParameter = callback.params[0];
      const accumulator = firstParameter?.type === "AssignmentPattern" ? firstParameter.left : firstParameter;
      if (accumulator?.type !== "Identifier")
        return null;
      return { callback, accumulator, initialValue: owner.arguments[1] };
    }
    parent = parent.parent;
  }
  return null;
}
function referencesAccumulator(sourceCode, node, accumulator, visited = new Set) {
  const variable = resolveArrayBinding(sourceCode, node);
  if (variable === null || visited.has(variable))
    return false;
  if (variable === accumulator)
    return true;
  visited.add(variable);
  if (variable.references.some((reference) => reference.isWrite() && !reference.init))
    return false;
  for (const definition of variable.defs) {
    if (definition.type === "Variable" && definition.node.type === "VariableDeclarator" && definition.node.id.type === "Identifier" && definition.node.init !== null && definition.node.parent.type === "VariableDeclaration" && definition.node.parent.kind === "const") {
      return referencesAccumulator(sourceCode, definition.node.init, accumulator, visited);
    }
  }
  return false;
}
function isGlobalCopyOwner(sourceCode, node, name) {
  node = unwrapArrayExpression(node);
  if (node.type !== "Identifier" || node.name !== name)
    return false;
  const variable = resolveArrayBinding(sourceCode, node);
  return variable === null || variable.defs.length === 0;
}
var noReduceAccumulatorCopyRule = defineRule2({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow copying growing reducer accumulators with Object.assign, Array.from, or array copy methods."
    },
    messages: {
      accumulatorCopy: "Do not copy the reducer accumulator on every iteration; growing copies can cause quadratic work. Mutate a fresh, locally owned accumulator and return it, or use an iterator pipeline/flatMap."
    }
  },
  createOnce(context) {
    return {
      CallExpression(node) {
        const method = arrayMethodTarget(node.callee);
        if (method === null)
          return;
        const reducer = enclosingReducer(node);
        if (reducer === null)
          return;
        const accumulator = context.sourceCode.getDeclaredVariables(reducer.callback).find((variable) => variable.identifiers.some((identifier) => identifier.start === reducer.accumulator.start));
        if (accumulator === undefined)
          return;
        const isAccumulator = (expression) => referencesAccumulator(context.sourceCode, expression, accumulator);
        let copiesAccumulator = false;
        if (method.name === "assign" && isGlobalCopyOwner(context.sourceCode, method.object, "Object")) {
          const target = node.arguments[0];
          copiesAccumulator = target !== undefined && unwrapArrayExpression(target).type === "ObjectExpression" && node.arguments.slice(1).some(isAccumulator);
        } else if (method.name === "from" && isGlobalCopyOwner(context.sourceCode, method.object, "Array")) {
          const source = node.arguments[0];
          copiesAccumulator = source !== undefined && isAccumulator(source);
        } else if (["concat", "slice", "toSpliced", "toSorted", "toReversed", "with"].includes(method.name)) {
          const initialValue = reducer.initialValue;
          const arrayAccumulator = initialValue !== undefined && isKnownArrayExpression(context.sourceCode, initialValue);
          copiesAccumulator = arrayAccumulator && isAccumulator(method.object);
        }
        if (copiesAccumulator)
          context.report({ node, messageId: "accumulatorCopy" });
      }
    };
  }
});

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/vendor/eslint-stylistic/padding-line-ast.ts
var LINEBREAKS = new Set([`\r
`, "\r", `
`, "\u2028", "\u2029"]);
var isClosingBraceToken = (token) => token.type === "Punctuator" && token.value === "}";
var isSemicolonToken = (token) => token.type === "Punctuator" && token.value === ";";
var isNotSemicolonToken = (token) => !isSemicolonToken(token);
var isTokenOnSameLine = (left, right) => left.loc.end.line === right.loc.start.line;
var isFunction = (node) => node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression";
var isSingleLine = (node) => node.loc.start.line === node.loc.end.line;
var skipChainExpression = (node) => node.type === "ChainExpression" ? node.expression : node;
var isTopLevelExpressionStatement = (node) => node.type === "ExpressionStatement" && (node.parent.type === "Program" || node.parent.type === "BlockStatement" && isFunction(node.parent.parent));
function isParenthesized(node, sourceCode) {
  const before = sourceCode.getTokenBefore(node);
  const after = sourceCode.getTokenAfter(node);
  return before?.value === "(" && after?.value === ")";
}

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/vendor/eslint-stylistic/padding-line-between-statements.ts
var CJS_EXPORT = /^(?:module\s*\.\s*)?exports(?:\s*\.|\s*\[|$)/u;
var CJS_IMPORT = /^require\(/u;
var LT = `[${Array.from(LINEBREAKS).join("")}]`;
var PADDING_LINE_SEQUENCE = new RegExp(String.raw`^(\s*?${LT})\s*${LT}(\s*;?)$`, "u");
function isSelectorOption(option) {
  return typeof option === "object" && !Array.isArray(option);
}
function newKeywordTester(type, keyword) {
  return {
    test(node, sourceCode) {
      const isSameKeyword = sourceCode.getFirstToken(node)?.value === keyword;
      const isSameType = Array.isArray(type) ? type.includes(node.type) : type === node.type;
      return isSameKeyword && isSameType;
    }
  };
}
function newNodeTypeTester(type) {
  return {
    test: (node) => node.type === type
  };
}
function isIIFEStatement(node) {
  if (node.type === "ExpressionStatement") {
    let expression = skipChainExpression(node.expression);
    if (expression.type === "UnaryExpression")
      expression = skipChainExpression(expression.argument);
    if (expression.type === "CallExpression") {
      let node = expression.callee;
      while (node.type === "SequenceExpression") {
        const lastExpression = node.expressions.at(-1);
        if (lastExpression === undefined)
          throw new Error("Padding rule invariant: sequence expression is empty");
        node = lastExpression;
      }
      return isFunction(node);
    }
  }
  return false;
}
function isCJSRequire(node) {
  if (node.type === "VariableDeclaration") {
    const declaration = node.declarations[0];
    if (declaration?.init) {
      let call = declaration?.init;
      while (call.type === "MemberExpression")
        call = call.object;
      if (call.type === "CallExpression" && call.callee.type === "Identifier") {
        return call.callee.name === "require";
      }
    }
  }
  return false;
}
function isBlockLikeStatement(node, sourceCode) {
  if (node.type === "DoWhileStatement" && node.body.type === "BlockStatement") {
    return true;
  }
  if (isIIFEStatement(node))
    return true;
  const lastToken = sourceCode.getLastToken(node, isNotSemicolonToken);
  const belongingNode = lastToken && isClosingBraceToken(lastToken) ? sourceCode.getNodeByRangeIndex(lastToken.range[0]) : null;
  return !!belongingNode && (belongingNode.type === "BlockStatement" || belongingNode.type === "SwitchStatement");
}
function isDirective(node, sourceCode) {
  return isTopLevelExpressionStatement(node) && node.expression.type === "Literal" && typeof node.expression.value === "string" && !isParenthesized(node.expression, sourceCode);
}
function isDirectivePrologue(node, sourceCode) {
  if (isDirective(node, sourceCode) && node.parent && "body" in node.parent && Array.isArray(node.parent.body)) {
    for (const sibling of node.parent.body) {
      if (sibling === node)
        break;
      if (!isDirective(sibling, sourceCode))
        return false;
    }
    return true;
  }
  return false;
}
function isCJSExport(node) {
  if (node.type === "ExpressionStatement") {
    const expression = node.expression;
    if (expression.type === "AssignmentExpression") {
      let left = expression.left;
      if (left.type === "MemberExpression") {
        while (left.object.type === "MemberExpression")
          left = left.object;
        return left.object.type === "Identifier" && (left.object.name === "exports" || left.object.name === "module" && left.property.type === "Identifier" && left.property.name === "exports");
      }
    }
  }
  return false;
}
function isExpression(node, sourceCode) {
  return node.type === "ExpressionStatement" && !isDirectivePrologue(node, sourceCode);
}
function getActualLastToken(node, sourceCode) {
  const semiToken = sourceCode.getLastToken(node);
  const prevToken = sourceCode.getTokenBefore(semiToken);
  const nextToken = sourceCode.getTokenAfter(semiToken);
  const isSemicolonLessStyle = prevToken && nextToken && prevToken.range[0] >= node.range[0] && isSemicolonToken(semiToken) && !isTokenOnSameLine(prevToken, semiToken) && isTokenOnSameLine(semiToken, nextToken);
  return isSemicolonLessStyle ? prevToken : semiToken;
}
function replacerToRemovePaddingLines(_, trailingSpaces, indentSpaces) {
  return trailingSpaces + indentSpaces;
}
function getReportLoc(node, sourceCode) {
  if (isSingleLine(node))
    return node.loc;
  const line = node.loc.start.line;
  const sourceLine = sourceCode.lines[line - 1];
  if (sourceLine === undefined)
    throw new Error("Padding rule invariant: statement source line is missing");
  return {
    start: node.loc.start,
    end: {
      line,
      column: sourceLine.length
    }
  };
}
function verifyForAny() {}
function verifyForNever(context, _, nextNode, paddingLines) {
  if (paddingLines.length === 0)
    return;
  context.report({
    node: nextNode,
    messageId: "unexpectedBlankLine",
    loc: getReportLoc(nextNode, context.sourceCode),
    fix(fixer) {
      if (paddingLines.length >= 2)
        return null;
      const paddingPair = paddingLines[0];
      if (paddingPair === undefined)
        throw new Error("Padding rule invariant: reported padding pair is missing");
      const [prevToken, nextToken] = paddingPair;
      const start = prevToken.range[1];
      const end = nextToken.range[0];
      const text = context.sourceCode.text.slice(start, end).replace(PADDING_LINE_SEQUENCE, replacerToRemovePaddingLines);
      return fixer.replaceTextRange([start, end], text);
    }
  });
}
function verifyForAlways(context, prevNode, nextNode, paddingLines) {
  if (paddingLines.length > 0)
    return;
  context.report({
    node: nextNode,
    messageId: "expectedBlankLine",
    loc: getReportLoc(nextNode, context.sourceCode),
    fix(fixer) {
      const sourceCode = context.sourceCode;
      let prevToken = getActualLastToken(prevNode, sourceCode);
      const nextToken = sourceCode.getFirstTokenBetween(prevToken, nextNode, {
        includeComments: true,
        filter(token) {
          if (isTokenOnSameLine(prevToken, token)) {
            prevToken = token;
            return false;
          }
          return true;
        }
      }) || nextNode;
      const insertText = isTokenOnSameLine(prevToken, nextToken) ? `

` : `
`;
      return fixer.insertTextAfter(prevToken, insertText);
    }
  });
}
var PaddingTypes = {
  any: { verify: verifyForAny },
  never: { verify: verifyForNever },
  always: { verify: verifyForAlways }
};
var MaybeMultilineStatementType = {
  "block-like": { test: isBlockLikeStatement },
  expression: { test: isExpression },
  return: newKeywordTester("ReturnStatement", "return"),
  export: newKeywordTester(["ExportAllDeclaration", "ExportDefaultDeclaration", "ExportNamedDeclaration"], "export"),
  var: newKeywordTester("VariableDeclaration", "var"),
  let: newKeywordTester("VariableDeclaration", "let"),
  const: newKeywordTester("VariableDeclaration", "const"),
  using: {
    test: (node) => node.type === "VariableDeclaration" && (node.kind === "using" || node.kind === "await using")
  },
  type: newKeywordTester("TSTypeAliasDeclaration", "type")
};
var StatementTypes = {
  "*": { test: () => true },
  exports: { test: isCJSExport },
  require: { test: isCJSRequire },
  directive: { test: isDirectivePrologue },
  iife: { test: isIIFEStatement },
  block: newNodeTypeTester("BlockStatement"),
  empty: newNodeTypeTester("EmptyStatement"),
  function: newNodeTypeTester("FunctionDeclaration"),
  "ts-method": newNodeTypeTester("TSMethodSignature"),
  break: newKeywordTester("BreakStatement", "break"),
  case: newKeywordTester("SwitchCase", "case"),
  class: newKeywordTester("ClassDeclaration", "class"),
  continue: newKeywordTester("ContinueStatement", "continue"),
  debugger: newKeywordTester("DebuggerStatement", "debugger"),
  default: newKeywordTester(["SwitchCase", "ExportDefaultDeclaration"], "default"),
  do: newKeywordTester("DoWhileStatement", "do"),
  for: newKeywordTester(["ForStatement", "ForInStatement", "ForOfStatement"], "for"),
  if: newKeywordTester("IfStatement", "if"),
  import: newKeywordTester("ImportDeclaration", "import"),
  switch: newKeywordTester("SwitchStatement", "switch"),
  throw: newKeywordTester("ThrowStatement", "throw"),
  try: newKeywordTester("TryStatement", "try"),
  while: newKeywordTester(["WhileStatement", "DoWhileStatement"], "while"),
  with: newKeywordTester("WithStatement", "with"),
  "cjs-export": {
    test: (node, sourceCode) => node.type === "ExpressionStatement" && node.expression.type === "AssignmentExpression" && CJS_EXPORT.test(sourceCode.getText(node.expression.left))
  },
  "cjs-import": {
    test: (node, sourceCode) => node.type === "VariableDeclaration" && node.declarations.length > 0 && node.declarations[0]?.init != null && CJS_IMPORT.test(sourceCode.getText(node.declarations[0].init))
  },
  enum: newKeywordTester("TSEnumDeclaration", "enum"),
  interface: newKeywordTester("TSInterfaceDeclaration", "interface"),
  "function-overload": newNodeTypeTester("TSDeclareFunction"),
  ...Object.fromEntries(Object.entries(MaybeMultilineStatementType).flatMap(([key, value]) => [
    [key, value],
    [
      `singleline-${key}`,
      {
        ...value,
        test: (node, sourceCode) => value.test(node, sourceCode) && isSingleLine(node)
      }
    ],
    [
      `multiline-${key}`,
      {
        ...value,
        test: (node, sourceCode) => value.test(node, sourceCode) && !isSingleLine(node)
      }
    ]
  ]))
};
function createPaddingLineRule(options) {
  return {
    meta: {
      type: "layout",
      docs: {
        description: "Require or disallow padding lines between statements"
      },
      fixable: "whitespace",
      hasSuggestions: false,
      schema: {
        $defs: {
          paddingType: {
            type: "string",
            enum: Object.keys(PaddingTypes)
          },
          statementType: {
            type: "string",
            enum: Object.keys(StatementTypes)
          },
          selectorOption: {
            type: "object",
            properties: {
              selector: {
                type: "string"
              },
              lineMode: {
                type: "string",
                enum: ["any", "singleline", "multiline"]
              }
            },
            required: ["selector"],
            additionalProperties: false
          },
          statementMatcher: {
            anyOf: [{ $ref: "#/$defs/statementType" }, { $ref: "#/$defs/selectorOption" }]
          },
          statementOption: {
            anyOf: [
              { $ref: "#/$defs/statementMatcher" },
              {
                type: "array",
                items: { $ref: "#/$defs/statementMatcher" },
                minItems: 1,
                uniqueItems: true,
                additionalItems: false
              }
            ]
          }
        },
        type: "array",
        additionalItems: false,
        items: {
          type: "object",
          properties: {
            blankLine: { $ref: "#/$defs/paddingType" },
            prev: { $ref: "#/$defs/statementOption" },
            next: { $ref: "#/$defs/statementOption" }
          },
          additionalProperties: false,
          required: ["blankLine", "prev", "next"]
        }
      },
      messages: {
        unexpectedBlankLine: "Unexpected blank line before this statement.",
        expectedBlankLine: "Expected blank line before this statement."
      }
    },
    create(context) {
      const sourceCode = context.sourceCode;
      const selectorMatchedNodes = new Map;
      const pendingPairs = [];
      function collectSelectorOption(option) {
        if (Array.isArray(option)) {
          for (const item of option)
            collectSelectorOption(item);
          return;
        }
        if (!isSelectorOption(option))
          return;
        selectorMatchedNodes.set(option.selector, new Set);
      }
      for (const configure of options) {
        collectSelectorOption(configure.prev);
        collectSelectorOption(configure.next);
      }
      let scopeInfo = null;
      function enterScope() {
        scopeInfo = {
          upper: scopeInfo,
          prevNode: null
        };
      }
      function exitScope() {
        if (scopeInfo)
          scopeInfo = scopeInfo.upper;
      }
      function match(node, type) {
        let innerStatementNode = node;
        while (innerStatementNode.type === "LabeledStatement")
          innerStatementNode = innerStatementNode.body;
        if (Array.isArray(type))
          return type.some(match.bind(null, innerStatementNode));
        if (isSelectorOption(type)) {
          const matchedNodes = selectorMatchedNodes.get(type.selector);
          if (!matchedNodes?.has(innerStatementNode))
            return false;
          const lineMode = type.lineMode;
          if (lineMode === "singleline")
            return isSingleLine(innerStatementNode);
          else if (lineMode === "multiline")
            return !isSingleLine(innerStatementNode);
          return true;
        } else {
          const statementType = StatementTypes[type];
          if (statementType === undefined)
            throw new Error(`Padding rule invariant: unsupported statement type ${type}`);
          return statementType.test(innerStatementNode, sourceCode);
        }
      }
      function getPaddingType(prevNode, nextNode) {
        for (let i = options.length - 1;i >= 0; --i) {
          const configure = options[i];
          if (configure === undefined)
            throw new Error("Padding rule invariant: configuration entry is missing");
          if (match(prevNode, configure.prev) && match(nextNode, configure.next)) {
            return PaddingTypes[configure.blankLine];
          }
        }
        return PaddingTypes.any;
      }
      function getPaddingLineSequences(prevNode, nextNode) {
        const pairs = [];
        let prevToken = getActualLastToken(prevNode, sourceCode);
        if (nextNode.loc.start.line - prevToken.loc.end.line >= 2) {
          do {
            const token = sourceCode.getTokenAfter(prevToken, {
              includeComments: true
            });
            if (token.loc.start.line - prevToken.loc.end.line >= 2)
              pairs.push([prevToken, token]);
            prevToken = token;
          } while (prevToken.range[0] < nextNode.range[0]);
        }
        return pairs;
      }
      function verify(node) {
        if (!node.parent || ![
          "BlockStatement",
          "Program",
          "StaticBlock",
          "SwitchCase",
          "SwitchStatement",
          "TSInterfaceBody",
          "TSModuleBlock",
          "TSTypeLiteral"
        ].includes(node.parent.type)) {
          return;
        }
        const prevNode = scopeInfo.prevNode;
        if (prevNode)
          pendingPairs.push({ prevNode, nextNode: node });
        scopeInfo.prevNode = node;
      }
      function verifyPendingPairs() {
        for (const { prevNode, nextNode } of pendingPairs) {
          const type = getPaddingType(prevNode, nextNode);
          const paddingLines = getPaddingLineSequences(prevNode, nextNode);
          type.verify(context, prevNode, nextNode, paddingLines);
        }
      }
      function verifyThenEnterScope(node) {
        verify(node);
        enterScope();
      }
      const selectorMatchListeners = Object.fromEntries(Array.from(selectorMatchedNodes.keys(), (selector) => [
        selector,
        (node) => {
          selectorMatchedNodes.get(selector)?.add(node);
        }
      ]));
      return {
        Program: enterScope,
        "Program:exit": () => {
          verifyPendingPairs();
          exitScope();
        },
        BlockStatement: enterScope,
        "BlockStatement:exit": exitScope,
        SwitchStatement: enterScope,
        "SwitchStatement:exit": exitScope,
        SwitchCase: verifyThenEnterScope,
        "SwitchCase:exit": exitScope,
        StaticBlock: enterScope,
        "StaticBlock:exit": exitScope,
        TSInterfaceBody: enterScope,
        "TSInterfaceBody:exit": exitScope,
        TSModuleBlock: enterScope,
        "TSModuleBlock:exit": exitScope,
        TSTypeLiteral: enterScope,
        "TSTypeLiteral:exit": exitScope,
        TSDeclareFunction: verifyThenEnterScope,
        "TSDeclareFunction:exit": exitScope,
        TSMethodSignature: verifyThenEnterScope,
        "TSMethodSignature:exit": exitScope,
        ":statement": verify,
        ...selectorMatchListeners
      };
    }
  };
}

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/require-readable-spacing.ts
var paddingRule = createPaddingLineRule([
  { blankLine: "always", prev: "import", next: "*" },
  { blankLine: "always", prev: "*", next: { selector: "Program > :not(ImportDeclaration)" } },
  { blankLine: "always", prev: { selector: "Program > :not(ImportDeclaration)" }, next: "*" },
  { blankLine: "always", prev: "*", next: ["function", "class", "interface", "type"] },
  { blankLine: "always", prev: ["function", "class", "interface", "type"], next: "*" },
  {
    blankLine: "always",
    prev: "*",
    next: ["multiline-const", "multiline-let", "multiline-var", "multiline-using"]
  },
  {
    blankLine: "always",
    prev: ["multiline-const", "multiline-let", "multiline-var", "multiline-using"],
    next: "*"
  },
  { blankLine: "always", prev: "*", next: ["return", "if", "switch", "try", "for", "while", "do"] },
  { blankLine: "always", prev: "block-like", next: "*" },
  { blankLine: "any", prev: "import", next: "import" },
  {
    blankLine: "any",
    prev: {
      selector: ':matches(TSDeclareFunction, ExportNamedDeclaration[declaration.type="TSDeclareFunction"])'
    },
    next: {
      selector: ':matches(TSDeclareFunction, FunctionDeclaration, ExportNamedDeclaration[declaration.type="TSDeclareFunction"], ExportNamedDeclaration[declaration.type="FunctionDeclaration"])'
    }
  }
]);
var requireReadableSpacingRule = {
  ...paddingRule,
  meta: {
    ...paddingRule.meta,
    docs: {
      description: "Require readable spacing between declarations and logical statement groups."
    },
    schema: []
  }
};

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-async-context-enter-with.ts
import { defineRule as defineRule3 } from "@oxlint/plugins";
var noAsyncContextEnterWithRule = defineRule3({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-banner-comments.ts
import { defineRule as defineRule4 } from "@oxlint/plugins";
var BANNER = /^\s*(?:[=*#-]{4,}|(?:phase|step|section|part)\s+\d)\b/iu;
var noBannerCommentsRule = defineRule4({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-boolean-if-return.ts
import { defineRule as defineRule5 } from "@oxlint/plugins";
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
var noBooleanIfReturnRule = defineRule5({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-chained-type-assertions.ts
import { defineRule as defineRule6 } from "@oxlint/plugins";
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
var noChainedTypeAssertionsRule = defineRule6({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-closing-brace-label.ts
import { defineRule as defineRule7 } from "@oxlint/plugins";
var END_LABEL = /^\s*end(?:\s+\w+)?\s*$/iu;
var noClosingBraceLabelRule = defineRule7({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-conditional-empty-object-spread.ts
import { defineRule as defineRule8 } from "@oxlint/plugins";
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
var noConditionalEmptyObjectSpreadRule = defineRule8({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-document-cookie.ts
import { defineRule as defineRule9 } from "@oxlint/plugins";
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
var noDocumentCookieRule = defineRule9({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-eager-singleton.ts
import { defineRule as defineRule10 } from "@oxlint/plugins";
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
  const value = key === "callNames" ? "callNames" in options ? options.callNames : undefined : ("newNames" in options) ? options.newNames : undefined;
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}
var noEagerSingletonRule = defineRule10({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-empty-if-chain.ts
import { defineRule as defineRule11 } from "@oxlint/plugins";
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
var noEmptyIfChainRule = defineRule11({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-foreign-directive.ts
import { defineRule as defineRule12 } from "@oxlint/plugins";
var FOREIGN = /\b(?:biome-ignore|prettier-ignore)\b/u;
var noForeignDirectiveRule = defineRule12({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-icu-invalid-locale.ts
import { defineRule as defineRule13 } from "@oxlint/plugins";
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
var noIcuInvalidLocaleRule = defineRule13({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-icu-missing-other.ts
import { defineRule as defineRule14 } from "@oxlint/plugins";
var KIND = /,\s*(?:plural|selectordinal|select)\s*,/u;
var OTHER = /\bother\s*\{/u;
function missingOther(value) {
  return KIND.test(value) && !OTHER.test(value);
}
var noIcuMissingOtherRule = defineRule14({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-inline-cast-access.ts
import { defineRule as defineRule15 } from "@oxlint/plugins";
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
var noInlineCastAccessRule = defineRule15({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-known-value-widening.ts
import { defineRule as defineRule16 } from "@oxlint/plugins";

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/shared/lexical-type-parameters.ts
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/shared/type-alias-resolution.ts
var environmentsByProgram = new WeakMap;
function isNode2(value) {
  return typeof value === "object" && value !== null && "type" in value && typeof value.type === "string";
}
function enclosingTypeScope(node) {
  let current = node.parent;
  while (current !== null) {
    if (current.type === "Program" || current.type === "BlockStatement" || current.type === "TSModuleBlock" || current.type === "StaticBlock" || current.type === "SwitchStatement") {
      return current;
    }
    current = current.parent;
  }
  return node;
}
function declaredTypeBinding(node) {
  if (node.type === "TSTypeAliasDeclaration") {
    return { alias: node, name: node.id.name };
  }
  if (node.type === "TSInterfaceDeclaration" || node.type === "TSEnumDeclaration" || node.type === "ClassDeclaration" || node.type === "ClassExpression") {
    return node.id === null ? null : { alias: null, name: node.id.name };
  }
  if (node.type === "ImportSpecifier" || node.type === "ImportDefaultSpecifier" || node.type === "ImportNamespaceSpecifier") {
    return { alias: null, name: node.local.name };
  }
  return null;
}
function collectTypeBindings(node, visitorKeys, bindingsByName, aliases) {
  const declared = declaredTypeBinding(node);
  if (declared !== null) {
    const bindings = bindingsByName.get(declared.name) ?? [];
    bindings.push({ ...declared, scope: enclosingTypeScope(node) });
    bindingsByName.set(declared.name, bindings);
    if (declared.alias !== null)
      aliases.push(declared.alias);
  }
  const fields = node;
  for (const key of visitorKeys[node.type] ?? []) {
    const value = fields[key];
    if (isNode2(value)) {
      collectTypeBindings(value, visitorKeys, bindingsByName, aliases);
      continue;
    }
    if (!Array.isArray(value))
      continue;
    for (const child of value) {
      if (isNode2(child)) {
        collectTypeBindings(child, visitorKeys, bindingsByName, aliases);
      }
    }
  }
}
function createTypeAliasEnvironment(program, visitorKeys) {
  const cached = environmentsByProgram.get(program);
  if (cached !== undefined)
    return cached;
  const bindingsByName = new Map;
  const aliases = [];
  collectTypeBindings(program, visitorKeys, bindingsByName, aliases);
  const environment = { aliases, bindingsByName, visitorKeys };
  environmentsByProgram.set(program, environment);
  return environment;
}
function ancestorDistance(ancestor, node) {
  let current = node;
  let distance = 0;
  while (current !== null) {
    if (current === ancestor)
      return distance;
    current = current.parent;
    distance += 1;
  }
  return null;
}
function nearestTypeBindings(name, use, environment) {
  const candidates = environment.bindingsByName.get(name) ?? [];
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearest = [];
  for (const candidate of candidates) {
    const distance = ancestorDistance(candidate.scope, use);
    if (distance === null || distance > nearestDistance)
      continue;
    if (distance === nearestDistance) {
      nearest.push(candidate);
      continue;
    }
    nearestDistance = distance;
    nearest = [candidate];
  }
  return nearest;
}
function visibleTypeAlias(name, use, environment) {
  if (lexicalTypeParameterNames(use, environment.visitorKeys).has(name))
    return null;
  const bindings = nearestTypeBindings(name, use, environment);
  return bindings.length === 1 ? bindings[0]?.alias ?? null : null;
}
function hasVisibleTypeBinding(name, use, environment) {
  return lexicalTypeParameterNames(use, environment.visitorKeys).has(name) || nearestTypeBindings(name, use, environment).length > 0;
}
function typeReferenceName(type) {
  return type.typeName.type === "Identifier" ? type.typeName.name : null;
}
function aliasSubstitutions(alias, reference, base) {
  const parameters = alias.typeParameters?.params ?? [];
  const arguments_ = reference.typeArguments?.params ?? [];
  const next = new Map(base);
  for (const [index, parameter] of parameters.entries()) {
    const explicitArgument = arguments_[index];
    const argument = explicitArgument ?? parameter.default;
    if (argument === null || argument === undefined)
      return null;
    const argumentSubstitutions = explicitArgument === undefined ? next : base;
    next.set(parameter.name.name, {
      type: argument,
      substitutions: new Map(argumentSubstitutions)
    });
  }
  return next;
}
function resolvedTypeMatches(type, environment, matcher) {
  const evaluate = (current, substitutions, resolvingAliases) => {
    if (current.type === "TSTypeReference") {
      const name = typeReferenceName(current);
      if (name !== null) {
        const substitution = substitutions.get(name);
        if (substitution !== undefined && !current.typeArguments?.params.length) {
          return evaluate(substitution.type, substitution.substitutions, resolvingAliases);
        }
        const alias = visibleTypeAlias(name, current, environment);
        if (alias !== null && !resolvingAliases.has(alias)) {
          const nextSubstitutions = aliasSubstitutions(alias, current, substitutions);
          if (nextSubstitutions !== null) {
            const nextResolving = new Set(resolvingAliases);
            nextResolving.add(alias);
            return evaluate(alias.typeAnnotation, nextSubstitutions, nextResolving);
          }
        }
      }
    }
    return matcher(current, (child) => evaluate(child, substitutions, resolvingAliases));
  };
  return evaluate(type, new Map, new Set);
}

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/shared/dictionary-types.ts
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
function createTypeEnvironment(program, visitorKeys) {
  const interfaces = new Map;
  for (const statement of program.body) {
    const declaration = declaredStatement(statement);
    if (declaration?.type !== "TSInterfaceDeclaration")
      continue;
    const declarations = interfaces.get(declaration.id.name) ?? [];
    declarations.push(declaration);
    interfaces.set(declaration.id.name, declarations);
  }
  return {
    interfaces,
    typeAliases: createTypeAliasEnvironment(program, visitorKeys)
  };
}
function typeReferenceName2(type) {
  return type.typeName.type === "Identifier" ? type.typeName.name : null;
}
function isBuiltIn(name, use, environment) {
  return BUILT_INS.has(name) && !hasVisibleTypeBinding(name, use, environment.typeAliases);
}
function isUnappliedReferenceTo(type, name) {
  const unwrapped = unwrapTransparentType(type);
  return unwrapped.type === "TSTypeReference" && typeReferenceName2(unwrapped) === name && (unwrapped.typeArguments === null || unwrapped.typeArguments === undefined || unwrapped.typeArguments.params.length === 0);
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
  const name = typeReferenceName2(unwrapped);
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
    return unsafeMembers.length > 0 && unsafeMembers.every((member) => member !== null) ? unsafeMembers[0] ?? null : null;
  }
  if (unwrapped.type !== "TSTypeReference")
    return null;
  const name = typeReferenceName2(unwrapped);
  if (name === null)
    return null;
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, unwrapped, environment)) {
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
  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);
  if (alias === null || resolvingAliases.has(name))
    return null;
  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
  if (nextSubstitutions === null)
    return null;
  const nextResolving = new Set(resolvingAliases);
  nextResolving.add(name);
  return unsafeDirectValue(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
}
function dictionaryValueTypes(type, environment, substitutions, resolvingAliases) {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSTypeLiteral") {
    return unwrapped.members.flatMap((member) => member.type === "TSIndexSignature" && member.typeAnnotation !== null ? [{ type: member.typeAnnotation.typeAnnotation, substitutions }] : []);
  }
  if (unwrapped.type === "TSMappedType") {
    return unwrapped.typeAnnotation === null ? [] : [{ type: unwrapped.typeAnnotation, substitutions }];
  }
  if (unwrapped.type !== "TSTypeReference")
    return [];
  const name = typeReferenceName2(unwrapped);
  if (name === null)
    return [];
  const substitution = substitutions.get(name);
  if (substitution !== undefined) {
    return isUnappliedReferenceTo(substitution, name) ? [] : dictionaryValueTypes(substitution, environment, substitutions, resolvingAliases);
  }
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, unwrapped, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined ? [] : dictionaryValueTypes(wrapped, environment, substitutions, resolvingAliases);
  }
  if (name === "Record" && isBuiltIn(name, unwrapped, environment)) {
    const value = unwrapped.typeArguments?.params[1] ?? null;
    return value === null ? [] : [{ type: value, substitutions }];
  }
  if ((name === "Pick" || name === "Omit") && isBuiltIn(name, unwrapped, environment)) {
    const source = unwrapped.typeArguments?.params[0];
    return source === undefined ? [] : dictionaryValueTypes(source, environment, substitutions, resolvingAliases);
  }
  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);
  if (alias === null || resolvingAliases.has(name))
    return [];
  const nextSubstitutions = aliasSubstitution(alias, unwrapped, substitutions);
  if (nextSubstitutions === null)
    return [];
  const nextResolving = new Set(resolvingAliases);
  nextResolving.add(name);
  return dictionaryValueTypes(alias.typeAnnotation, environment, nextSubstitutions, nextResolving);
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
  const name = typeReferenceName2(unwrapped);
  if (name === null)
    return null;
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, unwrapped, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined ? null : classifyWideningTarget(wrapped, environment);
  }
  if (name === "Record" && isBuiltIn(name, unwrapped, environment)) {
    return hasBroadRecordKey(unwrapped, environment, new Map) ? { kind: "open dictionary" } : null;
  }
  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);
  if (alias === null)
    return null;
  if ((alias.typeParameters?.params.length ?? 0) > 0) {
    const substitutions = aliasSubstitution(alias, unwrapped, new Map);
    const resolved = substitutions === null ? null : classifyAliasBroadTarget(alias.typeAnnotation, environment, substitutions, new Set([name]));
    return resolved?.kind === "open dictionary" ? { kind: "generic container" } : null;
  }
  const substitutions = aliasSubstitution(alias, unwrapped, new Map);
  if (substitutions === null)
    return null;
  const resolved = classifyAliasBroadTarget(alias.typeAnnotation, environment, substitutions, new Set([name]));
  return resolved;
}
function hasBroadRecordKey(type, environment, substitutions) {
  const key = type.typeArguments?.params[0];
  return key === undefined || isBroadMappedKey(key, environment, substitutions);
}
function isBroadMappedKey(type, environment, substitutions, visitedAliases = new Set) {
  const unwrapped = unwrapTransparentType(type);
  if (unwrapped.type === "TSStringKeyword" || unwrapped.type === "TSNumberKeyword" || unwrapped.type === "TSSymbolKeyword") {
    return true;
  }
  if (unwrapped.type === "TSUnionType") {
    return unwrapped.types.some((member) => isBroadMappedKey(member, environment, substitutions, visitedAliases));
  }
  if (unwrapped.type !== "TSTypeReference")
    return false;
  const name = typeReferenceName2(unwrapped);
  if (name === null)
    return false;
  const substitution = substitutions.get(name);
  if (substitution !== undefined && !isUnappliedReferenceTo(substitution, name)) {
    return isBroadMappedKey(substitution, environment, substitutions, visitedAliases);
  }
  if (name === "PropertyKey" && isBuiltIn(name, unwrapped, environment))
    return true;
  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);
  if (alias === null || (alias.typeParameters?.params.length ?? 0) > 0 || visitedAliases.has(name)) {
    return false;
  }
  const nextVisited = new Set(visitedAliases);
  nextVisited.add(name);
  return isBroadMappedKey(alias.typeAnnotation, environment, substitutions, nextVisited);
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
  const name = typeReferenceName2(unwrapped);
  if (name === null)
    return null;
  const substitution = substitutions.get(name);
  if (substitution !== undefined) {
    return isUnappliedReferenceTo(substitution, name) ? null : classifyAliasBroadTarget(substitution, environment, substitutions, resolvingAliases);
  }
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, unwrapped, environment)) {
    const wrapped = unwrapped.typeArguments?.params[0];
    return wrapped === undefined ? null : classifyAliasBroadTarget(wrapped, environment, substitutions, resolvingAliases);
  }
  if (name === "Record" && isBuiltIn(name, unwrapped, environment)) {
    return hasBroadRecordKey(unwrapped, environment, substitutions) ? { kind: "open dictionary" } : null;
  }
  const alias = visibleTypeAlias(name, unwrapped, environment.typeAliases);
  if (alias === null || resolvingAliases.has(name))
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/shared/function-parameters.ts
function containsUnknownType(type) {
  if (type.type === "TSUnknownKeyword")
    return true;
  if (type.type === "TSParenthesizedType")
    return containsUnknownType(type.typeAnnotation);
  return type.type === "TSUnionType" && type.types.some(containsUnknownType);
}
function functionParameterTypeAnnotation(parameter) {
  if (parameter.type === "TSParameterProperty") {
    return functionParameterTypeAnnotation(parameter.parameter);
  }
  if (parameter.type === "RestElement") {
    return parameter.typeAnnotation ?? functionParameterTypeAnnotation(parameter.argument);
  }
  if (parameter.type === "AssignmentPattern") {
    return parameter.typeAnnotation ?? functionParameterTypeAnnotation(parameter.left);
  }
  return parameter.typeAnnotation;
}
function functionParameterBindingName(parameter, sourceCode) {
  if (parameter.type === "TSParameterProperty") {
    return functionParameterBindingName(parameter.parameter, sourceCode);
  }
  if (parameter.type === "AssignmentPattern") {
    return functionParameterBindingName(parameter.left, sourceCode);
  }
  if (parameter.type === "RestElement") {
    return functionParameterBindingName(parameter.argument, sourceCode);
  }
  if (parameter.type === "Identifier")
    return parameter.name;
  const sourceText = sourceCode.getText(parameter);
  const annotationStart = parameter.typeAnnotation?.start;
  return annotationStart === undefined ? sourceText : sourceText.slice(0, annotationStart - parameter.start).trimEnd();
}

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/shared/scope.ts
function resolveVariable(sourceCode, identifier) {
  let scope = sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined)
      return variable;
    scope = scope.upper;
  }
  return null;
}

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-known-value-widening.ts
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
  const variable = resolveVariable(sourceCode, unwrapped);
  if (variable === null || visitedVariables.has(variable))
    return false;
  const declarator = variableDeclarator(variable);
  if (declarator === null || declarator.init === null || !isStableConstVariable(variable, declarator)) {
    return false;
  }
  visitedVariables.add(variable);
  return hasKnownEvidence(sourceCode, declarator.init, visitedVariables);
}
function isFunctionExpression(node) {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "TSDeclareFunction" || node.type === "TSEmptyBodyFunctionExpression";
}
function localFunctionForCall(sourceCode, callee) {
  const unwrapped = unwrapExpression(callee);
  if (isFunctionExpression(unwrapped))
    return unwrapped;
  if (unwrapped.type !== "Identifier")
    return null;
  const variable = resolveVariable(sourceCode, unwrapped);
  if (variable === null || variable.defs.length !== 1)
    return null;
  const [definition] = variable.defs;
  if (definition === undefined)
    return null;
  if (definition.type === "FunctionName" && isFunctionExpression(definition.node)) {
    return definition.node;
  }
  if (definition.type !== "Variable" || definition.node.type !== "VariableDeclarator") {
    return null;
  }
  const initializer = definition.node.init;
  if (initializer === null)
    return null;
  const unwrappedInitializer = unwrapExpression(initializer);
  return isFunctionExpression(unwrappedInitializer) ? unwrappedInitializer : null;
}
function variableTypeAnnotation(sourceCode, variable) {
  if (variable.defs.length !== 1)
    return null;
  const [definition] = variable.defs;
  if (definition === undefined)
    return null;
  if (definition.type === "Variable" && definition.node.type === "VariableDeclarator" && definition.node.id.type === "Identifier") {
    return definition.node.id.typeAnnotation ?? null;
  }
  if (definition.type !== "Parameter" || !isFunctionExpression(definition.node)) {
    return null;
  }
  const parameter = definition.node.params.find((candidate) => functionParameterBindingName(candidate, sourceCode) === variable.name);
  return parameter === undefined ? null : functionParameterTypeAnnotation(parameter) ?? null;
}
function hasInformativeType(type, environment) {
  return classifyUnsafeDictionaryValue(type, environment) === null;
}
function hasKnownCallArgumentEvidence(sourceCode, expression, environment, visitedVariables = new Set) {
  if (expression.type === "ParenthesizedExpression" || expression.type === "TSNonNullExpression") {
    return hasKnownCallArgumentEvidence(sourceCode, expression.expression, environment, visitedVariables);
  }
  if (expression.type === "TSAsExpression" || expression.type === "TSTypeAssertion") {
    return hasInformativeType(expression.typeAnnotation, environment);
  }
  if (expression.type === "TSSatisfiesExpression") {
    return hasKnownCallArgumentEvidence(sourceCode, expression.expression, environment, visitedVariables);
  }
  if (expression.type === "CallExpression") {
    const owner = localFunctionForCall(sourceCode, expression.callee);
    const returnType = owner?.returnType?.typeAnnotation;
    return returnType !== undefined && hasInformativeType(returnType, environment);
  }
  if (expression.type !== "Identifier")
    return isKnownEvidenceExpression(expression);
  const variable = resolveVariable(sourceCode, expression);
  if (variable === null || visitedVariables.has(variable))
    return false;
  const annotation = variableTypeAnnotation(sourceCode, variable);
  if (annotation !== null) {
    return hasInformativeType(annotation.typeAnnotation, environment);
  }
  const declarator = variableDeclarator(variable);
  if (declarator === null || declarator.init === null || !isStableConstVariable(variable, declarator)) {
    return false;
  }
  visitedVariables.add(variable);
  return hasKnownCallArgumentEvidence(sourceCode, declarator.init, environment, visitedVariables);
}
function typePredicateSubjectIndex(sourceCode, owner) {
  const predicate = owner.returnType?.typeAnnotation;
  if (predicate?.type !== "TSTypePredicate" || predicate.parameterName.type !== "Identifier") {
    return null;
  }
  const predicateParameterName = predicate.parameterName.name;
  const index = owner.params.findIndex((parameter) => functionParameterBindingName(parameter, sourceCode) === predicateParameterName);
  return index === -1 ? null : index;
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
var noKnownValueWideningRule = defineRule16({
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
        environment = createTypeEnvironment(node, context.sourceCode.visitorKeys);
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
        const variable = resolveVariable(context.sourceCode, node.left);
        if (variable === null)
          return;
        const declarator = variableDeclarator(variable);
        if (declarator === null || declarator.id.type !== "Identifier")
          return;
        reportFlow(node.right, targetFromAnnotation(declarator.id.typeAnnotation), `binding \`${declarator.id.name}\``);
      },
      CallExpression(node) {
        if (environment === null)
          return;
        const owner = localFunctionForCall(context.sourceCode, node.callee);
        if (owner === null)
          return;
        const parameterIndex = typePredicateSubjectIndex(context.sourceCode, owner);
        if (parameterIndex === null)
          return;
        const parameter = owner.params[parameterIndex];
        const argument = node.arguments[parameterIndex];
        if (parameter === undefined || argument === undefined || argument.type === "SpreadElement") {
          return;
        }
        const parameterAnnotation = functionParameterTypeAnnotation(parameter);
        if (parameterAnnotation === null || parameterAnnotation === undefined || !containsUnknownType(parameterAnnotation.typeAnnotation)) {
          return;
        }
        if (!hasKnownCallArgumentEvidence(context.sourceCode, argument, environment)) {
          return;
        }
        context.report({
          node: argument,
          messageId: "widening",
          data: {
            subject: `argument for parameter \`${functionParameterBindingName(parameter, context.sourceCode)}\` of \`${functionName(context.sourceCode, owner)}\``,
            target: "unknown"
          }
        });
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-long-comments.ts
import { defineRule as defineRule17 } from "@oxlint/plugins";
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
var noLongCommentsRule = defineRule17({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-module-mocking.ts
import { defineRule as defineRule18 } from "@oxlint/plugins";
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
  const variable = resolveVariable(sourceCode, expression);
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
var noModuleMockingRule = defineRule18({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-new-promise.ts
import { defineRule as defineRule19 } from "@oxlint/plugins";
var noNewPromiseRule = defineRule19({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-object-parameters.ts
import { defineRule as defineRule20 } from "@oxlint/plugins";
var noObjectParametersRule = defineRule20({
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
    let environment = null;
    const resolvesToObject = (type) => environment !== null && resolvedTypeMatches(type, environment, (resolved, matches) => {
      if (resolved.type === "TSObjectKeyword")
        return true;
      if (resolved.type === "TSParenthesizedType") {
        return matches(resolved.typeAnnotation);
      }
      return resolved.type === "TSUnionType" && resolved.types.some(matches);
    });
    const checkParameters = (node) => {
      for (const parameter of node.params) {
        const annotation = functionParameterTypeAnnotation(parameter);
        if (annotation === null || annotation === undefined)
          continue;
        if (!resolvesToObject(annotation.typeAnnotation))
          continue;
        context.report({
          node: annotation.typeAnnotation,
          messageId: "objectParameter",
          data: { parameter: functionParameterBindingName(parameter, context.sourceCode) }
        });
      }
    };
    return {
      Program(node) {
        environment = createTypeAliasEnvironment(node, context.sourceCode.visitorKeys);
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-partial-record-satisfies.ts
import { defineRule as defineRule21 } from "@oxlint/plugins";
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
var noPartialRecordSatisfiesRule = defineRule21({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-path-prefix-containment.ts
import { defineRule as defineRule22 } from "@oxlint/plugins";
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
var noPathPrefixContainmentRule = defineRule22({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-physical-properties.ts
import { defineRule as defineRule23 } from "@oxlint/plugins";

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/shared/physical-properties.ts
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-physical-properties.ts
var noPhysicalPropertiesRule = defineRule23({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-placeholder-comment.ts
import { defineRule as defineRule24 } from "@oxlint/plugins";
var PLACEHOLDER = /\b(your code here|implementation here|add your logic|helper function|todo:\s*implement(?:\s+this)?)\b/iu;
var noPlaceholderCommentRule = defineRule24({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-process-env-outside-boundary.ts
import { defineRule as defineRule25 } from "@oxlint/plugins";

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/shared/filename.ts
function filenameOf(context) {
  return (context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/");
}
function isTestPath(filename) {
  return /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(filename) || /\/(?:test|tests|__tests__)(?:\/|$)/u.test(filename);
}

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-process-env-outside-boundary.ts
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
  const propertyName = staticPropertyName(node);
  if (propertyName === null)
    return "process.env[...]";
  return node.computed ? `process.env[${JSON.stringify(propertyName)}]` : `process.env.${propertyName}`;
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
  const value = "allowedFiles" in options ? options.allowedFiles : undefined;
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}
var noProcessEnvOutsideBoundaryRule = defineRule25({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-reflect-apply.ts
import { defineRule as defineRule26 } from "@oxlint/plugins";

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/shared/reflect-method.ts
function isGlobalReflect(sourceCode, expression) {
  if (expression.type !== "Identifier" || expression.name !== "Reflect")
    return false;
  if (sourceCode.isGlobalReference(expression))
    return true;
  const variable = resolveVariable(sourceCode, expression);
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-reflect-apply.ts
var noReflectApplyRule = defineRule26({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-reflect-get.ts
import { defineRule as defineRule27 } from "@oxlint/plugins";
var noReflectGetRule = defineRule27({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-return-type-utility.ts
import { defineRule as defineRule28 } from "@oxlint/plugins";
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
function typeReferenceName3(node) {
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
var noReturnTypeUtilityRule = defineRule28({
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
        if (typeReferenceName3(node) !== "ReturnType" || isAllowedReturnType(node))
          return;
        context.report({ node, messageId: "returnType" });
      }
    };
  }
});

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-runtime-typeof.ts
import { defineRule as defineRule29 } from "@oxlint/plugins";
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
function isExistenceProbe(node) {
  const parent = node.parent;
  if (parent.type !== "BinaryExpression")
    return false;
  if (!["===", "!==", "==", "!="].includes(parent.operator))
    return false;
  const other = parent.left === node ? parent.right : parent.left;
  return other.type === "Literal" && other.value === "undefined";
}
var noRuntimeTypeofRule = defineRule29({
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
        if (node.operator === "typeof" && !isExistenceProbe(node) && (!allowInTypeGuards || !isInsideTypeGuard(node))) {
          context.report({ node, messageId: "runtimeTypeof" });
        }
      }
    };
  }
});

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-shape-in-symbol-names.ts
import { defineRule as defineRule30 } from "@oxlint/plugins";
var FORBIDDEN_SYMBOL_NAME = "shape";
function containsForbiddenSymbolName(name) {
  return name.toLowerCase().includes(FORBIDDEN_SYMBOL_NAME);
}
function isBorrowedMemberName(node) {
  const parent = node.parent;
  if (parent === null || parent.type !== "MemberExpression")
    return false;
  return parent.property === node && parent.computed === false;
}
var noForbiddenTermInSymbolNamesRule = defineRule30({
  meta: {
    type: "problem",
    docs: {
      description: 'Disallow the case-insensitive substring "shape" in JavaScript, TypeScript, private, and JSX symbol names.'
    },
    messages: {
      forbiddenSymbolName: 'Rename symbol "{{name}}" for its domain role; "shape" describes structure rather than ownership.'
    },
    schema: [{
      type: "object",
      properties: {
        targets: { enum: ["symbols", "declarations"] },
        allowedPatterns: { type: "array", items: { type: "string", format: "regex" } },
        caseInsensitive: { type: "boolean" }
      },
      additionalProperties: false
    }]
  },
  createOnce(context) {
    let declarations = false;
    let allowed = [];
    const reportName = (node, name) => {
      if (!containsForbiddenSymbolName(name) || allowed.some((pattern) => pattern.test(name)))
        return;
      context.report({ node, messageId: "forbiddenSymbolName", data: { name } });
    };
    const reportSymbol = (node) => {
      if (!declarations && !isBorrowedMemberName(node))
        reportName(node, node.name);
    };
    const reportDeclaration = (node) => {
      if (!declarations)
        return;
      const binding = "id" in node ? node.id : ("key" in node) ? node.key : null;
      if (binding?.type === "Identifier" || binding?.type === "PrivateIdentifier") {
        reportName(binding, binding.name);
      } else if (binding?.type === "Literal" && typeof binding.value === "string") {
        reportName(binding, binding.value);
      }
    };
    return {
      before() {
        declarations = false;
        allowed = [];
        const options = context.options[0];
        if (typeof options !== "object" || options === null || Array.isArray(options))
          return;
        declarations = options.targets === "declarations";
        if (!Array.isArray(options.allowedPatterns))
          return;
        allowed = options.allowedPatterns.filter((pattern) => typeof pattern === "string").map((pattern) => new RegExp(pattern, options.caseInsensitive === false ? "u" : "iu"));
      },
      Identifier: reportSymbol,
      PrivateIdentifier(node) {
        if (declarations)
          reportName(node, node.name);
        else
          reportSymbol(node);
      },
      JSXIdentifier(node) {
        if (!declarations)
          reportSymbol(node);
        else if (node.parent?.type === "JSXOpeningElement" || node.parent?.type === "JSXAttribute") {
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
      MethodDefinition: reportDeclaration
    };
  }
});

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-silent-skip.ts
import { defineRule as defineRule31 } from "@oxlint/plugins";
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
var noSilentSkipRule = defineRule31({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-source-text-assertions.ts
import { defineRule as defineRule32 } from "@oxlint/plugins";
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
var noSourceTextAssertionsRule = defineRule32({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-spread-input-in-query-key.ts
import { defineRule as defineRule33 } from "@oxlint/plugins";
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
var noSpreadInputInQueryKeyRule = defineRule33({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-static-set-map.ts
import { defineRule as defineRule34 } from "@oxlint/plugins";
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
  return key !== null && key !== undefined && key.type !== "SpreadElement" && isLiteralKey(key);
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
var noStaticSetMapRule = defineRule34({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-string-discriminant.ts
import { defineRule as defineRule35 } from "@oxlint/plugins";
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
var noStringDiscriminantRule = defineRule35({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-swallowed-error.ts
import { defineRule as defineRule36 } from "@oxlint/plugins";
function isConsoleCall(statement) {
  if (statement.type !== "ExpressionStatement")
    return false;
  const expression = statement.expression;
  if (expression.type !== "CallExpression")
    return false;
  const callee = expression.callee;
  return callee.type === "MemberExpression" && !callee.computed && callee.object.type === "Identifier" && callee.object.name === "console" && callee.property.type === "Identifier";
}
var noSwallowedErrorRule = defineRule36({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-string-id-alias.ts
import { defineRule as defineRule37 } from "@oxlint/plugins";
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
var noStringIdAliasRule = defineRule37({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-swallowed-rejection.ts
import { defineRule as defineRule38 } from "@oxlint/plugins";
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
var noSwallowedRejectionRule = defineRule38({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-tiny-functions.ts
import { defineRule as defineRule39 } from "@oxlint/plugins";
function isFunctionNode2(node) {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration" || node.type === "FunctionExpression";
}
function unwrapParenthesizedAncestor(node) {
  let current = node;
  let parent = node.parent;
  while (parent?.type === "ParenthesizedExpression" && parent.expression === current) {
    current = parent;
    parent = parent.parent;
  }
  return { current, parent };
}
function isExportDeclaration(node) {
  return node?.type === "ExportNamedDeclaration" || node?.type === "ExportDefaultDeclaration";
}
function isExported(node) {
  const { current, parent } = unwrapParenthesizedAncestor(node);
  if (isExportDeclaration(parent))
    return true;
  if (parent?.type !== "VariableDeclarator" || parent.init !== current)
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
  if (parent?.type === "CallExpression" || parent?.type === "NewExpression") {
    return parent.arguments.some((argument) => argument === current);
  }
  if (parent?.type === "JSXExpressionContainer") {
    return true;
  }
  return parent?.type === "Property" && parent.value === current && !parent.method;
}
function returnedExpression(node) {
  if (node.type === "ArrowFunctionExpression" && node.body.type !== "BlockStatement")
    return node.body;
  const body = node.body;
  if (body === null || body.type !== "BlockStatement" || body.body.length !== 1)
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
var noTinyFunctionsRule = defineRule39({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-typescript-enum.ts
import { defineRule as defineRule40 } from "@oxlint/plugins";
function importedName2(node) {
  if (node.type !== "ImportSpecifier")
    return null;
  return node.imported.type === "Identifier" ? node.imported.name : String(node.imported.value);
}
var noTypescriptEnumRule = defineRule40({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-ui-presence-tests.ts
import { defineRule as defineRule41 } from "@oxlint/plugins";
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
var noUiPresenceTestsRule = defineRule41({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-unknown-parameters.ts
import { defineRule as defineRule42 } from "@oxlint/plugins";
var DEFAULT_ALLOWED_NAMES = ["cause"];
function isTypePredicateSubject(owner, parameterName) {
  const predicate = owner.returnType?.typeAnnotation;
  return predicate?.type === "TSTypePredicate" && predicate.parameterName.type === "Identifier" && predicate.parameterName.name === parameterName;
}
var noUnknownParametersRule = defineRule42({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow explicitly unknown function parameters except `cause` and type-predicate subjects; decode unknown input at its I/O boundary instead."
    },
    messages: {
      unknownParameter: "Parameter `{{parameter}}` leaves input unparsed. Accept a named domain type; run the expected schema or parser at the I/O boundary before calling this function."
    },
    schema: [{
      type: "object",
      properties: {
        allowedNames: { type: "array", items: { type: "string" } },
        caseInsensitive: { type: "boolean" },
        allowInTypeGuards: { type: "boolean" }
      },
      additionalProperties: false
    }]
  },
  createOnce(context) {
    const checkParameters = (node) => {
      const value = context.options[0];
      const options = typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined;
      if (options?.allowInTypeGuards === true && node.returnType?.typeAnnotation.type === "TSTypePredicate")
        return;
      const caseInsensitive = options?.caseInsensitive === true;
      const allowedNames = Array.isArray(options?.allowedNames) ? options.allowedNames.filter((name) => typeof name === "string") : DEFAULT_ALLOWED_NAMES;
      for (const parameter of node.params) {
        const annotation = functionParameterTypeAnnotation(parameter);
        if (annotation === null || annotation === undefined)
          continue;
        if (!containsUnknownType(annotation.typeAnnotation))
          continue;
        const name = functionParameterBindingName(parameter, context.sourceCode);
        if (allowedNames.some((allowed) => caseInsensitive ? allowed.toLowerCase() === name.toLowerCase() : allowed === name) || isTypePredicateSubject(node, name))
          continue;
        context.report({
          node: annotation.typeAnnotation,
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-unknown-returns.ts
import { defineRule as defineRule43 } from "@oxlint/plugins";
var noUnknownReturnsRule = defineRule43({
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
    let environment = null;
    const resolvesToUnknown = (type) => environment !== null && resolvedTypeMatches(type, environment, (resolved, matches) => {
      if (resolved.type === "TSUnknownKeyword")
        return true;
      if (resolved.type === "TSParenthesizedType") {
        return matches(resolved.typeAnnotation);
      }
      if (resolved.type === "TSUnionType")
        return resolved.types.some(matches);
      if (resolved.type !== "TSTypeReference" || resolved.typeName.type !== "Identifier" || resolved.typeName.name !== "Promise" && resolved.typeName.name !== "PromiseLike") {
        return false;
      }
      const value = resolved.typeArguments?.params[0];
      return value !== undefined && matches(value);
    });
    const checkReturnType = (node) => {
      const annotation = node.returnType;
      if (annotation === null || annotation === undefined)
        return;
      if (!resolvesToUnknown(annotation.typeAnnotation))
        return;
      context.report({ node: annotation.typeAnnotation, messageId: "unknownReturn" });
    };
    return {
      Program(node) {
        environment = createTypeAliasEnvironment(node, context.sourceCode.visitorKeys);
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-unknown-type-aliases.ts
import { defineRule as defineRule44 } from "@oxlint/plugins";
var noUnknownTypeAliasesRule = defineRule44({
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
    let environment = null;
    const resolvesToUnknown = (type) => environment !== null && resolvedTypeMatches(type, environment, (resolved, matches) => {
      if (resolved.type === "TSUnknownKeyword")
        return true;
      if (resolved.type === "TSParenthesizedType") {
        return matches(resolved.typeAnnotation);
      }
      return resolved.type === "TSUnionType" && resolved.types.some(matches);
    });
    return {
      Program(node) {
        environment = createTypeAliasEnvironment(node, context.sourceCode.visitorKeys);
      },
      TSTypeAliasDeclaration(node) {
        if (!resolvesToUnknown(node.typeAnnotation))
          return;
        context.report({
          node: node.id,
          messageId: "unknownAlias",
          data: { alias: node.id.name }
        });
      }
    };
  }
});

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-unsafe-dictionary-type.ts
import { defineRule as defineRule45 } from "@oxlint/plugins";
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
function typeReferenceName4(type) {
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
  const name = typeReferenceName4(node);
  return name !== null && visibleTypeAlias(name, node, environment.typeAliases) !== null && !isInsideTypeAliasDeclaration(node);
}
function isInsideTypeParameterConstraint(node) {
  let child = node;
  let parent = child.parent;
  while (parent !== null && parent.type !== "Program") {
    if (parent.type === "TSTypeParameter" && parent.constraint === child)
      return true;
    child = parent;
    parent = child.parent;
  }
  return false;
}
function shouldReportType(node, environment) {
  if (isInsideTypeParameterConstraint(node))
    return false;
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
var noUnsafeDictionaryTypeRule = defineRule45({
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
        environment = createTypeEnvironment(node, context.sourceCode.visitorKeys);
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-unsafe-inner-html.ts
import { defineRule as defineRule46 } from "@oxlint/plugins";
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
var noUnsafeInnerHtmlRule = defineRule46({
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
        if (isStaticHtml(node.value))
          return;
        if (hasSafeHtmlComment(context.sourceCode, node))
          return;
        context.report({ node, messageId: "unsafe" });
      }
    };
  }
});

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-untranslated-jsx-literal.ts
import { defineRule as defineRule47 } from "@oxlint/plugins";
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
var noUntranslatedJsxLiteralRule = defineRule47({
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
        ignored.clear();
        for (const name of DEFAULT_IGNORED)
          ignored.add(name);
        extraAllowed.clear();
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-unused-catch-binding.ts
import { defineRule as defineRule48 } from "@oxlint/plugins";
var noUnusedCatchBindingRule = defineRule48({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-vacuous-throw-assertion.ts
import { defineRule as defineRule49 } from "@oxlint/plugins";
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
var noVacuousThrowAssertionRule = defineRule49({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-widen-then-assert.ts
import { defineRule as defineRule50 } from "@oxlint/plugins";
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
function typeReferenceName5(type) {
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
  return unwrapped.type === "TSTypeReference" && typeReferenceName5(unwrapped) === "PropertyKey";
}
function isBroadRecordType(type) {
  const unwrapped = unwrapTypeParentheses(type);
  if (unwrapped.type === "TSTypeReference") {
    if (typeReferenceName5(unwrapped) === "Readonly") {
      const [inner] = unwrapped.typeArguments?.params ?? [];
      return inner !== undefined && isBroadRecordType(inner);
    }
    if (typeReferenceName5(unwrapped) !== "Record")
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
  if (typeReferenceName5(unwrapped) === "Readonly") {
    const [inner] = unwrapped.typeArguments?.params ?? [];
    return inner !== undefined && isDefinitelyNarrowerRecordType(inner);
  }
  if (typeReferenceName5(unwrapped) !== "Record")
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
function resolvedVariableForIdentifier(scopes, identifier) {
  for (const scope of scopes) {
    const reference = scope.references.find((candidate) => candidate.identifier.start === identifier.start && candidate.identifier.end === identifier.end);
    if (reference !== undefined)
      return reference.resolved;
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
function knownValueEvidence(expression, scopes, boundary, visitedVariables) {
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
  const variable = resolvedVariableForIdentifier(scopes, unwrapped);
  if (variable === null || visitedVariables.has(variable))
    return null;
  const annotatedIdentifier = variable.identifiers.find((identifier) => identifier.typeAnnotation !== null && identifier.typeAnnotation !== undefined);
  const annotation = annotatedIdentifier?.typeAnnotation?.typeAnnotation;
  if (annotation !== undefined && annotatedIdentifier !== undefined) {
    if (functionBoundary(annotatedIdentifier) !== boundary || broadTypeKind(annotation) !== null) {
      return null;
    }
    return { type: annotation };
  }
  const declarator = variableDeclarator2(variable);
  if (declarator === null || declarator.parent.type !== "VariableDeclaration" || declarator.parent.kind !== "const" || declarator.init === null || variable.references.some((reference) => reference.isWrite() && !reference.init) || functionBoundary(declarator) !== boundary) {
    return null;
  }
  return knownValueEvidence(declarator.init, scopes, boundary, new Set([...visitedVariables, variable]));
}
function widenedBinding(variable, scopes) {
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
  const evidence = knownValueEvidence(originalExpression, scopes, boundary, new Set([variable]));
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
var noWidenThenAssertRule = defineRule50({
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
    let scopes = [];
    const checkAssertion = (node) => {
      const expression = assertedExpression(node);
      if (expression.type !== "Identifier")
        return;
      const variable = resolvedVariableForIdentifier(scopes, expression);
      if (variable === null)
        return;
      const widened = widenedBinding(variable, scopes);
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
      Program() {
        scopes = context.sourceCode.scopeManager.scopes;
      },
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion
    };
  }
});

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/no-window-open.ts
import { defineRule as defineRule51 } from "@oxlint/plugins";
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
var noWindowOpenRule = defineRule51({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/require-fetch-timeout.ts
import { defineRule as defineRule52 } from "@oxlint/plugins";
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
var requireFetchTimeoutRule = defineRule52({
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

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/require-safety-comment-for-type-assertion.ts
import { defineRule as defineRule53 } from "@oxlint/plugins";
var DEFAULT_SAFETY_MARKERS = ["SAFETY"];
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
function configuredSafetyMarkers(option) {
  if (typeof option !== "object" || option === null || !("markers" in option)) {
    return DEFAULT_SAFETY_MARKERS;
  }
  const configured = option.markers;
  if (!Array.isArray(configured))
    return DEFAULT_SAFETY_MARKERS;
  const markers = configured.flatMap((marker) => typeof marker === "string" && marker.trim().length > 0 ? [marker.trim()] : []);
  return markers.length > 0 ? markers : DEFAULT_SAFETY_MARKERS;
}
function markerPattern(markers) {
  const alternation = markers.map((marker) => marker.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)).join("|");
  return new RegExp(String.raw`(?:^|[^\p{L}\p{N}_])(?:${alternation})\s*:\s*\S`, "u");
}
function hasSafetyJustificationBefore(sourceCode, owner, assertion, pattern) {
  return sourceCode.getCommentsBefore(owner).some((comment) => comment.end <= assertion.start && pattern.test(comment.value));
}
function hasSafetyComment(sourceCode, node, pattern) {
  let current = node;
  while (true) {
    if (hasSafetyJustificationBefore(sourceCode, current, node, pattern))
      return true;
    if (commentOwnerKinds.has(current.type)) {
      const exportDeclaration = current.parent;
      return exportDeclaration.type === "ExportNamedDeclaration" && exportDeclaration.declaration === current && hasSafetyJustificationBefore(sourceCode, exportDeclaration, node, pattern);
    }
    if (current.parent.type === "Program")
      return false;
    current = current.parent;
  }
}
var requireSafetyCommentForTypeAssertionRule = defineRule53({
  meta: {
    type: "problem",
    docs: {
      description: "Require a nearby SAFETY comment for every TypeScript type assertion except const assertions."
    },
    messages: {
      missingSafetyComment: "This type assertion has no `{{marker}}:` justification. State the checked invariant immediately before the assertion or its containing statement."
    },
    schema: [
      {
        type: "object",
        properties: {
          markers: {
            type: "array",
            items: { type: "string", minLength: 1 },
            minItems: 1,
            uniqueItems: true
          }
        },
        additionalProperties: false
      }
    ],
    defaultOptions: [{ markers: ["SAFETY"] }]
  },
  createOnce(context) {
    const patterns = new Map;
    const checkAssertion = (node) => {
      if (isConstAssertion2(node))
        return;
      const markers = configuredSafetyMarkers(context.options?.[0]);
      const patternKey = markers.join("\x00");
      const pattern = patterns.get(patternKey) ?? markerPattern(markers);
      patterns.set(patternKey, pattern);
      if (hasSafetyComment(context.sourceCode, node, pattern))
        return;
      context.report({
        node,
        messageId: "missingSafetyComment",
        data: { marker: markers[0] ?? DEFAULT_SAFETY_MARKERS[0] }
      });
    };
    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion
    };
  }
});

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/rules/require-suppression-description.ts
import { defineRule as defineRule54 } from "@oxlint/plugins";
var DISABLE = /\b(?:eslint|oxlint)-disable(?:-next-line|-line)?\b/u;
var ENABLE = /\b(?:eslint|oxlint)-enable\b/u;
var INLINE = /--\s*\S/u;
function isDirective2(text) {
  return DISABLE.test(text) || ENABLE.test(text);
}
var requireSuppressionDescriptionRule = defineRule54({
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
          const documented = comments.some((other) => other !== comment && !isDirective2(other.value) && other.loc?.end.line === lineAbove);
          if (documented)
            continue;
          context.report({ node: comment, messageId: "missing" });
        }
      }
    };
  }
});

// ../../tools.worktrees/PresetsPath/adapters/presets/oxlint/anti-slop/index.ts
var antiSlopPlugin = eslintCompatPlugin({
  meta: { name: "anti-slop" },
  rules: {
    "no-array-filter-map": noArrayFilterMapRule,
    "no-reduce-accumulator-copy": noReduceAccumulatorCopyRule,
    "require-readable-spacing": requireReadableSpacingRule,
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
