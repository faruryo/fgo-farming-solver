'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { useStockTarget } from '../../hooks/use-stock-target'
import type { CategoryGroup, Rarity } from '../../lib/item-rarity'

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
 * カテゴリ群×レアの在庫基準(`stockBuffer`)の編集UI。
 * `useStockTarget` 経由で localStorage/クラウド同期を共有するため、所持数モーダル・育成計算機など
 * 複数の入口に同じものを置ける(設定はどこから変えても全画面に反映)。
 */
export const StockTargetSettings: React.FC = () => {
  const { t } = useTranslation('quests')
  const { setRawStockBuffer, stockBuffer } = useStockTarget()

  const setBufferCell = (
    group: CategoryGroup,
    rarity: Rarity,
    value: string,
  ) => {
    // 編集したセルだけ保存する(未設定の群・レアは resolveStockBuffer が現行デフォルトで補完)。
    // 空入力はそのセルのカスタム値を削除し既定へ戻す。prev?.[group] が null でも落ちないようガード。
    setRawStockBuffer((prev) => {
      const safe = prev ?? {}
      const groupData: Partial<Record<Rarity, number>> = { ...safe[group] }
      if (value === '') {
        delete groupData[rarity]
      } else {
        groupData[rarity] = Math.max(0, Math.floor(Number(value) || 0))
      }
      return { ...safe, [group]: groupData }
    })
  }

  const rarityLabel = (r: Rarity) =>
    t(r === 'gold' ? '金' : r === 'silver' ? '銀' : '銅')
  const groupLabel = (g: CategoryGroup) =>
    t(GROUPS.find((x) => x.key === g)?.labelKey ?? g)

  return (
    <div
      className="rounded-lg p-3.5"
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--gold-dim)',
      }}
    >
      <div className="mb-1">
        <p className="text-xs font-semibold" style={{ color: 'var(--text1)' }}>
          {t('inventory-baseline-settings', '在庫基準の設定')}
        </p>
      </div>
      <p
        className="text-[11px] leading-relaxed mb-3"
        style={{ color: 'var(--text3)' }}
      >
        {t(
          'inventory-baseline-description',
          '在庫がこの個数を下回る素材ほど、周回効率ポイントで高く評価します。',
        )}
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
            <span
              className="text-[11px] font-medium"
              style={{ color: 'var(--text1)' }}
            >
              {groupLabel(group)}
            </span>
            {RARITIES.map(({ key: rarity }) => {
              const value = stockBuffer[group][rarity]
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
                  onChange={(e) => setBufferCell(group, rarity, e.target.value)}
                />
              )
            })}
          </React.Fragment>
        ))}
      </div>

      <p
        className="text-[10px] leading-relaxed mt-3"
        style={{ color: 'var(--text3)' }}
      >
        {t(
          'inventory-baseline-hint',
          '新規サーヴァントへの備えでは、育成必要数とこの在庫基準の大きい方を目標にします。',
        )}
      </p>
    </div>
  )
}
