import { useCallback, useEffect, useRef, useState } from 'react'
import type { MaterialCatalogV1 } from '../lib/material-catalog'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object'

const isCatalog = (value: unknown): value is MaterialCatalogV1 => {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Number.isFinite(value.updatedAt)) return false
  if (!Array.isArray(value.servants) || !Array.isArray(value.items)) return false
  if (!isRecord(value.materials) || !isRecord(value.sources)) return false
  return value.servants.every(servant =>
    isRecord(servant) && typeof servant.id === 'number' && typeof servant.name === 'string' &&
    typeof servant.className === 'string' && typeof servant.collectionNo === 'number' &&
    typeof servant.rarity === 'number' && (typeof servant.face === 'string' || servant.face === null)) &&
    value.items.every(item =>
      isRecord(item) && typeof item.id === 'number' && typeof item.name === 'string' &&
      typeof item.icon === 'string')
}

// 同じページの複数の部品が同時に呼んでも取得を1回にする。API の max-age と同じ5分だけ使い回し、失敗は残さない。
// fresh は再試行用で、使い回さずに取り直す。
const SHARE_MS = 5 * 60 * 1000
let shared: { promise: Promise<MaterialCatalogV1>; at: number } | null = null

export const loadMaterialCatalog = (fresh = false): Promise<MaterialCatalogV1> => {
  if (!fresh && shared && Date.now() - shared.at < SHARE_MS) return shared.promise
  const promise = fetch('/api/material-catalog').then(async response => {
    if (!response.ok) throw new Error('catalog request failed')
    const value: unknown = await response.json()
    if (!isCatalog(value)) throw new Error('invalid catalog')
    return value
  })
  const entry = { promise, at: Date.now() }
  shared = entry
  promise.catch(() => {
    if (shared === entry) shared = null
  })
  return promise
}

export const useMaterialCatalog = () => {
  const [catalog, setCatalog] = useState<MaterialCatalogV1 | null>(null)
  const [failed, setFailed] = useState(false)
  const requestId = useRef(0)
  const load = useCallback((fresh = false) => {
    const currentRequestId = ++requestId.current
    setFailed(false)
    loadMaterialCatalog(fresh).then(value => {
      if (currentRequestId !== requestId.current) return
      setCatalog(value)
    }).catch(() => {
      if (currentRequestId === requestId.current) setFailed(true)
    })
  }, [])
  const reload = useCallback(() => load(true), [load])
  useEffect(() => {
    void Promise.resolve().then(() => load())
    return () => { requestId.current += 1 }
  }, [load])
  return { catalog, failed, reload }
}
