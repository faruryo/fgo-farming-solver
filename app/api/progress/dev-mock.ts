import { readLocalJson } from '../../../lib/data-source'
import type { ProgressResponse } from '../../../lib/progress/types'

export const getDevMockResponse = async (): Promise<ProgressResponse | null> => {
  const scenarios = await readLocalJson<(ProgressResponse & { _scenario?: string })[]>(
    'mocks/progress.json'
  )
  if (!scenarios || scenarios.length === 0) return null

  // Time-based rotation: changes every 3 seconds.
  // This is HMR-safe, process-isolation safe, and requires no filesystem writes or global state.
  const intervalSeconds = 3
  const timeSlice = Math.floor(Date.now() / (intervalSeconds * 1000))
  const index = timeSlice % scenarios.length

  const scenario = scenarios[index]
  console.log(`[api/progress] dev mock scenario ${index} (time-based): ${scenario._scenario ?? ''}`)

  return Object.fromEntries(
    Object.entries(scenario).filter(([k]) => k !== '_scenario')
  ) as ProgressResponse
}
