'use client'

import { useTranslation } from 'react-i18next'
import { useMaterialCatalog } from '../../hooks/use-material-catalog'
import { Index } from './index'
import { Material } from './material'

export function MaterialCatalogLoader({ className }: Readonly<{ className?: string }>) {
  const { catalog, failed, reload } = useMaterialCatalog()
  const { t } = useTranslation('material')
  if (failed) return <div><p>{t('catalog-load-error', '素材データを読み込めません。')}</p><button type="button" onClick={reload}>{t('catalog-retry', '再試行')}</button></div>
  if (!catalog) return <p>{t('catalog-loading', '素材データを読み込んでいます…')}</p>
  const props = { servants: catalog.servants, materials: catalog.materials, locale: 'ja' }
  return className ? <Material {...props} className={className} /> : <Index {...props} items={catalog.items} />
}
