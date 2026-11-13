'use client'

import React, { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { ImageUp } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { EventShopItem } from '../../lib/master-data/types'
import { normalizeRemainingInput, type ShopRemaining } from '../../lib/event-shop-summary'
import type { ShopImportAnalysis } from '../../lib/shop-screenshot-import/analyze'
import type { ReviewReason } from '../../lib/shop-screenshot-import/assign'

type RemainingResult = ShopImportAnalysis['remaining'][number]
type OwnedResult = ShopImportAnalysis['owned'][number]

/** 取り込みの確定で書き換える値。残りは交換所の配列の添字、所持数は通貨の番号がキー。 */
export interface ShopImportValues {
  remaining: Map<number, number>
  owned: Map<number, number>
}

/** 確かめの画面の1行の状態。`checked` は当てはめた行の「取り込みに入れる」、`target` は品目の添字か通貨の番号。 */
interface RowState {
  checked: boolean
  target?: number
  raw: string
}

const withTarget = (state: RowState, target: number | undefined): RowState =>
  target === undefined ? { checked: state.checked, raw: state.raw } : { checked: state.checked, raw: state.raw, target }

const targetOf = (value: string): number | undefined => (value === '' ? undefined : Number(value))

/** 対象（品目か通貨）は決まっていて値だけを利用者に決めさせる「要確認」の理由。 */
const VALUE_ONLY_REASONS: ReadonlySet<ReviewReason | undefined> = new Set<ReviewReason | undefined>([
  'conflict',
  'no-remaining',
])

/**
 * 読み取った結果から確かめの画面の初めの状態を作る。当てはめた行は値を入れて取り込みに入れる。
 * 「要確認」の行は品目（所持数では通貨）を選ばせる。ただし値が画像によって食い違う行と残りを読めなかった行は、
 * 対象は決まっていて、値を利用者が選ぶか入れるまで決めない。
 */
const initialRowState = (
  result: { review: boolean; values: number[]; reason?: ReviewReason },
  target: number | undefined,
): RowState => {
  const conflict = result.values.length > 1
  const value = result.values.at(0)
  const raw = conflict || value === undefined ? '' : String(value)
  const decided = !result.review || conflict || VALUE_ONLY_REASONS.has(result.reason)
  return withTarget({ checked: true, raw }, decided ? target : undefined)
}

/** 所持数の入力を 0 以上の整数にする（小数は切り捨て）。負の数や数でない値は undefined。 */
const parseOwned = (raw: string): number | undefined => {
  if (raw.trim() === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined
}

interface DecidedEntry {
  row: number
  target: number
  value: number
}

/** 確かめの画面の入力から、取り込む値を出す。「要確認」の行は対象と値の両方が決まったときだけ入れる。 */
const decidedEntries = (
  results: readonly { review: boolean }[],
  states: readonly RowState[],
  parse: (target: number, raw: string) => number | undefined,
): DecidedEntry[] =>
  results.flatMap((result, row) => {
    const state = states.at(row)
    if (!state || state.target === undefined) return []
    if (!result.review && !state.checked) return []
    const value = parse(state.target, state.raw)
    return value === undefined ? [] : [{ row, target: state.target, value }]
  })

/** 2つ以上の行が入る対象。 */
const overlappingTargets = (entries: readonly DecidedEntry[]): Set<number> => {
  const counts = new Map<number, number>()
  for (const { target } of entries) counts.set(target, (counts.get(target) ?? 0) + 1)
  return new Set([...counts].filter(([, n]) => n > 1).map(([target]) => target))
}

/** 行が取り込みに入り、ほかの行と同じ対象に入るか。 */
const overlapsAt = (entries: readonly DecidedEntry[], overlaps: ReadonlySet<number>, row: number): boolean =>
  entries.some(e => e.row === row && overlaps.has(e.target))

const replaceAt = <T,>(list: readonly T[], index: number, value: T): T[] =>
  list.map((item, k) => (k === index ? value : item))

interface Currency {
  costItemId: number
  name: string
  icon?: string
}

const currenciesOf = (shop: readonly EventShopItem[]): Currency[] => {
  const byId = new Map<number, Currency>()
  for (const item of shop) {
    if (byId.has(item.costItemId)) continue
    const name = shop.find(it => it.costItemId === item.costItemId && it.costName)?.costName
    const icon = shop.find(it => it.costItemId === item.costItemId && it.costIcon)?.costIcon
    byId.set(item.costItemId, { costItemId: item.costItemId, name: name ?? `#${item.costItemId}`, ...(icon ? { icon } : {}) })
  }
  return [...byId.values()]
}

type CurrencyOf = (id: number) => Currency | undefined

const itemName = (item: EventShopItem): string => item.name || `#${item.itemId}`

const SmallIcon: React.FC<{ src?: string; alt: string }> = ({ src, alt }) =>
  src ? (
    <Image src={src} alt={alt} title={alt} width={20} height={20} unoptimized className="w-5 h-5 object-contain flex-shrink-0" />
  ) : null

/** 画像から切り抜いたアイコンと、当てた通貨のアイコンを並べる。 */
const IconComparison: React.FC<{ crop?: string; currency?: Currency }> = ({ crop, currency }) => {
  const { t } = useTranslation('events')
  return (
    <span className="inline-flex items-center gap-1">
      <SmallIcon src={crop} alt={t('event-shop-import-icon-crop', '画像から切り抜いたアイコン')} />
      <span aria-hidden="true">→</span>
      {currency && <SmallIcon src={currency.icon} alt={currency.name} />}
      {currency && <span>{currency.name}</span>}
    </span>
  )
}

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ color: '#d97706', background: 'rgba(217,119,6,0.12)' }}>
    {children}
  </span>
)

const useReasonText = () => {
  const { t } = useTranslation('events')
  const texts: Record<ReviewReason, string> = {
    'no-name': t('event-shop-import-reason-no-name', '名前の近い品目がありません'),
    'no-remaining': t('event-shop-import-reason-no-remaining', '残りを読めませんでした'),
    'icon-review': t('event-shop-import-reason-icon', '通貨のアイコンを見分けられませんでした'),
    'no-crop': t('event-shop-import-reason-no-crop', '通貨のアイコンを切り出せませんでした'),
    ambiguous: t('event-shop-import-reason-ambiguous', '品目を1つに絞れませんでした'),
    'exceeds-limit': t('event-shop-import-reason-exceeds-limit', '読み取った残りが在庫上限を超えています'),
    order: t('event-shop-import-reason-order', '画面の並び順と食い違っています'),
    duplicate: t('event-shop-import-reason-duplicate', '同じ画像の2つの行が同じ品目に当たりました'),
    conflict: t('event-shop-import-reason-conflict', '画像によって読み取った値が違います'),
  }
  return (reason: ReviewReason | undefined): string => (reason === undefined ? '' : new Map(Object.entries(texts)).get(reason) ?? '')
}

/** 値が画像によって食い違うときに、読み取った値から選ぶボタン。 */
const ValueChoices: React.FC<{ values: number[]; onChoose: (value: number) => void }> = ({ values, onChoose }) => {
  const { t } = useTranslation('events')
  if (values.length < 2) return null
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <span>{t('event-shop-import-read-values', '読み取った値')}</span>
      {values.map(value => (
        <Button key={value} size="xs" variant="outline" onClick={() => onChoose(value)}>
          {value.toLocaleString()}
        </Button>
      ))}
    </span>
  )
}

/** 取り込む値の入力。iOS Safari の拡大を避けるため、16px のまま 3/4 に縮めて周りの 12px に揃える。 */
const ValueInput: React.FC<{ label: string; raw: string; max?: number; onChange: (raw: string) => void }> = ({
  label,
  raw,
  max,
  onChange,
}) => (
  <span className="block h-7 w-20">
    <Input
      type="number"
      min={0}
      {...(max !== undefined ? { max } : {})}
      value={raw}
      onChange={e => onChange(e.target.value)}
      aria-label={label}
      className="h-[133.333%] w-[133.333%] origin-top-left scale-75 px-2 text-base md:text-base"
    />
  </span>
)

/** 「要確認」の行で、取り込む対象（品目か通貨）を選ぶ欄。 */
const TargetSelect: React.FC<{
  label: string
  noneLabel: string
  value?: number
  options: { value: number; label: string }[]
  onChange: (value: number | undefined) => void
}> = ({ label, noneLabel, value, options, onChange }) => (
  <select
    aria-label={label}
    value={value ?? ''}
    onChange={e => onChange(targetOf(e.target.value))}
    className="h-7 rounded border px-1 text-xs"
    style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}
  >
    <option value="">{noneLabel}</option>
    {options.map(option => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
)

const RowSurface: React.FC<{ testId: string; overlapText?: string; children: React.ReactNode }> = ({
  testId,
  overlapText,
  children,
}) => (
  <li
    data-testid={testId}
    className="flex flex-col gap-1 py-2 text-xs"
    style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)' }}
  >
    {children}
    {overlapText && <p style={{ color: 'var(--red)' }}>{overlapText}</p>}
  </li>
)

/** 残りの行の見出し: 当てはめた品目の名前・アイコン・対価の通貨・在庫上限と、要確認・アイコンでの照合の印。 */
const RemainingRowHeading: React.FC<{
  result: RemainingResult
  state: RowState
  item?: EventShopItem
  currency?: Currency
  onCheckedChange: (checked: boolean) => void
}> = ({ result, state, item, currency, onCheckedChange }) => {
  const { t } = useTranslation('events')
  const name = item ? itemName(item) : t('event-shop-import-unknown-item', '品目を選んでいません')
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!result.review && (
        <Checkbox
          checked={state.checked}
          onCheckedChange={checked => onCheckedChange(!!checked)}
          aria-label={t('event-shop-import-include', '{{name}} を取り込みに入れる', { name })}
        />
      )}
      <SmallIcon src={item?.icon} alt="" />
      <span className="font-medium" style={{ color: 'var(--text1)' }}>
        {name}
      </span>
      {currency && (
        <span className="inline-flex items-center gap-1">
          <SmallIcon src={currency.icon} alt="" />
          {currency.name}
        </span>
      )}
      {item && <span>{t('event-shop-import-limit', '上限 {{limit}}', { limit: item.limitNum.toLocaleString() })}</span>}
      {result.review && <Badge>{t('event-shop-import-needs-review', '要確認')}</Badge>}
      {result.viaIcon && !result.review && <Badge>{t('event-shop-import-via-icon', 'アイコンで照合')}</Badge>}
    </div>
  )
}

/** 「要確認」の行の、元の画像の行の切り抜きと理由。 */
const ReviewCrop: React.FC<{ result: RemainingResult }> = ({ result }) => {
  const { t } = useTranslation('events')
  const reasonText = useReasonText()
  return (
    <div className="flex flex-wrap items-center gap-2">
      {result.rowCropUrl && (
        <Image
          src={result.rowCropUrl}
          alt={t('event-shop-import-row-crop', '元の画像の行')}
          width={240}
          height={40}
          unoptimized
          className="h-auto max-w-full rounded border"
          style={{ borderColor: 'var(--border)' }}
        />
      )}
      <span>{reasonText(result.reason)}</span>
    </div>
  )
}

/** 読み取った残り。読めなかった行（理由に出す）と、値が画像によって食い違う行（値から選ばせる）は出さない。 */
const ReadRemaining: React.FC<{ values: number[] }> = ({ values }) => {
  const { t } = useTranslation('events')
  const value = values.at(0)
  if (values.length > 1 || value === undefined) return null
  return <span>{t('event-shop-import-read', '読み取った残り {{value}}', { value: value.toLocaleString() })}</span>
}

/** 「要確認」の行で選べる品目。候補が無い（名前の近い品目が無い）ときは在庫上限のあるすべての品目。 */
const candidateOptions = (result: RemainingResult, shop: readonly EventShopItem[], currencyOf: CurrencyOf) => {
  const indices = result.candidates.length > 0 ? result.candidates : shop.map((_, i) => i)
  return indices.flatMap(index => {
    const item = shop.at(index)
    if (!item || item.limitNum <= 0) return []
    const currency = currencyOf(item.costItemId)?.name ?? `#${item.costItemId}`
    return [{ value: index, label: `${itemName(item)}（${currency}）` }]
  })
}

/** 残りの1行（当てはめた行か「要確認」の行）。 */
const RemainingRow: React.FC<{
  result: RemainingResult
  state: RowState
  shop: readonly EventShopItem[]
  current: ShopRemaining
  currencyOf: CurrencyOf
  overlap: boolean
  onChange: (next: RowState) => void
}> = ({ result, state, shop, current, currencyOf, overlap, onChange }) => {
  const { t } = useTranslation('events')
  const item = state.target === undefined ? undefined : shop.at(state.target)
  const now = state.target === undefined ? undefined : current.get(state.target)
  const name = item ? itemName(item) : t('event-shop-import-unknown-item', '品目を選んでいません')
  return (
    <RowSurface
      testId="shop-import-remaining-row"
      {...(overlap ? { overlapText: t('event-shop-import-overlap-item', 'ほかの行と同じ品目に入っています') } : {})}
    >
      <RemainingRowHeading
        result={result}
        state={state}
        item={item}
        currency={item ? currencyOf(item.costItemId) : undefined}
        onCheckedChange={checked => onChange({ ...state, checked })}
      />
      {result.review && <ReviewCrop result={result} />}
      {result.viaIcon && (
        <IconComparison
          crop={result.iconCropUrl}
          currency={result.iconCurrency === undefined ? undefined : currencyOf(result.iconCurrency)}
        />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {result.review && (
          <TargetSelect
            label={t('event-shop-import-choose-item', '取り込む品目')}
            noneLabel={t('event-shop-import-no-item', '選ばない')}
            value={state.target}
            options={candidateOptions(result, shop, currencyOf)}
            onChange={target => onChange(withTarget(state, target))}
          />
        )}
        <ReadRemaining values={result.values} />
        <ValueChoices values={result.values} onChoose={value => onChange({ ...state, raw: String(value) })} />
        <span>
          {now === undefined
            ? t('event-shop-import-current-none', '今の残り なし')
            : t('event-shop-import-current', '今の残り {{value}}', { value: now.toLocaleString() })}
        </span>
        <span aria-hidden="true">→</span>
        <ValueInput
          label={t('event-shop-import-remaining-value', '{{name}} の取り込む残り', { name })}
          raw={state.raw}
          max={item?.limitNum}
          onChange={raw => onChange({ ...state, raw })}
        />
      </div>
    </RowSurface>
  )
}

/** 所持数の1行。 */
const OwnedRow: React.FC<{
  result: OwnedResult
  state: RowState
  currencies: Currency[]
  current: ReadonlyMap<number, number>
  overlap: boolean
  onChange: (next: RowState) => void
}> = ({ result, state, currencies, current, overlap, onChange }) => {
  const { t } = useTranslation('events')
  const currencyOf: CurrencyOf = id => currencies.find(c => c.costItemId === id)
  const name =
    (state.target === undefined ? undefined : currencyOf(state.target)?.name) ??
    t('event-shop-import-unknown-currency', '通貨を選んでいません')
  const matched = result.matchedCostItemId ?? (result.review ? undefined : result.costItemId)
  return (
    <RowSurface
      testId="shop-import-owned-row"
      {...(overlap ? { overlapText: t('event-shop-import-overlap-currency', 'ほかの行と同じ通貨に入っています') } : {})}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!result.review && (
          <Checkbox
            checked={state.checked}
            onCheckedChange={checked => onChange({ ...state, checked: !!checked })}
            aria-label={t('event-shop-import-include-owned', '{{name}} の所持数を取り込みに入れる', { name })}
          />
        )}
        <IconComparison crop={result.iconCropUrl} currency={matched === undefined ? undefined : currencyOf(matched)} />
        {result.review && <Badge>{t('event-shop-import-needs-review', '要確認')}</Badge>}
        {result.review && result.values.length < 2 && (
          <span>{t('event-shop-import-reason-owned', '通貨を見分けられませんでした')}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {result.review && (
          <TargetSelect
            label={t('event-shop-import-choose-currency', '取り込む通貨')}
            noneLabel={t('event-shop-import-no-currency', '選ばない')}
            value={state.target}
            options={currencies.map(c => ({ value: c.costItemId, label: c.name }))}
            onChange={target => onChange(withTarget(state, target))}
          />
        )}
        <ValueChoices values={result.values} onChoose={value => onChange({ ...state, raw: String(value) })} />
        <span>
          {t('event-shop-import-owned-current', '今の所持数 {{value}}', {
            value: (state.target === undefined ? 0 : (current.get(state.target) ?? 0)).toLocaleString(),
          })}
        </span>
        <span aria-hidden="true">→</span>
        <ValueInput
          label={t('event-shop-import-owned-value', '{{name}} の取り込む所持数', { name })}
          raw={state.raw}
          onChange={raw => onChange({ ...state, raw })}
        />
      </div>
    </RowSurface>
  )
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="flex flex-col">
    <h3 className="text-xs font-semibold" style={{ color: 'var(--text1)' }}>
      {title}
    </h3>
    <ul>{children}</ul>
  </section>
)

/** 確かめの画面の入力の状態と、そこから決まる取り込む値・重なり。 */
const useReviewState = (analysis: ShopImportAnalysis, shop: readonly EventShopItem[]) => {
  const [remainingStates, setRemainingStates] = useState<RowState[]>(() =>
    analysis.remaining.map(r => initialRowState(r, r.shopIndex)),
  )
  const [ownedStates, setOwnedStates] = useState<RowState[]>(() => analysis.owned.map(r => initialRowState(r, r.costItemId)))
  const remainingEntries = decidedEntries(analysis.remaining, remainingStates, (index, raw) => {
    const item = shop.at(index)
    // 確かめの画面で入れる残りも、品目名のポップアップと同じ規則（小数は切り捨て・在庫上限で頭打ち・負の数は不可）にする。
    return item && raw.trim() !== '' ? normalizeRemainingInput(item, Number(raw)) : undefined
  })
  const ownedEntries = decidedEntries(analysis.owned, ownedStates, (_, raw) => parseOwned(raw))
  const remainingOverlaps = overlappingTargets(remainingEntries)
  const ownedOverlaps = overlappingTargets(ownedEntries)
  return {
    remainingStates,
    ownedStates,
    setRemainingAt: (row: number, next: RowState) => setRemainingStates(prev => replaceAt(prev, row, next)),
    setOwnedAt: (row: number, next: RowState) => setOwnedStates(prev => replaceAt(prev, row, next)),
    remainingOverlapAt: (row: number) => overlapsAt(remainingEntries, remainingOverlaps, row),
    ownedOverlapAt: (row: number) => overlapsAt(ownedEntries, ownedOverlaps, row),
    hasOverlap: remainingOverlaps.size > 0 || ownedOverlaps.size > 0,
    values: (): ShopImportValues => ({
      remaining: new Map(remainingEntries.map(e => [e.target, e.value])),
      owned: new Map(ownedEntries.map(e => [e.target, e.value])),
    }),
  }
}

type ReviewState = ReturnType<typeof useReviewState>

/** 確かめの画面の残りの行の一覧。 */
const RemainingSection: React.FC<{
  results: RemainingResult[]
  review: ReviewState
  shop: readonly EventShopItem[]
  current: ShopRemaining
  currencyOf: CurrencyOf
}> = ({ results, review, shop, current, currencyOf }) => {
  const { t } = useTranslation('events')
  if (results.length === 0) return null
  return (
    <Section title={t('event-shop-import-remaining-heading', '品目の残り')}>
      {results.map((result, row) => {
        const state = review.remainingStates.at(row)
        return state ? (
          <RemainingRow
            key={row}
            result={result}
            state={state}
            shop={shop}
            current={current}
            currencyOf={currencyOf}
            overlap={review.remainingOverlapAt(row)}
            onChange={next => review.setRemainingAt(row, next)}
          />
        ) : null
      })}
    </Section>
  )
}

/** 確かめの画面の所持数の行の一覧。 */
const OwnedSection: React.FC<{
  results: OwnedResult[]
  review: ReviewState
  currencies: Currency[]
  current: ReadonlyMap<number, number>
}> = ({ results, review, currencies, current }) => {
  const { t } = useTranslation('events')
  if (results.length === 0) return null
  return (
    <Section title={t('event-shop-import-owned-heading', '通貨の所持数')}>
      {results.map((result, row) => {
        const state = review.ownedStates.at(row)
        return state ? (
          <OwnedRow
            key={row}
            result={result}
            state={state}
            currencies={currencies}
            current={current}
            overlap={review.ownedOverlapAt(row)}
            onChange={next => review.setOwnedAt(row, next)}
          />
        ) : null
      })}
    </Section>
  )
}

/** 確かめの段。当てはめた行・「要確認」の行・所持数の行を出し、重なりがあれば確定させない。 */
const ReviewStage: React.FC<{
  analysis: ShopImportAnalysis
  shop: readonly EventShopItem[]
  remaining: ShopRemaining
  owned: ReadonlyMap<number, number>
  onCancel: () => void
  onConfirm: (values: ShopImportValues) => void
}> = ({ analysis, shop, remaining, owned, onCancel, onConfirm }) => {
  const { t } = useTranslation('events')
  const currencies = useMemo(() => currenciesOf(shop), [shop])
  const currencyOf: CurrencyOf = id => currencies.find(c => c.costItemId === id)
  const review = useReviewState(analysis, shop)
  const failed = analysis.failedIcons.map(id => currencyOf(id)?.name ?? `#${id}`)
  const empty = analysis.remaining.length === 0 && analysis.owned.length === 0
  return (
    <div className="flex flex-col gap-3">
      {failed.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {t('event-shop-import-icon-failed', '{{names}} のアイコンを読み込めなかったため、アイコンで見分ける行と所持数を要確認にしました', {
            names: failed.join('、'),
          })}
        </p>
      )}
      {empty && (
        <p className="text-sm py-6 text-center" style={{ color: 'var(--text2)' }}>
          {t('event-shop-import-empty', '読み取れた行がありません')}
        </p>
      )}
      <RemainingSection results={analysis.remaining} review={review} shop={shop} current={remaining} currencyOf={currencyOf} />
      <OwnedSection results={analysis.owned} review={review} currencies={currencies} current={owned} />
      {review.hasOverlap && (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {t('event-shop-import-overlap', '2つ以上の行が同じ品目か同じ通貨に入っているため、確定できません')}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t('event-shop-import-cancel', 'キャンセル')}
        </Button>
        <Button disabled={review.hasOverlap} onClick={() => onConfirm(review.values())}>
          {t('event-shop-import-confirm', '取り込む')}
        </Button>
      </DialogFooter>
    </div>
  )
}

/** 画像を選ぶ欄（所持数の画面の取り込みと同じ作り）。 */
const FileDropZone: React.FC<{ onAdd: (files: FileList | File[]) => void }> = ({ onAdd }) => {
  const { t } = useTranslation('events')
  return (
    <div
      className="border border-dashed rounded-lg p-6 text-center text-sm"
      style={{ borderColor: 'var(--border)', color: 'var(--text2)' }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault()
        onAdd(e.dataTransfer.files)
      }}
    >
      <p className="mb-3">{t('event-shop-import-drop', 'ここに画像をドラッグ&ドロップ、または')}</p>
      <label className="inline-block">
        <span className="inline-flex items-center h-8 px-3 rounded-lg border cursor-pointer text-sm" style={{ borderColor: 'var(--border)' }}>
          {t('event-shop-import-choose', '画像を選択')}
        </span>
        <input
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          data-testid="shop-import-file-input"
          onChange={e => {
            if (e.target.files) onAdd(e.target.files)
            e.target.value = ''
          }}
        />
      </label>
    </div>
  )
}

/** 画像を選ぶ段。画像でないファイルは除いて知らせる。 */
const UploadStage: React.FC<{
  files: File[]
  skippedNames: string[]
  error: string | null
  onAdd: (files: FileList | File[]) => void
  onCancel: () => void
  onAnalyze: () => void
}> = ({ files, skippedNames, error, onAdd, onCancel, onAnalyze }) => {
  const { t } = useTranslation('events')
  return (
    <div className="flex flex-col gap-3">
      <FileDropZone onAdd={onAdd} />
      {files.length > 0 && (
        <ul className="text-xs" style={{ color: 'var(--text2)' }}>
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`}>{f.name}</li>
          ))}
        </ul>
      )}
      {skippedNames.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {t('event-shop-import-skipped', '画像でないファイルを除きました: {{names}}', { names: skippedNames.join(', ') })}
        </p>
      )}
      {error && (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t('event-shop-import-cancel', 'キャンセル')}
        </Button>
        <Button disabled={files.length === 0} onClick={onAnalyze}>
          {t('event-shop-import-analyze', '読み取る')}
        </Button>
      </DialogFooter>
    </div>
  )
}

const AnalyzingStage: React.FC<{ current: number; total: number }> = ({ current, total }) => {
  const { t } = useTranslation('events')
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <div
        className="h-8 w-8 rounded-full border-2 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--border)', borderTopColor: 'transparent' }}
      />
      <p className="text-sm" style={{ color: 'var(--text2)' }}>
        {t('event-shop-import-progress', '読み取り中（{{current}}/{{total}}）', { current, total })}
      </p>
    </div>
  )
}

type Stage = 'upload' | 'analyzing' | 'review'

/**
 * 選ぶ・読み取る・確かめるの3段の状態。読み取りのモジュール（文字認識と通貨のアイコンの読み込み）は、
 * 画像を選んで読み取りを始めたときに動的 import するので、それまで読み込まない。
 */
const useImportFlow = (shop: EventShopItem[]) => {
  const [stage, setStage] = useState<Stage>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [skippedNames, setSkippedNames] = useState<string[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [analysis, setAnalysis] = useState<ShopImportAnalysis>()
  const [error, setError] = useState<string | null>(null)
  // 閉じたあとに終わった読み取りの結果を捨てるための、読み取りの回の番号
  const runRef = useRef(0)
  const reset = () => {
    runRef.current += 1
    setStage('upload')
    setFiles([])
    setSkippedNames([])
    setProgress({ current: 0, total: 0 })
    setAnalysis(undefined)
    setError(null)
  }
  const addFiles = (incoming: FileList | File[]) => {
    const all = Array.from(incoming)
    const rejected = all.filter(f => !f.type.startsWith('image/'))
    if (rejected.length > 0) setSkippedNames(prev => [...prev, ...rejected.map(f => f.name)])
    setFiles(prev => [...prev, ...all.filter(f => f.type.startsWith('image/'))])
  }
  const analyze = async () => {
    setStage('analyzing')
    setError(null)
    setProgress({ current: 0, total: files.length })
    const run = (runRef.current += 1)
    const current = () => runRef.current === run
    try {
      const { analyzeShopScreenshots } = await import('../../lib/shop-screenshot-import/analyze')
      const result = await analyzeShopScreenshots(files, shop, (done, total) => {
        if (current()) setProgress({ current: done, total })
      })
      if (!current()) return
      setAnalysis(result)
      setStage('review')
    } catch (e) {
      if (!current()) return
      setError(e instanceof Error ? e.message : String(e))
      setStage('upload')
    }
  }
  return { stage, files, skippedNames, progress, analysis, error, reset, addFiles, analyze }
}

interface ImportTargetProps {
  shop: EventShopItem[]
  remaining: ShopRemaining
  owned: ReadonlyMap<number, number>
  onConfirm: (values: ShopImportValues) => void
}

/** 選ぶ・読み取る・確かめるの3段のダイアログ。閉じると最初の段に戻す。 */
const ShopImportDialog: React.FC<ImportTargetProps & { open: boolean; onOpenChange: (open: boolean) => void }> = ({
  open,
  onOpenChange,
  shop,
  remaining,
  owned,
  onConfirm,
}) => {
  const { t } = useTranslation('events')
  const flow = useImportFlow(shop)
  const handleOpenChange = (next: boolean) => {
    if (!next) flow.reset()
    onOpenChange(next)
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto gap-5">
        <DialogHeader>
          <DialogTitle>{t('event-shop-import-title', 'スクリーンショットから残りと所持数を取り込む')}</DialogTitle>
          <DialogDescription>
            {t(
              'event-shop-import-description',
              'ゲームの交換所の画面のスクリーンショットを選ぶと、品目ごとの「残り」と「獲得したイベントアイテム」の所持数を読み取ります。画像はブラウザの中で読み取り、外へは送りません。',
            )}
          </DialogDescription>
        </DialogHeader>
        {flow.stage === 'upload' && (
          <UploadStage
            files={flow.files}
            skippedNames={flow.skippedNames}
            error={flow.error}
            onAdd={flow.addFiles}
            onCancel={() => handleOpenChange(false)}
            onAnalyze={() => void flow.analyze()}
          />
        )}
        {flow.stage === 'analyzing' && <AnalyzingStage {...flow.progress} />}
        {flow.stage === 'review' && flow.analysis && (
          <ReviewStage
            analysis={flow.analysis}
            shop={shop}
            remaining={remaining}
            owned={owned}
            onCancel={() => handleOpenChange(false)}
            onConfirm={values => {
              onConfirm(values)
              handleOpenChange(false)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * 交換所の画面のスクリーンショットから品目ごとの残りと通貨ごとの所持数を取り込む入口とダイアログ。
 * 画像はブラウザの中で読み取り、外へは送らない。確定すると、取り込みに入れた品目の残りと通貨の所持数だけを
 * `onConfirm` に渡す。確定せずに閉じたときは何も渡さない。
 */
export const ShopScreenshotImport: React.FC<ImportTargetProps> = props => {
  const { t } = useTranslation('events')
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ImageUp aria-hidden="true" />
        {t('event-shop-import-open', 'スクリーンショットから取り込む')}
      </Button>
      <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
        {t('event-shop-import-hint', 'ゲームの交換所の画面から、品目の残りと通貨の所持数を読み取る')}
      </span>
      <ShopImportDialog open={open} onOpenChange={setOpen} {...props} />
    </div>
  )
}

