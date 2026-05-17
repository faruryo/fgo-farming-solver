import { readLocalJson } from '../../../lib/data-source'
import type { ProgressResponse } from '../../../lib/progress/types'
import { promises as fs } from 'fs'
import path from 'path'

// Persist the scenario index across hot-reloads in Next.js dev mode.
// Module-scope variables reset on each HMR cycle, so we use a file instead.
const INDEX_FILE = path.resolve('.next/cache/dev-progress-mock-index.txt')

const readIndex = async (): Promise<number> => {
  try {
    const raw = await fs.readFile(INDEX_FILE, 'utf-8')
    return parseInt(raw, 10) || 0
  } catch {
    return 0
  }
}

const writeIndex = async (n: number) => {
  try {
    await fs.mkdir(path.dirname(INDEX_FILE), { recursive: true })
    await fs.writeFile(INDEX_FILE, String(n), 'utf-8')
  } catch {
    // non-critical; worst case the index resets
  }
}

export const getDevMockResponse = async (): Promise<ProgressResponse | null> => {
  const scenarios = await readLocalJson<(ProgressResponse & { _scenario?: string })[]>(
    'mocks/progress.json'
  )
  if (!scenarios || scenarios.length === 0) return null

  const index = await readIndex()
  const scenario = scenarios[index % scenarios.length]
  console.log(`[api/progress] dev mock scenario ${index % scenarios.length}: ${scenario._scenario ?? ''}`)
  await writeIndex((index + 1) % scenarios.length)

  return Object.fromEntries(
    Object.entries(scenario).filter(([k]) => k !== '_scenario')
  ) as ProgressResponse
}
