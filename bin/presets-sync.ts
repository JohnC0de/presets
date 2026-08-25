#!/usr/bin/env bun
/** Copy configs that cannot `extends` into the project root. See --help flags below. */
import { copyFileSync, cpSync, existsSync, readFileSync } from "node:fs"
import path from "node:path"

type Copy = { readonly from: string; readonly to: string }
type PackageJson = { readonly peerDependencies: Record<string, string> }

function isPackageJson(value: unknown): value is PackageJson {
  if (typeof value !== "object" || value === null) return false
  if (!("peerDependencies" in value)) return false
  const peers = value.peerDependencies
  return typeof peers === "object" && peers !== null
}

const pkgRoot = path.resolve(import.meta.dirname, "..")
const cwd = process.cwd()
const parsed: unknown = JSON.parse(readFileSync(path.join(pkgRoot, "package.json"), "utf8"))
if (!isPackageJson(parsed)) {
  console.error("package.json is missing peerDependencies")
  process.exit(2)
}
const packageJson = parsed

const args = new Set(process.argv.slice(2))
const force = args.has("--force")
const wantOxfmt = args.has("--oxfmt")
const wantAntiSlop = args.has("--anti-slop")
const skipDotfiles = args.has("--no-dotfiles")
const wantAll = args.has("--all")

const copies: Copy[] = []
if (!skipDotfiles || wantAll) {
  copies.push(
    { from: "editorconfig.ini", to: ".editorconfig" },
    { from: "gitattributes.txt", to: ".gitattributes" },
  )
}
if (wantOxfmt || wantAll) {
  copies.push({ from: "oxfmtrc.json", to: ".oxfmtrc.json" })
}

const dirCopies: Copy[] = []
if (wantAntiSlop || wantAll) {
  dirCopies.push({ from: "oxlint/anti-slop", to: "tools/oxlint/anti-slop" })
}

if (copies.length === 0 && dirCopies.length === 0) {
  console.error("nothing to copy — pass --oxfmt / --anti-slop and/or drop --no-dotfiles")
  process.exit(2)
}

const written: string[] = []
const skipped: string[] = []

function applyCopies(
  items: readonly Copy[],
  missingLabel: string,
  write: (src: string, dest: string) => void,
): void {
  for (const { from, to } of items) {
    const src = path.join(pkgRoot, from)
    const dest = path.join(cwd, to)
    if (!existsSync(src)) {
      console.error(`missing package ${missingLabel}: ${from}`)
      process.exit(2)
    }
    if (existsSync(dest) && !force) {
      skipped.push(to)
      continue
    }
    write(src, dest)
    written.push(to)
  }
}

applyCopies(copies, "file", copyFileSync)
applyCopies(dirCopies, "directory", (src: string, dest: string): void => {
  cpSync(src, dest, { recursive: true, force: true })
})

console.info(
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
)

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
    versions: packageJson.peerDependencies,
  }
  console.info(JSON.stringify(recipe, null, 2))
}
