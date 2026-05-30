'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { DEFAULT_SURPLUS_THRESHOLD, SurplusThreshold } from '../../lib/quest-efficiency'
import type { Rarity } from '../../lib/item-rarity'

type ItemLike = {
  id: string
  name: string
  category: string
  largeCategory?: string
  shortName?: string
}

const RARITIES: Rarity[] = ['gold', 'silver', 'bronze']

/**
 * 所持数(`posession`)とレア別余剰しきい値(`efficiency/surplusThreshold`)を編集する
 * モーダル。`useLocalStorage` の `ls-sync` イベントで一覧側へ即時反映される。
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
  const [threshold, setThreshold] = useLocalStorage<SurplusThreshold>(
    'efficiency/surplusThreshold',
    DEFAULT_SURPLUS_THRESHOLD,
  )

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
    const n = value === '' ? undefined : Math.max(0, Math.floor(Number(value)))
    setPossession(prev => ({ ...prev, [id]: Number.isFinite(n as number) ? n : undefined }))
  }

  const setThresh = (r: Rarity, value: string) => {
    const n = Math.max(0, Math.floor(Number(value) || 0))
    setThreshold(prev => ({ ...DEFAULT_SURPLUS_THRESHOLD, ...prev, [r]: n }))
  }

  const rarityLabel = (r: Rarity) => t(r === 'gold' ? '金' : r === 'silver' ? '銀' : '銅')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('所持数・しきい値設定')}</DialogTitle>
          <DialogDescription>{t('余剰しきい値')}</DialogDescription>
        </DialogHeader>

        {/* レア別余剰しきい値 */}
        <div className="grid grid-cols-3 gap-3">
          {RARITIES.map(r => (
            <label key={r} className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text2)' }}>
              <span className="font-semibold">{rarityLabel(r)}</span>
              <Input
                type="number"
                min={0}
                value={threshold[r] ?? DEFAULT_SURPLUS_THRESHOLD[r]}
                onChange={e => setThresh(r, e.target.value)}
              />
            </label>
          ))}
        </div>

        {/* 所持数(カテゴリ別) */}
        <div className="flex flex-col gap-4 mt-2">
          {grouped.map(([category, list]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text2)' }}>
                {category}
              </h4>
              <div className="grid grid-cols-2 gap-2">
                {list.map(it => (
                  <label key={it.id} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate" title={it.name} style={{ color: 'var(--text1)' }}>
                      {it.shortName || it.name}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      className="w-20"
                      value={possession[it.id] ?? ''}
                      onChange={e => setOwned(it.id, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
