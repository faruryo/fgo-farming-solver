'use client'

import React, { useMemo, useState } from 'react'
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
import { ItemIdentity } from '../common/ItemIdentity'
import { StockTargetSettings } from '../common/StockTargetSettings'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { PossessionImportDialog } from '../common/possession-import/PossessionImportDialog'
import { parsePossessionInput } from '../../lib/possession-count'

type ItemLike = {
  id: string
  name: string
  category: string
  largeCategory?: string
  shortName?: string
  icon?: string
  /** Atlas ID。所持数は育成計算機と同じ Atlas ID 空間で保存する。 */
  atlasId?: number
}

/**
 * 所持数(`posession`)とストック目標を編集するモーダル。
 * `useLocalStorage` の `ls-sync` で一覧側へ即時反映される。
 */
export const PossessionModal: React.FC<{
  items: ItemLike[]
  open: boolean
  onOpenChange: (open: boolean) => void
}> = ({ items, open, onOpenChange }) => {
  const { t } = useTranslation('quests')
  const [possession, setPossession] = useLocalStorage<Record<string, number | undefined>>(
    'posession',
    {},
  )
  const [importOpen, setImportOpen] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<string, ItemLike[]>()
    for (const it of items) {
      const arr = map.get(it.category) ?? []
      arr.push(it)
      map.set(it.category, arr)
    }
    return [...map.entries()]
  }, [items])

  const setOwned = (id: string, value: string) => {
    setPossession(prev => ({ ...prev, [id]: parsePossessionInput(value) }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto gap-5">
        <DialogHeader>
          <DialogTitle>{t('所持数を登録')}</DialogTitle>
          <DialogDescription>{t('所持数モーダル説明')}</DialogDescription>
        </DialogHeader>

        <Button variant="outline" size="sm" className="self-start" onClick={() => setImportOpen(true)}>
          <ImageUp />
          {t('スクリーンショットから取り込む')}
        </Button>

        <StockTargetSettings />

        {/* 所持数(カテゴリ別) */}
        <div className="flex flex-col gap-4">
          {grouped.map(([category, list]) => (
            <div key={category}>
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
                    <div key={it.id} className="flex items-center gap-2">
                      <ItemIdentity icon={it.icon} name={it.name} size={26} />
                      <span
                        className="flex-1 text-xs truncate"
                        title={it.name}
                        style={{ color: 'var(--text1)' }}
                      >
                        {it.shortName || it.name}
                      </span>
                      <Input
                        type="number"
                        min={0}
                        className="w-20 h-8 text-right"
                        placeholder="0"
                        value={possession[key] ?? ''}
                        onChange={e => setOwned(key, e.target.value)}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
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
