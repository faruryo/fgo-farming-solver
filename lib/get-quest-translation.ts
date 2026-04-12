export const getQuestTranslation = async (): Promise<{
  [jpQuestName: string]: string
}> => {
  const isEdge = process.env.NEXT_RUNTIME === 'edge'

  if (!isEdge) {
    const fs = await import(/* webpackIgnore: true */ 'fs/promises')
    const path = await import(/* webpackIgnore: true */ 'path')
    const cacheDir = path.default.resolve('cache')
    const cachePath = path.default.resolve(cacheDir, 'quests.json')

    try {
      const value = await fs.default.readFile(cachePath, 'utf-8')
      return JSON.parse(value) as Record<string, string>
    } catch {
      // ignore
    }
  }

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
      r.json() as Promise<{ values: [string, string][] }>
    )
    const map = Object.fromEntries(
      res.values
        .filter((row) => row.length == 2)
        .slice(1)
        .map(([enName, jpName]) => [jpName, enName])
    )

    if (!isEdge) {
      const fs = await import(/* webpackIgnore: true */ 'fs/promises')
      const path = await import(/* webpackIgnore: true */ 'path')
      const cacheDir = path.default.resolve('cache')
      const cachePath = path.default.resolve(cacheDir, 'quests.json')

      fs.default
        .mkdir(cacheDir, { recursive: true })
        .then(() =>
          fs.default.writeFile(cachePath, JSON.stringify(map), 'utf-8')
        )
        .catch(() => { })
    }

    return map
  } catch (err) {
    console.error('Failed to fetch quest translations from Google Sheets:', err)
    return {}
  }
}
