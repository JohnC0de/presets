type Options = { a: number; b: number; c: number; d: number; e: number }
export function many(options: Options): number {
  return options.a
}
export function five(a: number, b: number, c: number, d: number, e: number): number {
  return a + b + c + d + e
}
