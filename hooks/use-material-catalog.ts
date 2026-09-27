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

export const useMaterialCatalog = () => {
  const [catalog, setCatalog] = useState<MaterialCatalogV1 | null>(null)
  const [failed, setFailed] = useState(false)
  const requestId = useRef(0)
  const load = useCallback(() => {
    const currentRequestId = ++requestId.current
    setFailed(false)
    fetch('/api/material-catalog').then(async response => {
      if (!response.ok) throw new Error('catalog request failed')
      const value: unknown = await response.json()
      if (!isCatalog(value)) throw new Error('invalid catalog')
      if (currentRequestId !== requestId.current) return
      setCatalog(value)
    }).catch(() => {
      if (currentRequestId === requestId.current) setFailed(true)
    })
  }, [])
  useEffect(() => {
    void Promise.resolve().then(load)
    return () => { requestId.current += 1 }
  }, [load])
  return { catalog, failed, reload: load }
}
