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
    "check": "bun run typecheck && bun run lint && bun run fmt:check"
  }
}
```

`options.typeCheck` can replace a separate `tsc --noEmit` in CI; keeping both is
redundant but fine while migrating.

## Aggregate sources (v1.2)

| Source                                     | What was taken                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `godot-mcp`                                | Full anti-slop rule set (24 rules) + error-level severity                 |
| `personal/os` / `modelport` / `sketch-lab` | Shared anti-slop core + `allowInTypeGuards` on `no-runtime-typeof`        |
| `boviom/app`                               | Broad eslint / unicorn / oxc bug-catchers (not Tailwind / react-perf)     |
| `deepseek-harness`                         | Type-aware TypeScript strict family (`no-unsafe-*`, floating promises, …) |
| prior `@john/presets`                      | TS configs, oxfmt house style, fallow base, sync script                   |

**Not in presets (domain-local):** `oxlint-tailwindcss`, `@mpsuesser/oxlint-plugin-effect`, Ultracite/Effect stacks.

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
