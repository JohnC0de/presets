import { beforeAll, describe, expect, test } from "bun:test"

type Diagnostic = { code: string; filename: string }

const fixtureRoot = new URL("fixtures/proj/", import.meta.url).pathname.replace(/^\/(\w:)/u, "$1")
const noise = /^typescript\(TS\d+\)$/u

let diagnostics: Diagnostic[] = []

function rulesIn(file: string): string[] {
  return diagnostics
    .filter((diagnostic) => diagnostic.filename === file)
    .map((diagnostic) => diagnostic.code)
    .filter((code) => !noise.test(code))
    .sort()
}

beforeAll(() => {
  const result = Bun.spawnSync(
    ["bun", "x", "oxlint", "--type-aware", "--type-check", "-f", "json", "."],
    { cwd: fixtureRoot },
  )
  // SAFETY: oxlint `-f json` emits `{ diagnostics: [{ code, filename, ... }] }`
  const report = JSON.parse(result.stdout.toString()) as { diagnostics: Diagnostic[] }
  diagnostics = report.diagnostics
}, 120_000)

describe("preset rule resolution", () => {
  test("max-params rejects positional overflow but accepts an options type", () => {
    expect(rulesIn("src/params.ts")).toStrictEqual(["eslint(max-params)"])
  })

  test("a SAFETY comment satisfies the single assertion gate", () => {
    const assertions = diagnostics.filter((diagnostic) => diagnostic.filename === "src/assert.ts")
    expect(assertions.map((diagnostic) => diagnostic.code)).not.toContain(
      "typescript(no-unsafe-type-assertion)",
    )
    expect(rulesIn("src/assert.ts")).toContain(
      "anti-slop(require-safety-comment-for-type-assertion)",
    )
  })

  test("no-conditional-in-test is reported by one plugin only", () => {
    const hits = rulesIn("test/cond.ts").filter((code) => code.endsWith("(no-conditional-in-test)"))
    expect(hits).toStrictEqual(["vitest(no-conditional-in-test)"])
  })

  test("no-conditional-expect is reported by one plugin only", () => {
    const hits = rulesIn("test/cond.ts").filter((code) => code.endsWith("(no-conditional-expect)"))
    expect(hits).toStrictEqual(["vitest(no-conditional-expect)"])
  })

  test("route files may export Route next to local components", () => {
    expect(rulesIn("src/routes/index.tsx")).not.toContain("react(only-export-components)")
    expect(rulesIn("src/comp.tsx")).toContain("react(only-export-components)")
  })

  test("TanStack redirect and notFound may be thrown, other values may not", () => {
    const throws = rulesIn("src/routes/index.tsx").filter(
      (code) => code === "typescript(only-throw-error)",
    )
    expect(throws).toHaveLength(1)
  })

  test("no-console is allowed in bin and kept elsewhere", () => {
    expect(rulesIn("bin/cli.ts")).not.toContain("eslint(no-console)")
    expect(rulesIn("src/lib.ts")).toContain("eslint(no-console)")
  })

  test("untyped scripts skip the no-unsafe family", () => {
    expect(rulesIn("scripts/a.mjs").filter((code) => code.includes("no-unsafe-"))).toStrictEqual([])
  })
})
