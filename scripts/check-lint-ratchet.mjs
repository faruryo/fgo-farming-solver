import { ESLint } from 'eslint'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const BASELINE_VERSION = 1
const baselinePath = path.join(
  process.cwd(),
  'quality',
  'lint-ratchet-baseline.json',
)
const writeBaseline = process.argv.includes('--write')

const toKey = ({ file, rule }) => `${file}\0${rule}`

const collectInventory = (results) => {
  const counts = new Map()

  for (const result of results) {
    const file = path.relative(process.cwd(), result.filePath)
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

const formatErrors = (results) =>
  results.flatMap((result) => {
    const file = path.relative(process.cwd(), result.filePath)
    return result.messages
      .filter((message) => message.severity === 2)
      .map(
        (message) =>
          `${file}:${message.line ?? 0}:${message.column ?? 0} ${message.ruleId ?? 'parse'} ${message.message}`,
      )
  })

const reportLintErrors = (errors) => {
  if (errors.length === 0) return false

  console.error(
    'Cannot evaluate the warning ratchet while ESLint errors exist:',
  )
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
  return true
}

const saveBaseline = async (violations) => {
  await mkdir(path.dirname(baselinePath), { recursive: true })
  await writeFile(
    baselinePath,
    `${JSON.stringify({ version: BASELINE_VERSION, violations }, null, 2)}\n`,
    'utf8',
  )
  console.log(
    `Updated ${path.relative(process.cwd(), baselinePath)} with ${violations.length} file/rule entries.`,
  )
}

const loadBaseline = async () => {
  let baseline
  try {
    baseline = JSON.parse(await readFile(baselinePath, 'utf8'))
  } catch (error) {
    console.error(
      `Cannot read ${path.relative(process.cwd(), baselinePath)}. Run pnpm lint:ratchet:update first.`,
    )
    console.error(error)
    process.exitCode = 1
    return null
  }

  if (
    baseline.version !== BASELINE_VERSION ||
    !Array.isArray(baseline.violations)
  ) {
    console.error(
      `Unsupported lint ratchet baseline format in ${path.relative(process.cwd(), baselinePath)}.`,
    )
    process.exitCode = 1
    return null
  }

  return baseline
}

const compareInventory = (violations, baseline) => {
  const allowedCounts = new Map(
    baseline.violations.map((entry) => [toKey(entry), entry.count]),
  )
  const currentCounts = new Map(
    violations.map((entry) => [toKey(entry), entry.count]),
  )
  return {
    allowedCounts,
    increases: violations.filter(
      (entry) => entry.count > (allowedCounts.get(toKey(entry)) ?? 0),
    ),
    reductions: baseline.violations.filter(
      (entry) => (currentCounts.get(toKey(entry)) ?? 0) < entry.count,
    ),
  }
}

const reportIncreases = (increases, allowedCounts) => {
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
  const eslint = new ESLint({ cwd: process.cwd() })
  const results = await eslint.lintFiles(['.'])
  const errors = formatErrors(results)
  if (reportLintErrors(errors)) return

  const violations = collectInventory(results)
  if (writeBaseline) {
    await saveBaseline(violations)
    return
  }

  const baseline = await loadBaseline()
  if (baseline === null) return
  const { allowedCounts, increases, reductions } = compareInventory(
    violations,
    baseline,
  )
  if (reportIncreases(increases, allowedCounts)) return

  if (reductions.length > 0) {
    console.log(
      `Lint debt decreased in ${reductions.length} file/rule entries. Run pnpm lint:ratchet:update to lock in the lower baseline.`,
    )
  }
  console.log(
    `Lint warning ratchet passed (${violations.length} file/rule entries, no increases).`,
  )
}

await run()
