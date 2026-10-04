export function narrow(value: unknown): string {
  // SAFETY: caller guarantees a string
  return value as string
}
export function bare(value: unknown): string {
  return value as string
}
