type FilenameContext = {
  filename?: string
  getFilename?: () => string
}

/** Normalize the file oxlint is walking, always with `/` separators. */
export function filenameOf(context: FilenameContext): string {
  return (context.filename ?? context.getFilename?.() ?? "").replaceAll("\\", "/")
}

/** True for test/spec files and files under a test directory. */
export function isTestPath(filename: string): boolean {
  return (
    /\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(filename) ||
    /\/(?:test|tests|__tests__)(?:\/|$)/u.test(filename)
  )
}
