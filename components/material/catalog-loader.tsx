'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MaterialCatalogV1 } from '../../lib/material-catalog'
import { Index } from './index'
import { Material } from './material'

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

export function MaterialCatalogLoader({ className }: Readonly<{ className?: string }>) {
  const [catalog, setCatalog] = useState<MaterialCatalogV1 | null>(null)
  const [failed, setFailed] = useState(false)
  const requestId = useRef(0)
  const { t } = useTranslation('material')
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
  if (failed) return <div><p>{t('catalog-load-error', '素材データを読み込めません。')}</p><button type="button" onClick={load}>{t('catalog-retry', '再試行')}</button></div>
  if (!catalog) return <p>{t('catalog-loading', '素材データを読み込んでいます…')}</p>
  const props = { servants: catalog.servants, materials: catalog.materials, locale: 'ja' }
  return className ? <Material {...props} className={className} /> : <Index {...props} items={catalog.items} />
}
