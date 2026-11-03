'use client'

import React, { useId } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import {
  bonusRaritySlots,
  type BonusCraftEssenceRow,
  type BonusRarity,
  type BonusRarityInput,
} from '../../lib/event-plan'
import type { EventBonusCraftEssence } from '../../lib/master-data/types'
import { toCount, type BonusTarget } from './DropBonusInputs'

const Icon: React.FC<{ src?: string }> = ({ src }) =>
  src ? <Image src={src} alt="" width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" /> : null

/** ☆ ごとの入力値（礼装1枚あたりの +N と所持枚数）。 */
export type RarityValues = Pick<BonusRarityInput, 'maxBonus' | 'baseBonus' | 'maxOwned' | 'baseOwned'>

export const EMPTY_RARITY_VALUES: RarityValues = { maxBonus: 0, baseBonus: 0, maxOwned: 0, baseOwned: 0 }

/** ☆ と、その ☆ に対応する通貨・その ☆ の礼装・取り込んだ礼装1枚あたりの +N（無ければ手で入れる）。 */
export interface RarityTarget {
  rarity: BonusRarity
  currency: BonusTarget
  craftEssences: EventBonusCraftEssence[]
  bonus?: { base: number; max: number }
}

const Face: React.FC<{ src?: string }> = ({ src }) =>
  src ? <Image src={src} alt="" width={32} height={32} className="w-8 h-8 object-contain flex-shrink-0 rounded" /> : null

const ceNames = (target: RarityTarget) => target.craftEssences.map(ce => ce.name).join('／') || `☆${target.rarity}`

/** 礼装の絵と名前（同じ ☆ に複数あれば並べる）。 */
const CraftEssenceLabel: React.FC<{ target: RarityTarget }> = ({ target }) => (
  <span className="flex items-center gap-1.5 min-w-0">
    <span className="flex-shrink-0">☆{target.rarity}</span>
    {target.craftEssences.map(ce => (
      <Face key={ce.id} src={ce.face} />
    ))}
    <span className="min-w-0 break-words">{ceNames(target)}</span>
  </span>
)

const CountField: React.FC<{ label: string; aria: string; value: number; suffix?: string; onChange: (n: number) => void }> = ({
  label,
  aria,
  value,
  suffix,
  onChange,
}) => (
  <label className="flex items-center gap-1.5 min-w-0">
    <span className="whitespace-nowrap">{label}</span>
    <Input
      type="number"
      min={0}
      value={value}
      onChange={e => onChange(toCount(e.target.value))}
      aria-label={aria}
      className="h-7 w-14 px-1.5 flex-shrink-0"
    />
    {suffix && <span className="flex-shrink-0">{suffix}</span>}
  </label>
)

/** データに +N が無い ☆ の、凸・無凸の礼装1枚あたりの +N の欄。 */
const BonusFields: React.FC<{
  rarity: BonusRarity
  current: RarityValues
  set: (key: keyof RarityValues) => (n: number) => void
}> = ({ rarity, current, set }) => {
  const { t } = useTranslation('events')
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      <CountField
        label={t('event-shop-ce-max-bonus', '凸 1枚あたり +')}
        aria={t('event-shop-ce-max-bonus-label', '☆{{rarity}} 凸の +N', { rarity })}
        value={current.maxBonus}
        onChange={set('maxBonus')}
      />
      <CountField
        label={t('event-shop-ce-base-bonus', '無凸 1枚あたり +')}
        aria={t('event-shop-ce-base-bonus-label', '☆{{rarity}} 無凸の +N', { rarity })}
        value={current.baseBonus}
        onChange={set('baseBonus')}
      />
    </div>
  )
}

/** ☆ 1つ分の行: 礼装の絵と名前・増え方と、凸と無凸の所持枚数の欄（+N はデータに無いときだけ欄を出す）。 */
const RarityFieldset: React.FC<{
  target: RarityTarget
  current: RarityValues
  onChange: (rarity: BonusRarity, key: keyof RarityValues, value: number) => void
}> = ({ target, current, onChange }) => {
  const { t } = useTranslation('events')
  const { rarity, currency, bonus } = target
  const set = (key: keyof RarityValues) => (n: number) => onChange(rarity, key, n)
  const unit = t('event-shop-ce-unit', '枚')
  return (
    <fieldset
      data-testid={`bonus-rarity-${rarity}`}
      className="flex flex-col gap-1.5 min-w-0 rounded-md p-2"
      style={{ border: '1px solid var(--border)' }}
    >
      <legend className="sr-only">{`☆${rarity} ${ceNames(target)}`}</legend>
      <div className="font-semibold" style={{ color: 'var(--text1)' }}>
        <CraftEssenceLabel target={target} />
      </div>
      <p className="flex flex-wrap items-center gap-x-1.5">
        <Icon src={currency.icon} />
        <span>{currency.label}</span>
        {bonus ? (
          <span className="whitespace-nowrap">
            {t('event-shop-ce-gain', '無凸 +{{base}}／凸 +{{max}}', { base: bonus.base, max: bonus.max })}
          </span>
        ) : (
          <span>{t('event-shop-ce-gain-unknown', '1ドロップにつき何個増えるかを、1枚あたりで入れてください')}</span>
        )}
      </p>
      {!bonus && <BonusFields rarity={rarity} current={current} set={set} />}
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        <CountField
          label={t('event-shop-ce-max-owned', '凸の所持枚数')}
          aria={t('event-shop-ce-max-owned-label', '☆{{rarity}} 凸の所持枚数', { rarity })}
          value={current.maxOwned}
          suffix={unit}
          onChange={set('maxOwned')}
        />
        <CountField
          label={t('event-shop-ce-base-owned', '無凸の所持枚数')}
          aria={t('event-shop-ce-base-owned-label', '☆{{rarity}} 無凸の所持枚数', { rarity })}
          value={current.baseOwned}
          suffix={unit}
          onChange={set('baseOwned')}
        />
      </div>
    </fieldset>
  )
}

/** フレンドの礼装を、礼装の絵と名前（または「なし」）で1つ選ぶ欄。選んだ値は ☆ として返す。 */
const FriendPicker: React.FC<{
  targets: RarityTarget[]
  friendRarity: BonusRarity | null
  onFriendChange: (rarity: BonusRarity | null) => void
}> = ({ targets, friendRarity, onFriendChange }) => {
  const { t } = useTranslation('events')
  const name = useId()
  const options: { rarity: BonusRarity | null; label: React.ReactNode; aria: string }[] = [
    { rarity: null, label: t('event-shop-ce-friend-none', 'なし'), aria: t('event-shop-ce-friend-none', 'なし') },
    ...targets.map(target => ({ rarity: target.rarity, label: <CraftEssenceLabel target={target} />, aria: ceNames(target) })),
  ]
  return (
    <fieldset className="flex flex-col gap-1.5 min-w-0">
      <legend className="mb-1.5">{t('event-shop-ce-friend', 'フレンドから借りる礼装（凸として数えます）')}</legend>
      <div role="radiogroup" aria-label={t('event-shop-ce-friend-label', 'フレンドの礼装')} className="flex flex-wrap gap-2">
        {options.map(option => {
          const checked = option.rarity === friendRarity
          return (
            <label
              key={option.rarity ?? 'none'}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 cursor-pointer min-w-0"
              style={{ border: `1px solid ${checked ? 'var(--gold)' : 'var(--border)'}` }}
            >
              <input
                type="radio"
                name={name}
                checked={checked}
                onChange={() => onFriendChange(option.rarity)}
                aria-label={option.aria}
                className="h-4 w-4 flex-shrink-0 accent-[var(--gold)]"
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/** ☆ ごとの礼装の行（所持枚数の欄）と、フレンドの礼装を選ぶ欄。 */
export const BonusRarityInputs: React.FC<{
  targets: RarityTarget[]
  values: ReadonlyMap<BonusRarity, RarityValues>
  friendRarity: BonusRarity | null
  onChange: (rarity: BonusRarity, key: keyof RarityValues, value: number) => void
  onFriendChange: (rarity: BonusRarity | null) => void
}> = ({ targets, values, friendRarity, onChange, onFriendChange }) => (
  <div className="flex flex-col gap-3 text-xs" style={{ color: 'var(--text2)' }}>
    {targets.map(target => (
      <RarityFieldset
        key={target.rarity}
        target={target}
        current={values.get(target.rarity) ?? EMPTY_RARITY_VALUES}
        onChange={onChange}
      />
    ))}
    <FriendPicker targets={targets} friendRarity={friendRarity} onFriendChange={onFriendChange} />
  </div>
)

type SlotKind = 'max' | 'base' | 'friend'

type TranslateFn = ReturnType<typeof useTranslation>['t']

/** 凸は金、フレンドは青の枠と印、無凸は細い枠だけ。 */
const slotLook = (kind: SlotKind, t: TranslateFn): { color: string; mark?: string } => {
  switch (kind) {
    case 'max':
      return { color: 'var(--gold)', mark: t('event-shop-ce-mark-max', '凸') }
    case 'friend':
      return { color: 'var(--steel)', mark: t('event-shop-ce-mark-friend', 'フ') }
    default:
      return { color: 'var(--border2)' }
  }
}

const SlotIcon: React.FC<{ src?: string; kind: SlotKind }> = ({ src, kind }) => {
  const { t } = useTranslation('events')
  const { color, mark } = slotLook(kind, t)
  return (
    <span
      aria-hidden
      className="relative inline-block w-5 h-5 flex-shrink-0 rounded-sm overflow-hidden"
      style={{ border: `${mark ? 2 : 1}px solid ${color}`, background: 'var(--panel)' }}
    >
      {src && <Image src={src} alt="" width={20} height={20} className="w-full h-full object-cover" />}
      {mark && (
        <span
          className="absolute bottom-0 right-0 text-[8px] leading-none px-px font-bold"
          style={{ background: color, color: 'var(--panel2)' }}
        >
          {mark}
        </span>
      )}
    </span>
  )
}

/** 表の ☆ のセル: 使う礼装を1枚ずつアイコンで並べ、読み上げには枚数を文字で伝える。0 枚なら「0」。 */
const RaritySlots: React.FC<{ target: RarityTarget; slots: { max: number; base: number; friend: number } }> = ({
  target,
  slots,
}) => {
  const { t } = useTranslation('events')
  const kinds: SlotKind[] = [
    ...Array<SlotKind>(slots.max).fill('max'),
    ...Array<SlotKind>(slots.base).fill('base'),
    ...Array<SlotKind>(slots.friend).fill('friend'),
  ]
  if (kinds.length === 0) return <>0</>
  const parts = [
    slots.max > 0 && t('event-shop-ce-slots-max', '凸{{count}}枚', { count: slots.max }),
    slots.base > 0 && t('event-shop-ce-slots-base', '無凸{{count}}枚', { count: slots.base }),
    slots.friend > 0 && t('event-shop-ce-slots-friend', 'フレンド{{count}}枚', { count: slots.friend }),
  ].filter(Boolean)
  // shortcut: 同じ ☆ に礼装が複数あるときは最初の礼装の絵を出す。どの礼装を使うかを分けて数えるようになったら直す。
  const face = target.craftEssences[0]?.face
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {kinds.map((kind, i) => (
        <SlotIcon key={i} src={face} kind={kind} />
      ))}
      <span className="sr-only">{`☆${target.rarity} ${parts.join('・')}`}</span>
    </span>
  )
}

/** アイコンの印の凡例。フレンドの印はフレンドの礼装を選んでいるときだけ出す。 */
const SlotLegend: React.FC<{ face?: string; withFriend: boolean }> = ({ face, withFriend }) => {
  const { t } = useTranslation('events')
  const items: { kind: SlotKind; label: string }[] = [
    { kind: 'max', label: t('event-shop-ce-legend-max', '凸') },
    { kind: 'base', label: t('event-shop-ce-legend-base', '無凸') },
    ...(withFriend ? [{ kind: 'friend' as const, label: t('event-shop-ce-legend-friend', 'フレンド（凸）') }] : []),
  ]
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text2)' }} aria-hidden>
      {items.map(({ kind, label }) => (
        <span key={kind} className="inline-flex items-center gap-1">
          <SlotIcon src={face} kind={kind} />
          {label}
        </span>
      ))}
    </p>
  )
}

/** 合計枚数にフレンドの1枚が入っていることを、表の上に1行で書く。 */
const FriendIncludedNote: React.FC<{ friend: RarityTarget }> = ({ friend }) => {
  const { t } = useTranslation('events')
  return (
    <p className="text-xs" style={{ color: 'var(--text2)' }}>
      {t('event-shop-ce-friend-included', '合計枚数には、フレンドから借りる ☆{{rarity}} {{name}}（凸）1枚を含みます', {
        rarity: friend.rarity,
        name: ceNames(friend),
      })}
    </p>
  )
}

const TD = 'px-1.5 py-1 whitespace-nowrap tabular-nums text-right'

/** 比較の表の1行。☆ の列は使う礼装のアイコンを並べる。 */
const ComparisonRow: React.FC<{
  row: BonusCraftEssenceRow
  targets: RarityTarget[]
  values: ReadonlyMap<BonusRarity, RarityValues>
  friendRarity: BonusRarity | null
  name: string
  checked: boolean
  onSelect: (total: number) => void
}> = ({ row, targets, values, friendRarity, name, checked, onSelect }) => {
  const { t } = useTranslation('events')
  return (
    <tr style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)' }}>
      <td className="px-1.5 py-1">
        <input
          type="radio"
          name={name}
          checked={checked}
          onChange={() => onSelect(row.total)}
          aria-label={t('event-shop-ce-select-row', '合計 {{total}} 枚を使う', { total: row.total })}
          className="h-4 w-4 accent-[var(--gold)]"
        />
      </td>
      <td className={TD}>{row.total}</td>
      {targets.map(target => (
        <td key={target.rarity} className={TD}>
          <RaritySlots
            target={target}
            slots={bonusRaritySlots(
              row,
              target.rarity,
              (values.get(target.rarity) ?? EMPTY_RARITY_VALUES).maxOwned,
              friendRarity,
            )}
          />
        </td>
      ))}
      <td className={TD}>{row.laps.toLocaleString()}</td>
      <td className={TD}>{row.ap.toLocaleString()}</td>
      <td className={TD}>{row.apDrop === undefined ? '-' : row.apDrop.toLocaleString()}</td>
    </tr>
  )
}

/** 合計枚数ごとの最良の組み合わせの表。行を選ぶと、その編成で周回の内訳を求める。 */
export const BonusComparisonTable: React.FC<{
  targets: RarityTarget[]
  values: ReadonlyMap<BonusRarity, RarityValues>
  friendRarity: BonusRarity | null
  rows: BonusCraftEssenceRow[]
  selectedTotal: number | undefined
  onSelect: (total: number) => void
}> = ({ targets, values, friendRarity, rows, selectedTotal, onSelect }) => {
  const { t } = useTranslation('events')
  const name = useId()
  const friend = targets.find(target => target.rarity === friendRarity)
  const th ='font-medium px-1.5 py-1 whitespace-nowrap'
  return (
    <div className="flex flex-col gap-1.5">
      {friend && <FriendIncludedNote friend={friend} />}
      <SlotLegend face={(friend ?? targets[0])?.craftEssences[0]?.face} withFriend={!!friend} />
      <div data-testid="bonus-comparison" className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: 'var(--text3)' }}>
              <th className={`${th} text-left`}>{t('event-shop-ce-col-select', '選ぶ')}</th>
              <th className={`${th} text-right`}>{t('event-shop-ce-col-total', '合計枚数')}</th>
              {targets.map(({ rarity }) => (
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
              <ComparisonRow
                key={row.total}
                row={row}
                targets={targets}
                values={values}
                friendRarity={friendRarity}
                name={name}
                checked={row.total === selectedTotal}
                onSelect={onSelect}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
