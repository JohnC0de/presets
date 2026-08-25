#!/usr/bin/env bun
/**
 * Copy configs that cannot `extends` into the project root.
 *
 *   bunx presets-sync
 *   bunx presets-sync --force
 *   bunx presets-sync --oxfmt --anti-slop --no-dotfiles
 *   bunx presets-sync --all --force
 *
 * Defaults: write .editorconfig + .gitattributes (skip if already present).
 * --oxfmt also writes .oxfmtrc.json from the house style (oxfmt has no extends).
 * --anti-slop copies oxlint/anti-slop → tools/oxlint/anti-slop (Node cannot load
 *   TypeScript plugins from node_modules type-stripping restrictions).
 * --force overwrites existing files.
 */
import { copyFileSync, cpSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, "..");
const cwd = process.cwd();

const args = new Set(process.argv.slice(2));
const force = args.has("--force");
const wantOxfmt = args.has("--oxfmt");
const wantAntiSlop = args.has("--anti-slop");
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

const dirCopies = [];
if (wantAntiSlop || wantAll) {
  dirCopies.push({ from: "oxlint/anti-slop", to: "tools/oxlint/anti-slop" });
}

if (copies.length === 0 && dirCopies.length === 0) {
  console.error("nothing to copy — pass --oxfmt / --anti-slop and/or drop --no-dotfiles");
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

for (const { from, to } of dirCopies) {
  const src = join(pkgRoot, from);
  const dest = join(cwd, to);
  if (!existsSync(src)) {
    console.error(`missing package directory: ${from}`);
    process.exit(2);
  }
  if (existsSync(dest) && !force) {
    skipped.push(to);
    continue;
  }
  cpSync(src, dest, { recursive: true, force: true });
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
          : "dotfiles / anti-slop that cannot load from node_modules are now local copies of @john/presets",
    },
    null,
    2,
  ),
);

if (args.has("--print-recipe")) {
  const recipe = {
    tsconfig: { extends: "@john/presets/tsconfig.base.json" },
    oxlint: { extends: ["./node_modules/@john/presets/.oxlintrc.json"] },
    oxlintReact: { extends: ["./node_modules/@john/presets/oxlint.react.json"] },
    antiSlop: {
      jsPlugins: [{ name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" }],
      sync: "bunx presets-sync --anti-slop --force",
    },
    fallow: { extends: ["./node_modules/@john/presets/fallow.base.json"] },
    versions: JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf8")).peerDependencies,
  };
  console.log(JSON.stringify(recipe, null, 2));
}
