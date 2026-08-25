# @john/presets

Shared tooling for personal repos under `projects/personal` (and labs that opt in).
No build step — the package is config files + anti-slop oxlint plugin + a tiny sync script.

Boviom / work repos stay on their own tooling (Effect / Tailwind plugins are domain-local).

## Install

```sh
bun add -d github:JohnC0de/presets
bun add -d oxlint@1.80.0 @oxlint/plugins@1.80.0 oxlint-tsgolint@7.0.2001 oxfmt@0.65.0 typescript@7.0.2
# optional intelligence gate:
bun add -d fallow@3.18.0
```

`package.json` pins live in this package's `peerDependencies`. Keep consumer
versions aligned with those pins.

> **This repo must stay public.** Bun's `github:` shorthand fetches the tarball
> unauthenticated. Private + `GITHUB_TOKEN` does not fix that; use
> `git+ssh://git@github.com/JohnC0de/presets.git` only if you accept SSH everywhere.

## What lives where

| Concern                       | SSOT file             | How consumers attach                                                     |
| ----------------------------- | --------------------- | ------------------------------------------------------------------------ |
| TS strict family              | `tsconfig.base.json`  | `"extends": "@john/presets/tsconfig.base.json"`                          |
| TS Bun CLI profile            | `tsconfig.bun.json`   | `"extends": "@john/presets/tsconfig.bun.json"`                           |
| TS React/DOM profile          | `tsconfig.react.json` | `"extends": "@john/presets/tsconfig.react.json"` (+ paths/include local) |
| oxlint base (max + anti-slop) | `.oxlintrc.json`      | `"extends": ["./node_modules/@john/presets/.oxlintrc.json"]`             |
| oxlint React                  | `oxlint.react.json`   | `"extends": ["./node_modules/@john/presets/oxlint.react.json"]`          |
| anti-slop plugin              | `oxlint/anti-slop/`   | wired in base as `index.mjs` (needs `@oxlint/plugins`; `.ts` is source)  |
| oxfmt house style             | `oxfmtrc.json`        | **copy** (oxfmt has no `extends` yet) → `.oxfmtrc.json`                  |
| fallow defaults               | `fallow.base.json`    | `"extends": ["./node_modules/@john/presets/fallow.base.json"]`           |
| EditorConfig                  | `editorconfig.ini`    | **copy** → `.editorconfig`                                               |
| gitattributes                 | `gitattributes.txt`   | **copy** → `.gitattributes`                                              |

### Sync the copy-only files

```sh
# .editorconfig + .gitattributes (skip if already present)
bunx presets-sync

# also write .oxfmtrc.json from house style
bunx presets-sync --oxfmt

# optional: also copy anti-slop sources into tools/ (debugging / local edits)
bunx presets-sync --anti-slop --force

# overwrite everything from the package
bunx presets-sync --all --force
```

## Recipes

### TypeScript (app / Vite / TanStack)

```json
{
  "extends": "@john/presets/tsconfig.react.json",
  "include": ["**/*.ts", "**/*.tsx", "vite.config.ts"],
  "exclude": ["node_modules", "dist", ".output", ".tanstack"],
  "compilerOptions": {
    "types": ["vite/client", "bun"],
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### TypeScript (Bun CLI / tool)

```json
{
  "extends": "@john/presets/tsconfig.bun.json",
  "include": ["src"]
}
```

### oxlint (library / CLI, no React)

`.oxlintrc.json`:

```json
{
  "extends": ["./node_modules/@john/presets/.oxlintrc.json"],
  "ignorePatterns": ["dist", "node_modules"]
}
```

`jsPlugins` + all anti-slop rules ship in the extended preset (`./oxlint/anti-slop/index.mjs`).
One-off `scripts/**` trees are ignored (repro/debug files); keep real CLI entrypoints outside `scripts/`.

### oxlint (React)

```json
{
  "extends": ["./node_modules/@john/presets/oxlint.react.json"],
  "ignorePatterns": ["src/routeTree.gen.ts"]
}
```

If `extends` does not merge `jsPlugins` in your oxlint version, redeclare:

```json
{
  "extends": ["./node_modules/@john/presets/oxlint.react.json"],
  "jsPlugins": [
    {
      "name": "anti-slop",
      "specifier": "./node_modules/@john/presets/oxlint/anti-slop/index.mjs"
    }
  ]
}
```

Lint with type-aware + type-check (matches the preset `options.typeAware` /
`options.typeCheck`). Put those options in the **consumer root** `.oxlintrc.json`
as well — oxlint only treats them as official on the root config:

```json
{
  "extends": ["./node_modules/@john/presets/oxlint.react.json"],
  "options": {
    "typeAware": true,
    "typeCheck": true
  }
}
```

```json
{
  "scripts": {
    "lint": "oxlint --type-aware --type-check ."
  }
}
```

Add framework-only plugins (`nextjs`, `oxlint-tailwindcss`, Effect) in the consumer.

### oxfmt (house style)

Style: **no semi, double quotes, printWidth 100, trailingComma all, LF.**

```sh
bunx presets-sync --oxfmt --force
```

### fallow

`.fallowrc.json`:

```json
{
  "extends": ["./node_modules/@john/presets/fallow.base.json"],
  "entry": ["src/index.ts"]
}
```

### Suggested `package.json` scripts

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "oxlint --type-aware --type-check .",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "fallow": "fallow",
    "fallow:audit": "fallow audit",
    "check": "bun run fmt:check && bun run lint && bun run typecheck && bun run fallow:audit"
  }
}
```

`options.typeCheck` can replace a separate `tsc --noEmit` in CI; keeping both is
redundant but fine while migrating.

This package's own `bun run check` runs format + type-aware lint + `tsc` + `fallow audit`.
The anti-slop plugin sources are oxlint-ignored (AST walkers trip the rules they implement);
fallow still covers them.

## Aggregate sources (v1.5)

| Source                                   | What was taken                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `godot-mcp`                              | Full anti-slop type-hygiene set + error-level severity                                                         |
| `dmmulroy/anti-slop`                     | 15 generic rules (already vendored) + agent-dir ignores in oxlint/oxfmt/fallow                                 |
| image-2 extras                           | `no-long-comments`, `no-silent-skip`, `no-source-text-assertions`, `no-ui-presence-tests`                      |
| `stella/stella` `.oxlint-plugins`        | Generic security/test/i18n/env guards (not Stella-named product rules)                                         |
| `eloqnt/cli` lint-rules                  | Source-side ICU analogs (`no-icu-missing-other`, `no-icu-invalid-locale`); catalog lint stays eloqnt           |
| `thermo-nuclear`                         | `max-lines` 1000, `max-depth` 4, `no-else-return`, `no-nested-ternary`, `no-await-in-loop`                     |
| `code-slop` (asyrafhussin)               | `no-placeholder-comment`, `no-closing-brace-label`, `no-boolean-if-return`, `no-swallowed-error`               |
| `desloppify`                             | `no-empty-if-chain`; swallowed-error (catch that only logs)                                                    |
| `deslop` (brianlovin / poteto / davila7) | `no-banner-comments`; `no-unneeded-ternary`; early-return via `no-else-return`                                 |
| `boviom/app`                             | eslint / unicorn / oxc bug-catchers + `oxc/no-async-endpoint-handlers`                                         |
| `deepseek-harness`                       | Type-aware TS (`switch-exhaustiveness-check`, `only-throw-error`, `no-unsafe-type-assertion`)                  |
| oxlint 1.80 native                       | jest/vitest `expect-expect`, node path/require, React Compiler rules; `perf`/`restriction`/`pedantic` as error |
| prior `@john/presets`                    | TS configs, oxfmt house style, fallow base, sync script                                                        |

Catalog-only eloqnt rules (`duplicate-id`, `inconsistent-args`, `orphan-message`, `missing-translation`, `structure-mismatch`, `superfluous-key`, `undefined-key`, `unreachable-plural-case`, `inconsistent-exact-plurals`) need message JSON + `srcPath`. They do not run as oxlint JS plugins. Use [eloqnt lint](https://cli.eloqnt.dev/docs/cli/lint) in apps that have catalogs.

**Not in presets (domain-local):** `oxlint-tailwindcss`, `@mpsuesser/oxlint-plugin-effect`, Ultracite/Effect, nextjs, jsdoc-require, react-perf, `@stylistic`. Stella product rules (auth-lifecycle, matter glyphs, folio layers, MCP OAuth) stay out.

`eslint-plugin-sonarjs@4.2` is TS 5-only (`ts.Intrinsic`); duplicate detection stays on fallow.

## Version pins (receipt)

| Tool            | Pin (peer) |
| --------------- | ---------- |
| oxlint          | 1.80.0     |
| @oxlint/plugins | 1.80.0     |
| oxlint-tsgolint | 7.0.2001   |
| oxfmt           | 0.65.0     |
| typescript      | 7.0.2      |
| fallow          | 3.18.0     |

Bump here first, then bump consumers. Do not leave caret ranges that drift per repo.

## What is deliberately local

- `paths` / monorepo project references
- framework plugins (Next, Tailwind, Effect)
- fallow `entry`, `boundaries`, `workspaces`
- generated-file ignore globs
- Tailwind stylesheet path for `sortTailwindcss`
