# Effect rule provenance

The five rules, shared helper and TypeScript entrypoint are unchanged copies of `mosaico/tools/oxlint/anti-slop/effect` at commit `3a1b00b1c9f78bffbb48810af0ae7610d1e40ab0`. The source files were clean when copied.

Mosaico records upstream <https://github.com/dmmulroy/anti-slop> at revision `c44ef22ca116d0ba62a3ff663a0bd13a3f3fa40b`, from `skills/install-anti-slop/assets/anti-slop/effect/`. The adjacent LICENSE preserves Dillon Mulroy's MIT notice.

This optional plugin exports namespace `anti-slop-effect`. Projects own their enabled rules. Relative service-constructor imports are checked; project aliases are not. Generic rules remain a separate entrypoint.

Regenerate `index.mjs` from the presets directory with `bun run build:effect`. Run the native fixtures with `bun test test/effect.test.ts`. Set `OXLINT_COMPARE_SOURCE=1` to compare the original Mosaico entrypoint too. `OXLINT_SOURCE_ROOT` and `OXLINT_RUNTIME_ROOTS` select reference repositories and installed runtime pairs.
