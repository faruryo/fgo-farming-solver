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
import { Switch } from '@/components/ui/switch'
import { ItemIdentity } from '../common/ItemIdentity'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useStockTarget } from '../../hooks/use-stock-target'
import type { CategoryGroup } from '../../lib/item-rarity'
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

const GROUPS: { key: CategoryGroup; labelKey: string }[] = [
  { key: 'normal', labelKey: '通常素材' },
  { key: 'skillStone', labelKey: 'スキル石' },
  { key: 'monumentPiece', labelKey: 'モニュピ' },
]

/**
 * 所持数(`posession`)とストック目標(`efficiency/stockBuffer`)を編集する
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
  const { stockEnabled, setStockEnabled, setRawStockBuffer, stockBuffer: resolvedBuffer } =
    useStockTarget()

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

  const setBufferCell = (group: CategoryGroup, rarity: Rarity, value: string) => {
    const n = Math.max(0, Math.floor(Number(value) || 0))
    // 編集したセルだけを保存する(デフォルト全体は焼き込まない)。未設定の群・レアは
    // resolveStockBuffer が現行デフォルトで補完するため、将来のデフォルト変更にも追従する。
    setRawStockBuffer(prev => ({
      ...prev,
      [group]: { ...prev[group], [rarity]: n },
    }))
  }

  const rarityLabel = (r: Rarity) => t(r === 'gold' ? '金' : r === 'silver' ? '銀' : '銅')
  const groupLabel = (g: CategoryGroup) =>
    t(GROUPS.find(x => x.key === g)?.labelKey ?? g)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto gap-5">
        <DialogHeader>
          <DialogTitle>{t('所持数を登録')}</DialogTitle>
          <DialogDescription>{t('所持数モーダル説明')}</DialogDescription>
        </DialogHeader>

        {/* ストック目標設定 */}
        <div
          className="rounded-lg p-3.5"
          style={{
            background: 'var(--bg2)',
            border: `1px solid ${stockEnabled ? 'var(--gold2)' : 'var(--gold-dim)'}`,
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="text-xs font-semibold" style={{ color: 'var(--text1)' }}>
              {t('ストック目標設定')}
            </p>
            <label className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-[10px]" style={{ color: 'var(--text3)' }}>
                {t('目標に含める')}
              </span>
              <Switch
                checked={stockEnabled}
                onCheckedChange={setStockEnabled}
                aria-label={t('目標に含める')}
              />
            </label>
          </div>
          <p className="text-[11px] leading-relaxed mb-3" style={{ color: 'var(--text3)' }}>
            {stockEnabled ? t('ストック目標ON説明') : t('ストック目標OFF説明')}
          </p>

          <div className="grid grid-cols-[78px_repeat(3,1fr)] gap-2 items-center">
            <span className="text-[10px]" style={{ color: 'var(--text3)' }} />
            {RARITIES.map(({ key, color }) => (
              <span
                key={key}
                className="text-center text-[11px] font-semibold"
                style={{ color }}
              >
                {rarityLabel(key)}
              </span>
            ))}

            {GROUPS.map(({ key: group }) => (
              <React.Fragment key={group}>
                <span className="text-[11px] font-medium" style={{ color: 'var(--text1)' }}>
                  {groupLabel(group)}
                </span>
                {RARITIES.map(({ key: rarity }) => {
                  const value = resolvedBuffer[group][rarity]
                  if (value === undefined) {
                    return (
                      <span
                        key={rarity}
                        className="text-center text-sm"
                        style={{ color: 'var(--text3)' }}
                      >
                        —
                      </span>
                    )
                  }
                  return (
                    <Input
                      key={rarity}
                      type="number"
                      min={0}
                      className="h-8 text-right"
                      value={value}
                      onChange={e => setBufferCell(group, rarity, e.target.value)}
                    />
                  )
                })}
              </React.Fragment>
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
