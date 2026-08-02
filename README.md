# @john/presets

Shared config for every project in the `projects` workspace. Installed straight
from GitHub — no build step, the package is just the config files.

## Adopt

```sh
bun add -d github:JohnC0de/presets
```

`package.json`:

```json
{
  "devDependencies": {
    "@john/presets": "github:JohnC0de/presets"
  }
}
```

> **This repo must stay public.** Bun resolves the `github:` shorthand (and
> `git+https:` GitHub URLs) through `api.github.com/repos/.../tarball/`, which
> it fetches **unauthenticated**. Flip this repo to private and every dependent
> project fails `bun install` with a `404` — setting `GITHUB_TOKEN` does not
> help. The fallback that does work on a private repo is
> `git+ssh://git@github.com/JohnC0de/presets.git`, which makes Bun clone with
> `git`, but it needs an SSH key on every machine and CI runner, and it resolves
> in ~1.8s against ~0.4s for the tarball. Public is the right default here: these
> are config files with no secrets.

### TypeScript

`tsconfig.json` extends the strict family and keeps its own
`module` / `target` / `moduleResolution` / `jsx` / `lib` — those are per-project
and the preset deliberately does not set them.

```json
{
  "extends": "@john/presets/tsconfig.base.json",
  "compilerOptions": {
    "target": "ESNext",
    "module": "Preserve",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "noEmit": true
  }
}
```

### oxlint

`.oxlintrc.json`:

```json
{
  "extends": ["./node_modules/@john/presets/.oxlintrc.json"],
  "rules": {}
}
```

Add framework plugins (`react`, `jsx-a11y`, `react-perf`, …) in the consuming
project — the preset stays framework-agnostic.

### .editorconfig and .gitattributes

Neither format has an include mechanism, so adoption is a **copy**, not an
extend. The canonical text ships as `editorconfig.ini` and `gitattributes.txt`:

```sh
cp node_modules/@john/presets/editorconfig.ini  .editorconfig
cp node_modules/@john/presets/gitattributes.txt .gitattributes
```

The repo root of this package carries the same content as real `.editorconfig` /
`.gitattributes` files, so it is also fine to copy them from a checkout.

## What is in each file

| File                 | Contents                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `tsconfig.base.json` | strict family only: `strict`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`, `skipLibCheck`, `esModuleInterop`, `resolveJsonModule`, `isolatedModules` |
| `.oxlintrc.json`     | `correctness: error`, `suspicious: warn`, `perf: warn` plus bug-catcher rules. No formatting rules — `oxfmt` owns layout |
| `editorconfig.ini`   | utf-8, lf, 2-space; tabs for `*.gd`, 4 for `*.rs`, crlf for `*.ps1`/`*.bat`                          |
| `gitattributes.txt`  | `* text=auto eol=lf`, crlf for shell scripts Windows runs, binary markers for art/audio/engine assets |
