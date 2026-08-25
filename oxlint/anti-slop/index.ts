import { eslintCompatPlugin } from "@oxlint/plugins";

import { noChainedTypeAssertionsRule } from "./rules/no-chained-type-assertions.ts";
import { noConditionalEmptyObjectSpreadRule } from "./rules/no-conditional-empty-object-spread.ts";
import { noInlineCastAccessRule } from "./rules/no-inline-cast-access.ts";
import { noKnownValueWideningRule } from "./rules/no-known-value-widening.ts";
import { noModuleMockingRule } from "./rules/no-module-mocking.ts";
import { noNewPromiseRule } from "./rules/no-new-promise.ts";
import { noObjectParametersRule } from "./rules/no-object-parameters.ts";
import { noReflectApplyRule } from "./rules/no-reflect-apply.ts";
import { noReflectGetRule } from "./rules/no-reflect-get.ts";
import { noReturnTypeUtilityRule } from "./rules/no-return-type-utility.ts";
import { noRuntimeTypeofRule } from "./rules/no-runtime-typeof.ts";
import { noForbiddenTermInSymbolNamesRule } from "./rules/no-shape-in-symbol-names.ts";
import { noStaticSetMapRule } from "./rules/no-static-set-map.ts";
import { noStringDiscriminantRule } from "./rules/no-string-discriminant.ts";
import { noStringIdAliasRule } from "./rules/no-string-id-alias.ts";
import { noTinyFunctionsRule } from "./rules/no-tiny-functions.ts";
import { noTypescriptEnumRule } from "./rules/no-typescript-enum.ts";
import { noUnknownParametersRule } from "./rules/no-unknown-parameters.ts";
import { noUnknownReturnsRule } from "./rules/no-unknown-returns.ts";
import { noUnknownTypeAliasesRule } from "./rules/no-unknown-type-aliases.ts";
import { noUnsafeDictionaryTypeRule } from "./rules/no-unsafe-dictionary-type.ts";
import { noUnusedCatchBindingRule } from "./rules/no-unused-catch-binding.ts";
import { noWidenThenAssertRule } from "./rules/no-widen-then-assert.ts";
import { requireSafetyCommentForTypeAssertionRule } from "./rules/require-safety-comment-for-type-assertion.ts";

/** Generic Oxlint rules that reject low-evidence and low-signal implementation patterns. */
const antiSlopPlugin = eslintCompatPlugin({
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
    "require-safety-comment-for-type-assertion": requireSafetyCommentForTypeAssertionRule,
  },
});

export default antiSlopPlugin;
