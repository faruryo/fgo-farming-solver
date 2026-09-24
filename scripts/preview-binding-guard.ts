type TomlTable = {
  header: string
  body: string
}

const stripBrackets = (header: string): string => {
  let start = 0
  let end = header.length
  while (start < end && header.charAt(start) === '[') start += 1
  while (end > start && header.charAt(end - 1) === ']') end -= 1
  return header.slice(start, end)
}

const tableName = (header: string): string => stripBrackets(header.trim())

const isTableHeader = (line: string): boolean => {
  const trimmed = line.trim()
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return false
  const name = stripBrackets(trimmed)
  return name.length > 0 && !name.includes('[') && !name.includes(']')
}

const tablesOf = (toml: string): TomlTable[] => {
  const tables: TomlTable[] = []
  let header = ''
  const body: string[] = []
  const flush = () => {
    tables.push({ header, body: body.join('\n') })
    body.length = 0
  }
  for (const line of toml.split('\n')) {
    if (isTableHeader(line)) {
      flush()
      header = line.trim()
      continue
    }
    body.push(line)
  }
  flush()
  return tables
}

const isPreviewHeader = (header: string): boolean => {
  const name = tableName(header)
  return name === 'previews' || name.startsWith('previews.')
}

const isProductionStoreHeader = (header: string): boolean => {
  const name = tableName(header)
  return name === 'kv_namespaces' || name === 'd1_databases'
}

const quotedAssignment = (line: string, key: string): string | null => {
  const trimmed = line.trim()
  const eq = trimmed.indexOf('=')
  if (eq < 0) return null
  if (trimmed.slice(0, eq).trim() !== key) return null
  const raw = trimmed.slice(eq + 1).trim()
  if (raw.length < 2 || !raw.startsWith('"') || !raw.endsWith('"')) return null
  return raw.slice(1, -1)
}

const productionResourceIds = (toml: string): string[] => {
  const ids: string[] = []
  for (const table of tablesOf(toml)) {
    if (table.header === '' || isPreviewHeader(table.header)) continue
    if (!isProductionStoreHeader(table.header)) continue
    for (const line of table.body.split('\n')) {
      const id =
        quotedAssignment(line, 'id') ?? quotedAssignment(line, 'database_id')
      if (id) ids.push(id)
    }
  }
  return ids
}

const isPreviewsAssignment = (line: string): boolean => {
  const rest = line.trim().slice('previews'.length).trimStart()
  return line.trim().startsWith('previews') && rest.startsWith('=')
}

const previewSectionText = (toml: string): string => {
  const parts: string[] = []
  for (const table of tablesOf(toml)) {
    if (isPreviewHeader(table.header)) {
      parts.push(table.header, table.body)
      continue
    }
    if (table.header !== '') continue
    for (const line of table.body.split('\n')) {
      if (isPreviewsAssignment(line)) parts.push(line)
    }
  }
  return parts.join('\n')
}

export const productionIdsInPreviews = (toml: string): string[] => {
  const preview = previewSectionText(toml)
  return [...new Set(productionResourceIds(toml))].filter(
    (id) => id.length > 0 && preview.includes(`"${id}"`),
  )
}
