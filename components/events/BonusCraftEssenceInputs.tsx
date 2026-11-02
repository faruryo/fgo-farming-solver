'use client'

import React, { useId } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import {
  bonusRarityCount,
  type BonusCraftEssenceRow,
  type BonusRarity,
  type BonusRarityInput,
} from '../../lib/event-plan'
import { toCount, type BonusTarget } from './DropBonusInputs'

const Icon: React.FC<{ src?: string }> = ({ src }) =>
  src ? <Image src={src} alt="" width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" /> : null

/** ☆ ごとの入力値（礼装1枚あたりの +N と所持枚数）。 */
export type RarityValues = Pick<BonusRarityInput, 'maxBonus' | 'baseBonus' | 'maxOwned' | 'baseOwned'>

export const EMPTY_RARITY_VALUES: RarityValues = { maxBonus: 0, baseBonus: 0, maxOwned: 0, baseOwned: 0 }

/** ☆ と、その ☆ に対応する通貨の表示。 */
export interface RarityTarget {
  rarity: BonusRarity
  currency: BonusTarget
}

interface RarityField {
  key: string
  label: string
  aria: string
  value: number
  with: (n: number) => RarityValues
}

/** ☆ 1つ分の欄（凸・無凸の +N と所持枚数）。 */
const RarityFieldset: React.FC<{
  target: RarityTarget
  current: RarityValues
  onChange: (rarity: BonusRarity, values: RarityValues) => void
}> = ({ target: { rarity, currency }, current, onChange }) => {
  const { t } = useTranslation('events')
  const fields: RarityField[] = [
    {
      key: 'maxBonus',
      label: t('event-shop-ce-max-bonus', '凸 +N'),
      aria: t('event-shop-ce-max-bonus-label', '☆{{rarity}} 凸の +N', { rarity }),
      value: current.maxBonus,
      with: n => ({ ...current, maxBonus: n }),
    },
    {
      key: 'baseBonus',
      label: t('event-shop-ce-base-bonus', '無凸 +N'),
      aria: t('event-shop-ce-base-bonus-label', '☆{{rarity}} 無凸の +N', { rarity }),
      value: current.baseBonus,
      with: n => ({ ...current, baseBonus: n }),
    },
    {
      key: 'maxOwned',
      label: t('event-shop-ce-max-owned', '凸 所持'),
      aria: t('event-shop-ce-max-owned-label', '☆{{rarity}} 凸の所持枚数', { rarity }),
      value: current.maxOwned,
      with: n => ({ ...current, maxOwned: n }),
    },
    {
      key: 'baseOwned',
      label: t('event-shop-ce-base-owned', '無凸 所持'),
      aria: t('event-shop-ce-base-owned-label', '☆{{rarity}} 無凸の所持枚数', { rarity }),
      value: current.baseOwned,
      with: n => ({ ...current, baseOwned: n }),
    },
  ]
  return (
    <fieldset data-testid={`bonus-rarity-${rarity}`} className="flex flex-col gap-1.5 min-w-0">
      <legend className="flex items-center gap-1.5 font-semibold" style={{ color: 'var(--text1)' }}>
        <span>☆{rarity}</span>
        <Icon src={currency.icon} />
        <span className="truncate">{currency.label}</span>
      </legend>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2">
        {fields.map(field => (
          <label key={field.key} className="flex items-center gap-1.5 min-w-0">
            <span className="whitespace-nowrap">{field.label}</span>
            <Input
              type="number"
              min={0}
              value={field.value}
              onChange={e => onChange(rarity, field.with(toCount(e.target.value)))}
              aria-label={field.aria}
              className="h-7 w-14 px-1.5 flex-shrink-0"
            />
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** ☆ ごとの凸・無凸の +N と所持枚数の欄と、フレンドの礼装の ☆ を選ぶ欄。 */
export const BonusRarityInputs: React.FC<{
  targets: RarityTarget[]
  values: ReadonlyMap<BonusRarity, RarityValues>
  friendRarity: BonusRarity | null
  onChange: (rarity: BonusRarity, values: RarityValues) => void
  onFriendChange: (rarity: BonusRarity | null) => void
}> = ({ targets, values, friendRarity, onChange, onFriendChange }) => {
  const { t } = useTranslation('events')
  return (
    <div className="flex flex-col gap-3 text-xs" style={{ color: 'var(--text2)' }}>
      {targets.map(target => (
        <RarityFieldset
          key={target.rarity}
          target={target}
          current={values.get(target.rarity) ?? EMPTY_RARITY_VALUES}
          onChange={onChange}
        />
      ))}
      <label className="flex items-center gap-2">
        <span>{t('event-shop-ce-friend', 'フレンドの礼装（凸）')}</span>
        <select
          className="c-global-dd"
          value={friendRarity ?? ''}
          onChange={e => onFriendChange(e.target.value === '' ? null : (Number(e.target.value) as BonusRarity))}
          aria-label={t('event-shop-ce-friend-label', 'フレンドの礼装')}
        >
          <option value="">{t('event-shop-ce-friend-none', 'なし')}</option>
          {targets.map(({ rarity }) => (
            <option key={rarity} value={rarity}>
              ☆{rarity}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}

/** 合計枚数ごとの最良の組み合わせの表。行を選ぶと、その編成で周回の内訳を求める。 */
export const BonusComparisonTable: React.FC<{
  rarities: BonusRarity[]
  rows: BonusCraftEssenceRow[]
  selectedTotal: number | undefined
  onSelect: (total: number) => void
}> = ({ rarities, rows, selectedTotal, onSelect }) => {
  const { t } = useTranslation('events')
  const name = useId()
  const th ='font-medium px-1.5 py-1 whitespace-nowrap'
  const td = 'px-1.5 py-1 whitespace-nowrap tabular-nums text-right'
  return (
    <div data-testid="bonus-comparison" className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: 'var(--text3)' }}>
            <th className={`${th} text-left`}>{t('event-shop-ce-col-select', '選ぶ')}</th>
            <th className={`${th} text-right`}>{t('event-shop-ce-col-total', '合計枚数')}</th>
            {rarities.map(rarity => (
              <th key={rarity} className={`${th} text-right`}>
                ☆{rarity}
              </th>
            ))}
            <th className={`${th} text-right`}>{t('event-shop-ce-col-laps', '周回数')}</th>
            <th className={`${th} text-right`}>{t('event-shop-ce-col-ap', 'AP')}</th>
            <th className={`${th} text-right`}>{t('event-shop-ce-col-ap-drop', 'AP の減り')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.total} style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)' }}>
              <td className="px-1.5 py-1">
                <input
                  type="radio"
                  name={name}
                  checked={row.total === selectedTotal}
                  onChange={() => onSelect(row.total)}
                  aria-label={t('event-shop-ce-select-row', '合計 {{total}} 枚を使う', { total: row.total })}
                  className="h-4 w-4 accent-[var(--gold)]"
                />
              </td>
              <td className={td}>{row.total}</td>
              {rarities.map(rarity => (
                <td key={rarity} className={td}>
                  {bonusRarityCount(row, rarity)}
                </td>
              ))}
              <td className={td}>{row.laps.toLocaleString()}</td>
              <td className={td}>{row.ap.toLocaleString()}</td>
              <td className={td}>{row.apDrop === undefined ? '-' : row.apDrop.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
