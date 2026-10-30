'use client'

import React from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'

const Icon: React.FC<{ src?: string }> = ({ src }) =>
  src ? <Image src={src} alt="" width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" /> : null

/** 入力を 0 以上の整数に直す（負の数・小数・数でない値を含む）。 */
export const toCount = (value: string): number => {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

/** ボーナスの欄に並べる品目。 */
export interface BonusTarget {
  itemId: number
  label: string
  icon?: string
}

/** ドロップ増加礼装の「1ドロップにつき +N」を品目ごとに入れる欄。説明の1行は呼び出し側が渡す。 */
export const DropBonusInputs: React.FC<{
  targets: BonusTarget[]
  bonus: ReadonlyMap<number, number>
  unappliedLabels: string[]
  description: string
  onChange: (itemId: number, value: number) => void
}> = ({ targets, bonus, unappliedLabels, description, onChange }) => {
  const { t } = useTranslation('events')
  return (
    <div
      className="rounded-md flex flex-col gap-2 px-4 py-3"
      style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text1)' }}>
        {t('event-shop-bonus-title', 'ドロップ増加礼装')}
      </h3>
      <p className="text-xs" style={{ color: 'var(--text2)' }}>
        {description}
      </p>
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-4 gap-y-2 text-xs" style={{ color: 'var(--text2)' }}>
        {targets.map(target => (
          <label key={target.itemId} className="flex items-center gap-1.5 min-w-0">
            <Icon src={target.icon} />
            <span className="truncate">{target.label}</span>
            <span className="flex-shrink-0">+</span>
            <Input
              type="number"
              min={0}
              value={bonus.get(target.itemId) ?? 0}
              onChange={e => onChange(target.itemId, toCount(e.target.value))}
              aria-label={t('event-shop-bonus-label', '{{name}} のドロップボーナス', { name: target.label })}
              className="h-7 w-14 px-1.5 flex-shrink-0"
            />
          </label>
        ))}
      </div>
      {unappliedLabels.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {t('event-shop-bonus-unapplied', '{{names}} はデータの更新前のため、ボーナスを反映できません。', {
            names: unappliedLabels.join('、'),
          })}
        </p>
      )}
    </div>
  )
}
