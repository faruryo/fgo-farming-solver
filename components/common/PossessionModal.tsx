'use client'

import React, { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ImageUp } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ItemIdentity } from './ItemIdentity'
import { StockTargetSettings } from './StockTargetSettings'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { PossessionImportDialog } from './possession-import/PossessionImportDialog'
import { parsePossessionInput } from '../../lib/possession-count'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'

export type PossessionItemLike = {
  id: string
  name: string
  category: string
  largeCategory?: string
  shortName?: string
  icon?: string
  /** Atlas ID。所持数は育成計算機と同じ Atlas ID 空間で保存する。 */
  atlasId?: number
}

const PossessionItemRow: React.FC<{
  item: PossessionItemLike
  value: number | undefined
  onChange: (id: string, value: string) => void
}> = ({ item, value, onChange }) => {
  const key = item.atlasId != null ? String(item.atlasId) : item.id
  return (
    <div className="flex items-center gap-2">
      <ItemIdentity icon={item.icon} name={item.name} size={26} />
      <span
        className="flex-1 text-xs truncate"
        title={item.name}
        style={{ color: 'var(--text1)' }}
      >
        {item.shortName || item.name}
      </span>
      <Input
        type="number"
        min={0}
        className="w-20 h-8 text-right"
        placeholder="0"
        value={value ?? ''}
        onChange={e => onChange(key, e.target.value)}
      />
    </div>
  )
}

const PossessionCategorySection: React.FC<{
  category: string
  list: PossessionItemLike[]
  possession: Record<string, number | undefined>
  onChange: (id: string, value: string) => void
}> = ({ category, list, possession, onChange }) => (
  <div>
    <h4
      className="text-[11px] font-bold tracking-wide mb-2 pb-1"
      style={{ color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}
    >
      {category}
    </h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
      {list.map(it => {
        const key = it.atlasId != null ? String(it.atlasId) : it.id
        return (
          <PossessionItemRow
            key={it.id}
            item={it}
            value={possession[key]}
            onChange={onChange}
          />
        )
      })}
    </div>
  </div>
)

/**
 * 所持数(`posession`)とストック目標を編集するモーダル。
 * `useLocalStorage` の `ls-sync` で一覧側・ダッシュボード側へ即時反映される。
 */
export const PossessionModal: React.FC<{
  items: PossessionItemLike[]
  open: boolean
  onOpenChange: (open: boolean) => void
}> = ({ items, open, onOpenChange }) => {
  const { t } = useTranslation('quests')
  const [possession, setPossession] = useLocalStorage<Record<string, number | undefined>>(
    STORAGE_KEYS.POSSESSION,
    {},
  )
  const [importOpen, setImportOpen] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<string, PossessionItemLike[]>()
    for (const it of items) {
      const arr = map.get(it.category) ?? []
      arr.push(it)
      map.set(it.category, arr)
    }
    return [...map.entries()]
  }, [items])

  const setOwned = useCallback((id: string, value: string) => {
    setPossession(prev => ({ ...prev, [id]: parsePossessionInput(value) }))
  }, [setPossession])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto gap-5">
        <DialogHeader>
          <DialogTitle>{t('所持数を登録', '所持数を登録')}</DialogTitle>
          <DialogDescription>{t('所持数モーダル説明', '各素材の所持数を入れると、不足している素材を優先して効率を計算します。未入力の素材は所持0として扱われます。')}</DialogDescription>
        </DialogHeader>

        <Button variant="outline" size="sm" className="self-start" onClick={() => setImportOpen(true)}>
          <ImageUp className="mr-1.5 h-4 w-4" />
          {t('スクリーンショットから取り込む', 'スクリーンショットから取り込む')}
        </Button>

        <StockTargetSettings />

        <div className="flex flex-col gap-4">
          {grouped.map(([category, list]) => (
            <PossessionCategorySection
              key={category}
              category={category}
              list={list}
              possession={possession}
              onChange={setOwned}
            />
          ))}
        </div>
      </DialogContent>

      <PossessionImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        items={items}
        possession={possession}
        onConfirm={(updates) =>
          setPossession((prev) => ({ ...prev, ...updates }))
        }
      />
    </Dialog>
  )
}
