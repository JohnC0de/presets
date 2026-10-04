import { expect, test } from "vitest"
test("x", () => {
  if (Math.random() > 0.5) {
    expect(1).toStrictEqual(1)
  }
})
