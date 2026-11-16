import path from 'node:path'

export type LintViolation = {
  file: string
  rule: string
  count: number
}

export type LintMessage = {
  severity: number
  ruleId: string | null
  line?: number
  column?: number
  message?: string
}

export type LintResultLike = {
  filePath: string
  messages: LintMessage[]
}

type OxlintDiagnostic = {
  message: string
  code?: string
  severity: string
  filename: string
  labels?: { span: { line: number; column: number } }[]
}

export type OxlintReport = { diagnostics: OxlintDiagnostic[] }

// `oxlint -f json` lists diagnostics flat; regroup them per file so the
// inventory counts file/rule pairs. Syntax errors carry no rule code.
export const fromOxlintReport = (report: OxlintReport): LintResultLike[] => {
  const byFile = new Map<string, LintMessage[]>()
  for (const diagnostic of report.diagnostics) {
    const messages = byFile.get(diagnostic.filename) ?? []
    const span = diagnostic.labels?.[0]?.span
    messages.push({
      severity: diagnostic.severity === 'error' ? 2 : 1,
      ruleId: diagnostic.code || null,
      line: span?.line,
      column: span?.column,
      message: diagnostic.message,
    })
    byFile.set(diagnostic.filename, messages)
  }
  return [...byFile].map(([filePath, messages]) => ({ filePath, messages }))
}

export type CliArgs = {
  writeBaseline: boolean
  fix: boolean
  files: string[]
}

// Oxlint exits 1 exactly when an error diagnostic exists. Any other status
// (a crash, a signal, a type-aware pass that failed outside the report) means
// the JSON cannot be trusted to be complete.
export const isTrustedOxlintExit = (
  status: number | null,
  results: LintResultLike[],
): boolean => {
  const hasError = results.some((result) =>
    result.messages.some((message) => message.severity === 2),
  )
  return status === (hasError ? 1 : 0)
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
