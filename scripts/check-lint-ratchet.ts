import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import {
  collectInventory,
  compareInventory,
  fromOxlintReport,
  isTrustedOxlintExit,
  mergeBaselineViolations,
  normalizeFile,
  parseCliArgs,
  toKey,
  type LintResultLike,
  type LintViolation,
  type OxlintReport,
} from './lint-ratchet-inventory'

const BASELINE_VERSION = 1
const BASELINE_FILE = 'quality/lint-ratchet-baseline.json'

type BaselineFile = {
  version: number
  violations: LintViolation[]
}

// Oxlint has no Node API, so the CLI runs as a child process. The bin script is
// run with the current Node so it does not depend on the .bin shim per OS.
const runOxlint = (targets: string[], fix: boolean): LintResultLike[] => {
  const bin = path.resolve('node_modules/oxlint/bin/oxlint')
  // lint-staged may pass only ignored files (e.g. next.config.js); without the
  // flag oxlint prints a plain-text notice before the JSON and exits 1.
  const args = [
    bin,
    '-f',
    'json',
    '--no-error-on-unmatched-pattern',
    ...(fix ? ['--fix'] : []),
    ...targets,
  ]
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  if (result.error) throw result.error
  let results: LintResultLike[] | null = null
  try {
    results = fromOxlintReport(JSON.parse(result.stdout) as OxlintReport)
  } catch {
    // Reported below together with the exit status and stderr.
  }
  if (results === null || !isTrustedOxlintExit(result.status, results)) {
    throw new Error(
      `oxlint did not produce a trustworthy JSON report (exit ${result.status}, signal ${result.signal}):\n${result.stderr}${result.stdout}`,
    )
  }
  return results
}

const formatErrors = (results: LintResultLike[], cwd: string) =>
  results.flatMap((result) => {
    const file = normalizeFile(result.filePath, cwd)
    return result.messages
      .filter((message) => message.severity === 2)
      .map(
        (message) =>
          `${file}:${message.line ?? 0}:${message.column ?? 0} ${message.ruleId ?? 'parse'} ${message.message}`,
      )
  })

const reportLintErrors = (errors: string[]) => {
  if (errors.length === 0) return false

  console.error(
    'Cannot evaluate the warning ratchet while lint errors exist:',
  )
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
  return true
}

const saveBaseline = async (violations: LintViolation[]) => {
  await mkdir('quality', { recursive: true })
  await writeFile(
    BASELINE_FILE,
    `${JSON.stringify({ version: BASELINE_VERSION, violations }, null, 2)}\n`,
    'utf8',
  )
  console.log(
    `Updated ${BASELINE_FILE} with ${violations.length} file/rule entries.`,
  )
}

const isBaselineFile = (value: unknown): value is BaselineFile => {
  if (typeof value !== 'object' || value === null) return false
  if (!('version' in value) || !('violations' in value)) return false
  return value.version === BASELINE_VERSION && Array.isArray(value.violations)
}

const loadBaseline = async (): Promise<BaselineFile | null> => {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(BASELINE_FILE, 'utf8'))
  } catch (error) {
    console.error(
      `Cannot read ${BASELINE_FILE}. Run pnpm lint:ratchet:update first.`,
    )
    console.error(error)
    process.exitCode = 1
    return null
  }

  if (!isBaselineFile(parsed)) {
    console.error(`Unsupported lint ratchet baseline format in ${BASELINE_FILE}.`)
    process.exitCode = 1
    return null
  }

  return parsed
}

const writeViolations = async (
  violations: LintViolation[],
  scopedFiles: ReadonlySet<string> | null,
) => {
  if (scopedFiles === null) {
    await saveBaseline(violations)
    return
  }

  const baseline = await loadBaseline()
  if (baseline === null) return
  await saveBaseline(
    mergeBaselineViolations(baseline.violations, violations, scopedFiles),
  )
}

const reportIncreases = (
  increases: LintViolation[],
  allowedCounts: Map<string, number>,
) => {
  if (increases.length === 0) return false

  console.error(
    'Lint warning ratchet failed; these file/rule counts increased:',
  )
  for (const entry of increases) {
    console.error(
      `- ${entry.file} ${entry.rule}: ${allowedCounts.get(toKey(entry)) ?? 0} -> ${entry.count}`,
    )
  }
  process.exitCode = 1
  return true
}

const run = async () => {
  const cwd = process.cwd()
  const { writeBaseline, fix, files } = parseCliArgs(process.argv.slice(2))
  const lintTargets = files.length > 0 ? files : ['.']
  const scopedFiles =
    files.length > 0
      ? new Set(files.map((file) => normalizeFile(file, cwd)))
      : null

  const results = runOxlint(lintTargets, fix)

  if (reportLintErrors(formatErrors(results, cwd))) return

  const violations = collectInventory(results, cwd)
  if (writeBaseline) {
    await writeViolations(violations, scopedFiles)
    return
  }

  const baseline = await loadBaseline()
  if (baseline === null) return
  const { allowedCounts, increases, reductions } = compareInventory(
    violations,
    baseline.violations,
    scopedFiles,
  )
  if (reportIncreases(increases, allowedCounts)) return

  if (reductions.length > 0) {
    console.log(
      `Lint debt decreased in ${reductions.length} file/rule entries. Run pnpm lint:ratchet:update to lock in the lower baseline.`,
    )
  }
  const scopeLabel =
    scopedFiles === null
      ? `${violations.length} file/rule entries`
      : `${scopedFiles.size} staged files, ${violations.length} file/rule entries`
  console.log(`Lint warning ratchet passed (${scopeLabel}, no increases).`)
}

run().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
