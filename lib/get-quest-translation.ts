import { canAccessFs } from './data-source'

export const getQuestTranslation = async (): Promise<{
  [jpQuestName: string]: string
}> => {
  // 1. Try local cache file
  const hasFs = await canAccessFs()
  if (hasFs) {
    try {
      const fs = await import(/* webpackIgnore: true */ 'fs/promises')
      const path = await import(/* webpackIgnore: true */ 'path')
      const cachePath = path.default.resolve('cache', 'quests.json')
      const value = await fs.default.readFile(cachePath, 'utf-8')
      return JSON.parse(value) as Record<string, string>
    } catch {
      // cache miss — continue to fetch
    }
  }

  // 2. Fetch from Google Sheets
  const key = process.env.GOOGLE_SHEETS_API_KEY
  if (!key) {
    console.warn(
      'GOOGLE_SHEETS_API_KEY is not set. Quest translations will be missing.'
    )
    return {}
  }
  const spreadsheetId = '1NY7nOVQkDyWTXhnK1KP1oPUXoN1C0SY6pMEXPcFuKyI'
  const range = "'JP Droprate Table'!D:E"
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${key}`

  try {
    const res = await fetch(url).then((r) =>
      r.json<{ values: [string, string][] }>()
    )
    const map = Object.fromEntries(
      res.values
        .filter((row: string[]) => row.length == 2)
        .slice(1)
        .map(([enName, jpName]: string[]) => [jpName, enName])
    )

    // 3. Write cache (best-effort, only if fs is available)
    if (hasFs) {
      try {
        const fs = await import(/* webpackIgnore: true */ 'fs/promises')
        const path = await import(/* webpackIgnore: true */ 'path')
        const cacheDir = path.default.resolve('cache')
        const cachePath = path.default.resolve(cacheDir, 'quests.json')
        await fs.default.mkdir(cacheDir, { recursive: true })
        await fs.default.writeFile(cachePath, JSON.stringify(map), 'utf-8')
      } catch {
        // write failed — no problem
      }
    }

    return map
  } catch (err) {
    console.error('Failed to fetch quest translations from Google Sheets:', err)
    return {}
  }
}
