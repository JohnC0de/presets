/** Physical directional Tailwind classes that break RTL. */
export const PHYSICAL_PATTERNS: readonly RegExp[] = [
  /(?:^|[\s"'`{(])(?:-?)(?:[\w[\]:]*:)?(?:ml|mr|pl|pr)-/u,
  /(?:^|[\s"'`{(])(?:[\w[\]:]*:)?text-(?:left|right)(?=["'\s`})]|$)/u,
  /(?:^|[\s"'`{(])(?:[\w[\]:]*:)?border-[lr](?=[-\s"'`})]|$)/u,
  /(?:^|[\s"'`{(])(?:[\w[\]:]*:)?rounded-(?:l|r|tl|tr|bl|br)(?=[-\s"'`})]|$)/u,
  /(?:^|[\s"'`{(])(?:-?)(?:[\w[\]:]*:)?(?:left|right)-/u,
  /(?:^|[\s"'`{(])(?:[\w[\]:]*:)?scroll-(?:ml|mr|pl|pr)-/u,
  /(?:^|[\s"'`{(])(?:[\w[\]:]*:)?float-(?:left|right)(?=["'\s`})]|$)/u,
  /(?:^|[\s"'`{(])(?:[\w[\]:]*:)?clear-(?:left|right)(?=["'\s`})]|$)/u,
]

export function hasPhysicalProperty(value: string): boolean {
  return PHYSICAL_PATTERNS.some((pattern) => pattern.test(value))
}
