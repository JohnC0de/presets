# Anti-slop asset provenance

This directory owns the generic Oxlint plugin source. Its 55 rules retain the `anti-slop` namespace. `index.mjs` is generated from `index.ts`, not a second editing location. Project configuration decides which rules run. The `effect` subtree owns the five-rule optional `anti-slop-effect` namespace and its separate provenance and MIT notice.

## Source revisions

The merge uses these clean source paths, inspected on 2026-10-18.

| Source | Checkout revision | Last asset commit | Imported paths |
| --- | --- | --- | --- |
| `mandato-zero` | `70c0ba0e6c40324ff1b0bc421f3e13debee9a1fe` | `561d086820adf7b537e048344d17a2389dc4d837` | `tools/oxlint/anti-slop/rules`, `shared`, `vendor`, `LICENSE` |
| `_org/presets` | `c4bea545a2955eca7dd6d8e657cf23dbe1e5b8c8` | `a09dc1a641a676f6e54a78dc3a86ac0a4f594da1` | `oxlint/anti-slop/index.ts`, `rules`, `shared` |
| `mosaico` | `3a1b00b1c9f78bffbb48810af0ae7610d1e40ab0` | Same inspected source revision | `tools/oxlint/anti-slop/effect`, adjacent `LICENSE` and `UPSTREAM.md` |

The presets checkout has an unrelated modification to `bin/presets-sync.ts`. No imported preset asset is dirty. The Mandato checkout is clean. Its `origin/main` is `b943b50eced337dcbe76c4b96a13274c9a4d781f`; the imported working-tree revision is the newer HEAD recorded above. No Godot working-tree source was imported. Its separate dirty changes remain outside this asset merge.

All 18 Mandato rule implementations replace their matching preset files or add the three Mandato-only rules. The other 37 rules retain the preset implementation. `testdata/oxlint/cases.json` records `M` or `P` beside each rule. Mandato's shared alias, scope, array, dictionary, and lexical-type helpers move together. The preset filename and physical-property helpers remain for their consumers.

The root `LICENSE` preserves Dillon Mulroy's MIT notice. `vendor/eslint-stylistic/LICENSE` preserves the OpenJS Foundation and ESLint Stylistic notices. Its upstream revision remains `435c3ea0fd26a5fef9042c4b36b6e165fbbf8d08`. The presets package declares MIT licensing. This merge does not import company code or ai-memory code.

## Local changes

The registry combines 55 rules. Shared rule IDs and diagnostic text stay unchanged relative to each selected source.

`no-shape-in-symbol-names` keeps Mandato's symbol traversal and borrowed static-member exemption by default. Its options are:

| Option | Default | Meaning |
| --- | --- | --- |
| `targets` | `"symbols"` | `"declarations"` selects the preset declaration visitors instead. |
| `allowedPatterns` | `[]` | Regular-expression sources for project-owned exceptions. |
| `caseInsensitive` | `true` | Compile project patterns with `iu`, or `u` when false. |

The engine contains no Godot name allowlist. The declaration policy preserves the preset's declaration-node selection, including its treatment of private and JSX names. It does not expand that policy to parameter or destructuring declarations.

`no-unknown-parameters` keeps Mandato's unknown-union checks and predicate-subject exception. Its options are:

| Option | Default | Meaning |
| --- | --- | --- |
| `allowedNames` | `["cause"]` | Replace the default names, including with an empty array. |
| `caseInsensitive` | `false` | Compare configured names without case when true. |
| `allowInTypeGuards` | `false` | Exempt every parameter of a type-predicate function when true. |

Both option objects reject unknown keys and invalid value types through their rule schemas. Naming patterns also use regex schema validation. Options reset for each file. `no-untranslated-jsx-literal` now resets its project-specific text and element sets before each file, so one file's configuration cannot exempt another file's text.

The selected Mandato semantics deliberately differ from presets in these recorded fixtures:

| Fixture | Presets diagnostics | Canonical diagnostics |
| --- | --- | --- |
| `raw: unknown` parameter | 0 | 1 |
| `typeof missing !== 'undefined'` | 1 | 0 |
| `class CollisionShape2D {}` without project exceptions | 0 | 1 |
| Bare `SAFETY:` before an assertion | 0 | 1 |

Mandato's lexical and generic alias behavior also remains selected. The policy fixtures cover shadowing, generic defaults, cycles, unknown unions, dictionary constraints, nested function boundaries, reducer aliases, and lazy iterators.

## Build and verification interface

From the tools worktree, the explicit generic build is:

```sh
scripts/capped bun run --cwd adapters/presets build:generic
```

The parent package also defines `build:effect`. `build` builds both entrypoints after the separate Effect asset slice is present. Both builds externalize `@oxlint/plugins`. Runtime consumers must provide that package. The parent development dependencies pin Oxlint and its plugin package to 1.87.0.

The generic tests use real Oxlint processes and temporary homes. The default test compares both canonical entrypoints to committed source-derived diagnostic and autofix fixtures. It does not require the original source directories. `OXLINT_RUNTIME_ROOTS` is a colon-separated list of project directories with installed `node_modules/oxlint` and `node_modules/@oxlint/plugins`. An installed `adapters/presets/node_modules` is the default. On the migration workstation, absent local dependencies, the four source runtime installations are the fallback.

```sh
scripts/capped bun run --cwd adapters/presets test
scripts/capped env OXLINT_COMPARE_SOURCE=1 bun run --cwd adapters/presets test
```

Source comparison uses `OXLINT_SOURCE_ROOT`, defaulting to `/home/john/projects`. `OXLINT_RECORD_SOURCE=1` explicitly regenerates `testdata/oxlint/diagnostics.json` and `spacing-fixed.json` from the original source implementations. It is not an automatic update mode.

The preserved-source matrix covers one valid and one invalid fixture for every generic rule. It compares diagnostic code, message, severity, and complete source spans. It compares exit codes and stderr. Only temporary directory prefixes are removed from diagnostic filenames. Presets TypeScript and its existing ESM bundle are also compared on all 52 original rules.

The canonical TypeScript and ESM entrypoints passed the 55-rule matrix with installed Oxlint versions 1.80.0, 1.82.0, 1.85.0, and 1.87.0. The 28 policy pairs also passed on those runtimes. The spacing corpus compares exact output bytes for imports, JSDoc, trailing comments, same-line statements, semicolonless code, overloads, and generators. Repeated fixes produce no diagnostics and unchanged bytes.

This evidence does not claim full upstream Stylistic conformance, exhaustive rule-option combinations, Windows execution, or compatibility with untested future runtime versions.

## Native distribution and adoption

`john.tools/adapters/presets.Oxlint() fs.FS` exposes the embedded generic and Effect tree. `p presets sync --anti-slop` uses it by default. Base metadata and unrelated presets still use the existing package locator. Explicit `P_PRESETS` retains the package-tree override. `p adopt` copies the same embedded assets through its dry-run ledger and writes the local `index.mjs` specifier.

O6 built `cmd/p` and ran it outside the source tree with only synthetic package metadata. Sync copied both namespaces and licenses. Oxlint 1.87.0 loaded both copied ESM entrypoints and reported the expected generic enum and Effect tagged-construction diagnostics. The focused workspace tests and vet passed. `docs/parity/workspace.md` and the O6 report record the commands and evidence boundaries.

The historical sync fixture derives from the modified `_org/presets/bin/presets-sync.ts` working copy. Its SHA-256 is `b7b79452947c283dc891a628fda27aee222ed5f273c7f18c94ebc86c621bf468`. The registry pin identifies the base revision, not an assertion that this dirty CLI input matched that revision.

Canonical ownership does not imply external caller retirement. At O6 inspection, Mandato and Godot still loaded their old TypeScript paths, Mosaico still loaded its old Effect path and Ultracite generic preset, and HTML View and Zomboid still loaded the node_modules plugin. The presets package still exported its old plugin and sync CLI. Authorized project cutovers and source deletion remain separate work. No Godot dirty files, other consumer files, or source repositories were changed by O6.
