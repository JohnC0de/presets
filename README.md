# @john/presets

Shared tooling for personal repos under `projects/personal` (and labs that opt in).
No build step — the package is just config files + a tiny sync script.

Boviom / work repos stay on their own tooling.

## Install

```sh
bun add -d github:JohnC0de/presets
bun add -d oxlint@1.76.0 oxfmt@0.61.0 typescript@7.0.2
# optional intelligence gate:
bun add -d fallow@3.10.0
```

`package.json` pins live in this package's `peerDependencies`. Keep consumer
versions aligned with those pins.

> **This repo must stay public.** Bun's `github:` shorthand fetches the tarball
> unauthenticated. Private + `GITHUB_TOKEN` does not fix that; use
> `git+ssh://git@github.com/JohnC0de/presets.git` only if you accept SSH everywhere.

## What lives where

| Concern | SSOT file | How consumers attach |
| --- | --- | --- |
| TS strict family | `tsconfig.base.json` | `"extends": "@john/presets/tsconfig.base.json"` |
| TS Bun CLI profile | `tsconfig.bun.json` | `"extends": "@john/presets/tsconfig.bun.json"` |
| TS React/DOM profile | `tsconfig.react.json` | `"extends": "@john/presets/tsconfig.react.json"` (+ paths/include local) |
| oxlint base | `.oxlintrc.json` | `"extends": ["./node_modules/@john/presets/.oxlintrc.json"]` |
| oxlint React | `oxlint.react.json` | `"extends": ["./node_modules/@john/presets/oxlint.react.json"]` |
| oxfmt house style | `oxfmtrc.json` | **copy** (oxfmt has no `extends` yet) → `.oxfmtrc.json` |
| fallow defaults | `fallow.base.json` | `"extends": ["./node_modules/@john/presets/fallow.base.json"]` |
| EditorConfig | `editorconfig.ini` | **copy** → `.editorconfig` |
| gitattributes | `gitattributes.txt` | **copy** → `.gitattributes` |

### Sync the copy-only files

```sh
# .editorconfig + .gitattributes (skip if already present)
bunx presets-sync

# also write .oxfmtrc.json from house style
bunx presets-sync --oxfmt

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
  "extends": ["./node_modules/@john/presets/.oxlintrc.json"]
}
```

### oxlint (React)

```json
{
  "extends": ["./node_modules/@john/presets/oxlint.react.json"],
  "ignorePatterns": ["src/routeTree.gen.ts"]
}
```

Add framework-only plugins (`nextjs`, …) in the consumer.

### oxfmt (house style)

Style: **no semi, double quotes, printWidth 100, trailingComma all, LF.**

```sh
bunx presets-sync --oxfmt --force
```

Per-project extras only (ignore globs, Tailwind sort path):

```json
{
  "printWidth": 100,
  "singleQuote": false,
  "semi": false,
  "ignorePatterns": ["src/routeTree.gen.ts", "vendor/**"],
  "sortTailwindcss": {
    "stylesheet": "./src/styles.css",
    "functions": ["cn", "clsx"]
  }
}
```

Until oxfmt grows `extends`, any house-style change means re-run
`presets-sync --oxfmt --force` (or a small local wrapper that spreads the
JSON from `node_modules/@john/presets/oxfmtrc.json` via `oxfmt.config.ts`).

### fallow

`.fallowrc.json`:

```json
{
  "extends": ["./node_modules/@john/presets/fallow.base.json"],
  "entry": ["src/index.ts"]
}
```

Boundaries, workspaces, and entry points stay per project — only rules/health/dupes/audit defaults are shared.

### Suggested `package.json` scripts

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit",
    "lint": "oxlint",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "fallow": "fallow",
    "fallow:audit": "fallow audit",
    "check": "bun run typecheck && bun run lint && bun run fmt:check"
  }
}
```

Wire `fallow:audit` into `check` only when the repo is clean enough to gate on it.

## Version pins (receipt)

| Tool | Pin (peer) |
| --- | --- |
| oxlint | 1.76.0 |
| oxfmt | 0.61.0 |
| typescript | 7.0.2 |
| fallow | 3.10.0 |

Bump here first, then bump consumers. Do not leave caret ranges that drift per repo.

## What is deliberately local

- `paths` / monorepo project references
- framework plugins (Next, Effect ultracite, …)
- fallow `entry`, `boundaries`, `workspaces`
- generated-file ignore globs
- Tailwind stylesheet path for `sortTailwindcss`
