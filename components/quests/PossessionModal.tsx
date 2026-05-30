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
import { ItemIdentity } from '../common/ItemIdentity'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { DEFAULT_SURPLUS_THRESHOLD, SurplusThreshold } from '../../lib/quest-efficiency'
import type { Rarity } from '../../lib/item-rarity'

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

const RARITIES: { key: Rarity; color: string }[] = [
  { key: 'gold', color: '#c79a3a' },
  { key: 'silver', color: '#9aa0a6' },
  { key: 'bronze', color: '#b07a4a' },
]

/**
 * 所持数(`posession`)とレア別余剰しきい値(`efficiency/surplusThreshold`)を編集する
 * モーダル。`useLocalStorage` の `ls-sync` で一覧側へ即時反映される。
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
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto gap-5">
        <DialogHeader>
          <DialogTitle>{t('所持数を登録')}</DialogTitle>
          <DialogDescription>{t('所持数モーダル説明')}</DialogDescription>
        </DialogHeader>

        {/* レア別余剰しきい値 */}
        <div
          className="rounded-lg p-3.5"
          style={{ background: 'var(--bg2)', border: '1px solid var(--gold-dim)' }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text1)' }}>
            {t('余剰しきい値')}
          </p>
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--text3)' }}>
            {t('余剰しきい値の説明')}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {RARITIES.map(({ key, color }) => (
              <label key={key} className="flex flex-col gap-1 text-xs">
                <span className="font-semibold" style={{ color }}>
                  {rarityLabel(key)}
                </span>
                <Input
                  type="number"
                  min={0}
                  value={threshold[key] ?? DEFAULT_SURPLUS_THRESHOLD[key]}
                  onChange={e => setThresh(key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

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
    </Dialog>
  )
}
