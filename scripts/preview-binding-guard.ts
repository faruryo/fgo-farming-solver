import { parse } from 'smol-toml'

// main の本番 KV / D1。ブランチ側でトップレベルを書き換えても基準が動かないよう固定で持つ
// 本番 Worker 名も含める。プレビューのサービスバインディングは束縛先の本番デプロイを呼ぶため
const KNOWN_PRODUCTION_IDS = [
  'c621d47e509445a3a7f713702b3cb07e',
  '306bbe537e9d4907809f82468df500e4',
  '4bb0a615-9079-4233-b57f-a5725b9eb4da',
  'fgo-farming-solver',
]

type Binding = { id?: unknown; database_id?: unknown }

const bindingIds = (bindings: unknown): string[] =>
  Array.isArray(bindings)
    ? (bindings as Binding[]).flatMap((b) =>
        [b.id, b.database_id].filter((v): v is string => typeof v === 'string'),
      )
    : []

const stringsIn = (value: unknown): string[] => {
  if (typeof value === 'string') return [value]
  if (value && typeof value === 'object')
    return Object.values(value).flatMap(stringsIn)
  return []
}

export const productionIdsInPreviews = (toml: string): string[] => {
  const config = parse(toml) as Record<string, unknown>
  const production = new Set([
    ...KNOWN_PRODUCTION_IDS,
    ...bindingIds(config.kv_namespaces),
    ...bindingIds(config.d1_databases),
  ])
  // previews 配下はキー名を問わずすべての文字列を照合する
  return [...new Set(stringsIn(config.previews))].filter((s) =>
    production.has(s),
  )
}
