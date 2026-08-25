#!/usr/bin/env bun
/**
 * Copy configs that cannot `extends` into the project root.
 *
 *   bunx presets-sync
 *   bunx presets-sync --force
 *   bunx presets-sync --oxfmt --no-dotfiles
 *
 * Defaults: write .editorconfig + .gitattributes (skip if already present).
 * --oxfmt also writes .oxfmtrc.json from the house style (oxfmt has no extends).
 * --force overwrites existing files.
 */
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");
const cwd = process.cwd();

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const wantOxfmt = args.has("--oxfmt");
const skipDotfiles = args.has("--no-dotfiles");
const wantAll = args.has("--all");

const copies = [];
if (!skipDotfiles || wantAll) {
  copies.push(
    { from: "editorconfig.ini", to: ".editorconfig" },
    { from: "gitattributes.txt", to: ".gitattributes" },
  );
}
if (wantOxfmt || wantAll) {
  copies.push({ from: "oxfmtrc.json", to: ".oxfmtrc.json" });
}

if (copies.length === 0) {
  console.error("nothing to copy — pass --oxfmt and/or drop --no-dotfiles");
  process.exit(2);
}

const written = [];
const skipped = [];
for (const { from, to } of copies) {
  const src = join(pkgRoot, from);
  const dest = join(cwd, to);
  if (!existsSync(src)) {
    console.error(`missing package file: ${from}`);
    process.exit(2);
  }
  if (existsSync(dest) && !force) {
    skipped.push(to);
    continue;
  }
  copyFileSync(src, dest);
  written.push(to);
}

console.log(
  JSON.stringify(
    {
      package: pkgRoot,
      cwd,
      written,
      skipped,
      force,
      tip:
        skipped.length > 0
          ? "re-run with --force to overwrite skipped files"
          : "dotfiles that cannot extends are now local copies of @john/presets",
    },
    null,
    2,
  ),
);

// Ensure consumers know the recipe for extendable tools (no file write).
if (args.has("--print-recipe")) {
  const recipe = {
    tsconfig: { extends: "@john/presets/tsconfig.base.json" },
    oxlint: { extends: ["./node_modules/@john/presets/.oxlintrc.json"] },
    oxlintReact: { extends: ["./node_modules/@john/presets/oxlint.react.json"] },
    fallow: { extends: ["./node_modules/@john/presets/fallow.base.json"] },
    versions: JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).peerDependencies,
  };
  console.log(JSON.stringify(recipe, null, 2));
}
