import path from 'node:path'

export type LintViolation = {
  file: string
  rule: string
  count: number
}

export type LintMessage = {
  severity: number
  ruleId: string | null
}

export type LintResultLike = {
  filePath: string
  messages: LintMessage[]
}

export type CliArgs = {
  writeBaseline: boolean
  fix: boolean
  files: string[]
}

export const toKey = ({ file, rule }: Pick<LintViolation, 'file' | 'rule'>) =>
  `${file}\0${rule}`

export const parseCliArgs = (argv: string[]): CliArgs => {
  let writeBaseline = false
  let fix = false
  const files: string[] = []

  for (const arg of argv) {
    if (arg === '--write') {
      writeBaseline = true
      continue
    }
    if (arg === '--fix') {
      fix = true
      continue
    }
    if (arg === '--') continue
    if (arg.startsWith('-')) {
      throw new Error(`Unknown flag: ${arg}`)
    }
    files.push(arg)
  }

  return { writeBaseline, fix, files }
}

export const normalizeFile = (file: string, cwd: string): string => {
  const relative = path.isAbsolute(file) ? path.relative(cwd, file) : file
  return path.posix.normalize(relative.split(path.sep).join('/'))
}

export const collectInventory = (
  results: LintResultLike[],
  cwd: string,
): LintViolation[] => {
  const counts = new Map<string, number>()

  for (const result of results) {
    const file = normalizeFile(result.filePath, cwd)
    for (const message of result.messages) {
      if (message.severity !== 1 || message.ruleId === null) continue
      const key = toKey({ file, rule: message.ruleId })
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .map(([key, count]) => {
      const [file, rule] = key.split('\0')
      return { file, rule, count }
    })
    .sort(
      (left, right) =>
        left.file.localeCompare(right.file) ||
        left.rule.localeCompare(right.rule),
    )
}

export const compareInventory = (
  violations: LintViolation[],
  baselineViolations: LintViolation[],
  scopedFiles: ReadonlySet<string> | null = null,
) => {
  const allowedCounts = new Map(
    baselineViolations.map((entry) => [toKey(entry), entry.count]),
  )
  const currentCounts = new Map(
    violations.map((entry) => [toKey(entry), entry.count]),
  )
  const inScope = (file: string) =>
    scopedFiles === null || scopedFiles.has(file)

  return {
    allowedCounts,
    increases: violations.filter(
      (entry) =>
        inScope(entry.file) &&
        entry.count > (allowedCounts.get(toKey(entry)) ?? 0),
    ),
    reductions: baselineViolations.filter(
      (entry) =>
        inScope(entry.file) &&
        (currentCounts.get(toKey(entry)) ?? 0) < entry.count,
    ),
  }
}

export const mergeBaselineViolations = (
  existing: LintViolation[],
  next: LintViolation[],
  files: ReadonlySet<string>,
): LintViolation[] => {
  const kept = existing.filter((entry) => !files.has(entry.file))
  return [...kept, ...next].sort(
    (left, right) =>
      left.file.localeCompare(right.file) || left.rule.localeCompare(right.rule),
  )
}
