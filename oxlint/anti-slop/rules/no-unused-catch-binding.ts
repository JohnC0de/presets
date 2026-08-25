import { defineRule } from "@oxlint/plugins";

/** Ban `catch (_err)` — unused errors belong in a bare `catch {`. */
export const noUnusedCatchBindingRule = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Disallow underscore-prefixed catch bindings; use a bare catch clause instead.",
    },
    messages: {
      unusedCatch:
        "This catch binding is unused. Write `catch {` when the error value is discarded.",
    },
  },
  createOnce(context) {
    return {
      CatchClause(node) {
        const param = node.param;
        if (param === null || param === undefined || param.type !== "Identifier") return;
        if (!param.name.startsWith("_")) return;
        context.report({ node: param, messageId: "unusedCatch" });
      },
    };
  },
});
