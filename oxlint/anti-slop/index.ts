import { eslintCompatPlugin } from "@oxlint/plugins"

import { noAsyncContextEnterWithRule } from "./rules/no-async-context-enter-with.ts"
import { noBannerCommentsRule } from "./rules/no-banner-comments.ts"
import { noBooleanIfReturnRule } from "./rules/no-boolean-if-return.ts"
import { noChainedTypeAssertionsRule } from "./rules/no-chained-type-assertions.ts"
import { noClosingBraceLabelRule } from "./rules/no-closing-brace-label.ts"
import { noConditionalEmptyObjectSpreadRule } from "./rules/no-conditional-empty-object-spread.ts"
import { noDocumentCookieRule } from "./rules/no-document-cookie.ts"
import { noEagerSingletonRule } from "./rules/no-eager-singleton.ts"
import { noEmptyIfChainRule } from "./rules/no-empty-if-chain.ts"
import { noForeignDirectiveRule } from "./rules/no-foreign-directive.ts"
import { noIcuInvalidLocaleRule } from "./rules/no-icu-invalid-locale.ts"
import { noIcuMissingOtherRule } from "./rules/no-icu-missing-other.ts"
import { noInlineCastAccessRule } from "./rules/no-inline-cast-access.ts"
import { noKnownValueWideningRule } from "./rules/no-known-value-widening.ts"
import { noLongCommentsRule } from "./rules/no-long-comments.ts"
import { noModuleMockingRule } from "./rules/no-module-mocking.ts"
import { noNewPromiseRule } from "./rules/no-new-promise.ts"
import { noObjectParametersRule } from "./rules/no-object-parameters.ts"
import { noPartialRecordSatisfiesRule } from "./rules/no-partial-record-satisfies.ts"
import { noPathPrefixContainmentRule } from "./rules/no-path-prefix-containment.ts"
import { noPhysicalPropertiesRule } from "./rules/no-physical-properties.ts"
import { noPlaceholderCommentRule } from "./rules/no-placeholder-comment.ts"
import { noProcessEnvOutsideBoundaryRule } from "./rules/no-process-env-outside-boundary.ts"
import { noReflectApplyRule } from "./rules/no-reflect-apply.ts"
import { noReflectGetRule } from "./rules/no-reflect-get.ts"
import { noReturnTypeUtilityRule } from "./rules/no-return-type-utility.ts"
import { noRuntimeTypeofRule } from "./rules/no-runtime-typeof.ts"
import { noForbiddenTermInSymbolNamesRule } from "./rules/no-shape-in-symbol-names.ts"
import { noSilentSkipRule } from "./rules/no-silent-skip.ts"
import { noSourceTextAssertionsRule } from "./rules/no-source-text-assertions.ts"
import { noSpreadInputInQueryKeyRule } from "./rules/no-spread-input-in-query-key.ts"
import { noStaticSetMapRule } from "./rules/no-static-set-map.ts"
import { noStringDiscriminantRule } from "./rules/no-string-discriminant.ts"
import { noSwallowedErrorRule } from "./rules/no-swallowed-error.ts"
import { noStringIdAliasRule } from "./rules/no-string-id-alias.ts"
import { noSwallowedRejectionRule } from "./rules/no-swallowed-rejection.ts"
import { noTinyFunctionsRule } from "./rules/no-tiny-functions.ts"
import { noTypescriptEnumRule } from "./rules/no-typescript-enum.ts"
import { noUiPresenceTestsRule } from "./rules/no-ui-presence-tests.ts"
import { noUnknownParametersRule } from "./rules/no-unknown-parameters.ts"
import { noUnknownReturnsRule } from "./rules/no-unknown-returns.ts"
import { noUnknownTypeAliasesRule } from "./rules/no-unknown-type-aliases.ts"
import { noUnsafeDictionaryTypeRule } from "./rules/no-unsafe-dictionary-type.ts"
import { noUnsafeInnerHtmlRule } from "./rules/no-unsafe-inner-html.ts"
import { noUntranslatedJsxLiteralRule } from "./rules/no-untranslated-jsx-literal.ts"
import { noUnusedCatchBindingRule } from "./rules/no-unused-catch-binding.ts"
import { noVacuousThrowAssertionRule } from "./rules/no-vacuous-throw-assertion.ts"
import { noWidenThenAssertRule } from "./rules/no-widen-then-assert.ts"
import { noWindowOpenRule } from "./rules/no-window-open.ts"
import { requireFetchTimeoutRule } from "./rules/require-fetch-timeout.ts"
import { requireSafetyCommentForTypeAssertionRule } from "./rules/require-safety-comment-for-type-assertion.ts"
import { requireSuppressionDescriptionRule } from "./rules/require-suppression-description.ts"

/** Generic Oxlint rules that reject low-evidence and low-signal implementation patterns. */
const antiSlopPlugin = eslintCompatPlugin({
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
    "require-suppression-description": requireSuppressionDescriptionRule,
  },
})

export default antiSlopPlugin
