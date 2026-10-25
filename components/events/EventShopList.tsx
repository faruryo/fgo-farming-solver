'use client'

import React, { useMemo, useState } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { EventPlannerEvent, EventShopItem } from '../../lib/master-data/types'
import {
  clampExchangeCount,
  computeShopCurrencyNeeds,
  currencyApThresholds,
  formatEfficiency,
  groupShopByCurrency,
  orderShopByEfficiency,
  selectAllCurrenciesUpToLimit,
  selectEfficientUpToLimit,
  type RankedShopItem,
  type ShopCurrencyGroup,
  type ShopCurrencyNeed,
  type ShopExchangeCounts,
} from '../../lib/event-shop-summary'
import { planShopCurrencies, type ShopCurrencyPlan } from '../../lib/event-plan'
import type { Result } from '../../interfaces/api'
import { computeApBudget } from '../../lib/ap-budget'
import { ApBudgetBreakdown, ApBudgetInputs, useApBudgetProfile } from './ApBudget'

const Icon: React.FC<{ src?: string }> = ({ src }) =>
  src ? <Image src={src} alt="" width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" /> : null

const toCount = (value: string): number => {
  const n = Math.floor(Number(value))
  return Number.isFinite(n) ? Math.max(0, n) : 0
}

const useCurrencyLabel = () => {
  const { t } = useTranslation('events')
  return (group: Pick<ShopCurrencyGroup, 'costItemId' | 'costName'>) =>
    group.costName || t('event-shop-currency-id', 'ID {{id}}', { id: group.costItemId })
}

const CurrencyHeader: React.FC<{ group: ShopCurrencyGroup }> = ({ group }) => {
  const { t } = useTranslation('events')
  const label = useCurrencyLabel()
  return (
    <div
      className="flex items-center justify-between gap-2 flex-wrap px-4 py-3"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text1)' }}>
        <Icon src={group.costIcon} />
        {label(group)}
      </h3>
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text2)' }}>
        <span>{t('event-shop-total', '全交換 {{total}}', { total: group.totalCost.toLocaleString() })}</span>
        {group.unlimitedCount > 0 && (
          <span style={{ color: 'var(--text3)' }}>
            {t('event-shop-unlimited-count', '＋上限なし {{count}} 品目', { count: group.unlimitedCount })}
          </span>
        )}
      </div>
    </div>
  )
}

const COLUMN_COUNT = 7

interface ShopRowProps {
  item: EventShopItem
  /** 効率順の品目の順位と効率。AP 換算値の無い品目は undefined。 */
  ranked?: Pick<RankedShopItem, 'rank' | 'efficiency'>
  /** 区切りより上の品目か。 */
  efficient?: boolean
  count: number
  onCountChange: (count: number) => void
}

const ShopRow: React.FC<ShopRowProps> = ({ item, ranked, efficient, count, onCountChange }) => {
  const { t } = useTranslation('events')
  const name = item.name || `#${item.itemId}`
  return (
    <tr
      style={{
        borderTop: '1px solid var(--border)',
        color: 'var(--text2)',
        ...(efficient ? { background: 'var(--accent)' } : {}),
      }}
    >
      <td className="text-right pl-3 pr-1 py-1.5 tabular-nums" style={{ color: 'var(--text3)' }}>
        {ranked?.rank}
      </td>
      <td className="px-1 py-1.5">
        <span className="flex items-center gap-1.5">
          <Icon src={item.icon} />
          <span>{name}</span>
        </span>
      </td>
      <td className="px-1 py-1.5">
        <Input
          type="number"
          min={0}
          {...(item.limitNum > 0 ? { max: item.limitNum } : {})}
          value={count}
          onChange={e => onCountChange(clampExchangeCount(item, toCount(e.target.value)))}
          aria-label={t('event-shop-count-label', '{{name}} の交換回数', { name })}
          className="h-7 w-12 px-1.5"
        />
      </td>
      <td className="text-right px-1 py-1.5 whitespace-nowrap">×{item.qty.toLocaleString()}</td>
      <td className="text-right px-1 py-1.5">
        {item.limitNum > 0 ? item.limitNum.toLocaleString() : t('event-shop-unlimited', '上限なし')}
      </td>
      <td className="text-right px-1 py-1.5 whitespace-nowrap">{item.costAmount.toLocaleString()}</td>
      <td
        className={`text-right pl-1 pr-3 py-1.5 whitespace-nowrap tabular-nums${efficient ? ' font-semibold' : ''}`}
        style={{ color: efficient ? 'var(--gold)' : 'var(--text3)' }}
      >
        {ranked && formatEfficiency(ranked.efficiency)}
      </td>
    </tr>
  )
}

const GroupLabelRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tr style={{ borderTop: '1px solid var(--border)' }}>
    <th
      colSpan={COLUMN_COUNT}
      scope="colgroup"
      className="text-left font-medium px-3 py-1 text-[11px]"
      style={{ color: 'var(--text3)', background: 'var(--panel)' }}
    >
      {children}
    </th>
  </tr>
)

const CutoffRow: React.FC<{ threshold: number }> = ({ threshold }) => {
  const { t } = useTranslation('events')
  return (
    <tr data-testid="shop-cutoff" style={{ borderTop: '2px solid var(--gold)' }}>
      <td colSpan={COLUMN_COUNT} className="px-3 py-1.5 text-[11px]" style={{ color: 'var(--gold)' }}>
        <span className="font-semibold">{t('event-shop-cutoff', 'ここより上は、フリークエストで集めるより交換が得')}</span>{' '}
        <span>
          {t('event-shop-cutoff-threshold', '通貨1個 ≈ {{value}} AP（イベントのクエストで集めた場合）', {
            value: formatEfficiency(threshold),
          })}
        </span>
      </td>
    </tr>
  )
}

interface CurrencyGroupCardProps {
  group: ShopCurrencyGroup
  apPrices: Readonly<Record<number, number>>
  /** その通貨1個を周回で集めるのに要る最小の AP。周回で落ちない通貨は undefined。 */
  threshold?: number
  indexOf: (item: EventShopItem) => number
  counts: ShopExchangeCounts
  need?: ShopCurrencyNeed
  owned: number
  onCountChange: (index: number, count: number) => void
  onOwnedChange: (owned: number) => void
}

const CurrencyGroupCard: React.FC<CurrencyGroupCardProps> = ({
  group,
  need,
  owned,
  onOwnedChange,
  ...tableProps
}) => (
  <div className="rounded-md flex flex-col" style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}>
    <CurrencyHeader group={group} />
    <ShopTable group={group} {...tableProps} />
    <CurrencyFooter group={group} need={need} owned={owned} onOwnedChange={onOwnedChange} />
  </div>
)

const ShopTable: React.FC<
  Pick<CurrencyGroupCardProps, 'group' | 'apPrices' | 'threshold' | 'indexOf' | 'counts' | 'onCountChange'>
> = ({ group, apPrices, threshold, indexOf, counts, onCountChange }) => {
  const { t } = useTranslation('events')
  const { unpriced, ranked, cutoff } = useMemo(
    () => orderShopByEfficiency(group, apPrices, threshold),
    [group, apPrices, threshold],
  )
  const showLabels = unpriced.length > 0 && ranked.length > 0
  // 交換回数は交換所の配列全体の添字で品目に結び付ける（並べ替えた後の位置や通貨内の添字は使わない）。
  const row = (item: EventShopItem, rankedItem?: RankedShopItem, efficient?: boolean) => {
    const index = indexOf(item)
    return (
      <ShopRow
        key={index}
        item={item}
        ranked={rankedItem}
        efficient={efficient}
        count={counts.get(index) ?? 0}
        onCountChange={count => onCountChange(index, count)}
      />
    )
  }
  const cutoffRow = threshold !== undefined && <CutoffRow key="cutoff" threshold={threshold} />

  return (
    <table className="w-full text-xs">
      <thead>
        <tr style={{ color: 'var(--text3)' }}>
          <th className="text-right font-medium pl-3 pr-1 py-1.5">{t('event-shop-col-rank', '#')}</th>
          <th className="text-left font-medium px-1 py-1.5">{t('event-shop-col-item', '品目')}</th>
          <th className="text-left font-medium px-1 py-1.5">{t('event-shop-col-count', '回数')}</th>
          <th className="text-right font-medium px-1 py-1.5">{t('event-shop-col-qty', '1回の個数')}</th>
          <th className="text-right font-medium px-1 py-1.5">{t('event-shop-col-limit', '在庫上限')}</th>
          <th className="text-right font-medium px-1 py-1.5">{t('event-shop-col-cost', '1回の対価')}</th>
          <th className="text-right font-medium pl-1 pr-3 py-1.5">{t('event-shop-col-efficiency', '通貨1個で何 AP 分')}</th>
        </tr>
      </thead>
      <tbody>
        {showLabels && <GroupLabelRow>{t('event-shop-group-unpriced', 'AP 換算なし')}</GroupLabelRow>}
        {unpriced.map(item => row(item))}
        {showLabels && <GroupLabelRow>{t('event-shop-group-ranked', '効率順')}</GroupLabelRow>}
        {ranked.map((r, i) => (
          <React.Fragment key={indexOf(r.item)}>
            {i === cutoff && cutoffRow}
            {row(r.item, r, cutoff !== undefined && i < cutoff)}
          </React.Fragment>
        ))}
        {cutoff !== undefined && cutoff === ranked.length && cutoffRow}
      </tbody>
    </table>
  )
}

const CurrencyFooter: React.FC<
  Pick<CurrencyGroupCardProps, 'group' | 'need' | 'owned' | 'onOwnedChange'>
> = ({ group, need, owned, onOwnedChange }) => {
  const { t } = useTranslation('events')
  const label = useCurrencyLabel()
  return (
    <div
      className="flex items-center justify-between gap-x-4 gap-y-2 flex-wrap px-4 py-3 text-xs"
      style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)' }}
    >
      <label className="flex items-center gap-2">
        <span>{t('event-shop-owned', '所持数')}</span>
        <Input
          type="number"
          min={0}
          value={owned}
          onChange={e => onOwnedChange(toCount(e.target.value))}
          aria-label={t('event-shop-owned-label', '{{name}} の所持数', { name: label(group) })}
          className="h-7 w-24"
        />
      </label>
      <span>
        {t('event-shop-selected-cost', '選んだ交換 {{cost}}', { cost: (need?.selectedCost ?? 0).toLocaleString() })}
      </span>
      <span className="font-semibold" style={{ color: 'var(--text1)' }}>
        {t('event-shop-need', '必要量 {{need}}', { need: (need?.need ?? 0).toLocaleString() })}
      </span>
    </div>
  )
}

const Message: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="text-xs" style={{ color: 'var(--text3)' }}>
    {children}
  </p>
)

/** 周回の内訳の合計を、交換所の上部に1行で出す。 */
const PlanSummary: React.FC<{ plan: ShopCurrencyPlan }> = ({ plan }) => {
  const { t } = useTranslation('events')
  const text = (() => {
    if (plan.status === 'none') return t('event-shop-summary-none', '周回の合計: 不要')
    if (plan.status === 'no-drops') return t('event-shop-summary-no-drops', '周回の合計: ドロップの統計なし')
    if (!plan.result) return t('event-shop-summary-unfarmable', '周回の合計: 周回で集められる通貨なし')
    const total = t('event-shop-summary-total', '周回の合計 {{laps}} 周・AP {{ap}}', {
      laps: plan.result.total_lap.toLocaleString(),
      ap: plan.result.total_ap.toLocaleString(),
    })
    return plan.unfarmable.length > 0
      ? `${total} ${t('event-shop-summary-partial', '（一部の通貨は周回で集められません）')}`
      : total
  })()
  return (
    <p
      data-testid="shop-plan-summary"
      className="text-sm font-semibold px-4 py-2 rounded-md"
      style={{ color: 'var(--text1)', background: 'var(--panel2)', border: '1px solid var(--border)' }}
    >
      {text}
    </p>
  )
}

const FarmingPlan: React.FC<{ plan: ShopCurrencyPlan; groups: ShopCurrencyGroup[]; needs: ShopCurrencyNeed[] }> = ({
  plan,
  groups,
  needs,
}) => {
  const { t } = useTranslation('events')
  const label = useCurrencyLabel()
  const nameOf = (id: number) => label(groups.find(g => g.costItemId === id) ?? { costItemId: id })

  return (
    <div
      className="rounded-md flex flex-col gap-3 px-4 py-3"
      style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text1)' }}>
        {t('event-shop-plan-title', '周回の内訳')}
      </h3>
      {plan.status === 'none' && <Message>{t('event-shop-plan-none', '周回は不要です。')}</Message>}
      {plan.status === 'no-drops' && (
        <Message>{t('event-shop-plan-no-drops', 'ドロップの統計がまだ無いため、周回を出せません。')}</Message>
      )}
      {plan.status === 'planned' && (
        <>
          {plan.unfarmable.length > 0 && (
            <p className="text-xs" style={{ color: 'var(--red)' }}>
              {t('event-shop-plan-unfarmable', '{{names}} は周回では集められません。', {
                names: plan.unfarmable.map(nameOf).join('、'),
              })}
            </p>
          )}
          {plan.result && <PlanBreakdown result={plan.result} needs={needs} nameOf={nameOf} />}
        </>
      )}
    </div>
  )
}

const PlanBreakdown: React.FC<{ result: Result; needs: ShopCurrencyNeed[]; nameOf: (id: number) => string }> = ({
  result,
  needs,
  nameOf,
}) => {
  const { t } = useTranslation('events')
  return (
    <>
      <table className="w-full text-xs">
        <thead>
          <tr style={{ color: 'var(--text3)' }}>
            <th className="text-left font-medium py-1">{t('event-shop-plan-col-quest', 'クエスト')}</th>
            <th className="text-right font-medium py-1">{t('event-shop-plan-col-laps', '周回数')}</th>
          </tr>
        </thead>
        <tbody>
          {result.quests.map(q => (
            <tr key={q.id} style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)' }}>
              <td className="py-1">
                {q.name}
                <span className="ml-1" style={{ color: 'var(--text3)' }}>
                  {t('event-shop-plan-ap', 'AP{{ap}}', { ap: q.ap })}
                </span>
              </td>
              <td className="text-right py-1 whitespace-nowrap">
                {t('event-shop-plan-laps', '{{laps}} 周', { laps: q.lap.toLocaleString() })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm font-semibold" style={{ color: 'var(--text1)' }}>
        {t('event-shop-plan-total', '合計 {{laps}} 周・AP {{ap}}', {
          laps: result.total_lap.toLocaleString(),
          ap: result.total_ap.toLocaleString(),
        })}
      </p>
      <ul className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text2)' }}>
        {result.items.map(item => (
          <li key={item.id}>
            {t('event-shop-plan-expected', '{{name}}: 見込み {{expected}}（必要量 {{need}}）', {
              name: nameOf(Number(item.id)),
              expected: item.count.toLocaleString(),
              need: (needs.find(n => String(n.costItemId) === item.id)?.need ?? 0).toLocaleString(),
            })}
          </li>
        ))}
      </ul>
      <Message>
        {t('event-shop-plan-bonus-note', 'ドロップはイベントのボーナス（礼装・サーヴァント）を含まない統計値です。')}
      </Message>
    </>
  )
}

/** 周回の合計 AP を回復するのに要る数（箱計画と同じ規則・同じ保存先の値）。 */
const ShopApBudget: React.FC<{ totalAp: number; partial: boolean }> = ({ totalAp, partial }) => {
  const { t } = useTranslation('events')
  const { maxAp, goldenFruitOwned } = useApBudgetProfile()
  const apBudget = useMemo(() => computeApBudget(totalAp, maxAp, goldenFruitOwned), [totalAp, maxAp, goldenFruitOwned])
  return (
    <div data-testid="shop-ap-budget" className="flex flex-col gap-4">
      <div
        className="rounded-md flex flex-col gap-2 px-4 py-3"
        style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
      >
        <ApBudgetBreakdown apBudget={apBudget} showRestores />
        {partial && (
          <Message>{t('event-shop-ap-budget-partial', '周回で集められる通貨の分の AP で計算しています。')}</Message>
        )}
      </div>
      <ApBudgetInputs />
    </div>
  )
}

const NO_AP_PRICES: Readonly<Record<number, number>> = {}

const BulkSelect: React.FC<{ canSelectEfficient: boolean; onSelectAll: () => void; onSelectEfficient: () => void }> = ({
  canSelectEfficient,
  onSelectAll,
  onSelectEfficient,
}) => {
  const { t } = useTranslation('events')
  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex flex-col items-start gap-0.5">
        <Button size="sm" variant="outline" onClick={onSelectAll}>
          {t('event-shop-select-all-currencies', '全部交換')}
        </Button>
        <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
          {t('event-shop-select-all-hint', '上限のある品目をすべて上限まで')}
        </span>
      </div>
      <div className="flex flex-col items-start gap-0.5">
        <Button size="sm" variant="outline" disabled={!canSelectEfficient} onClick={onSelectEfficient}>
          {t('event-shop-select-efficient', '効率の良いところまで交換')}
        </Button>
        <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
          {t('event-shop-select-efficient-hint', '線より上の品目だけ上限まで')}
        </span>
      </div>
    </div>
  )
}

/**
 * 交換所の品目を対価の通貨ごとにまとめて回数を選ばせ、通貨ごとの必要量と、それを満たす周回の内訳を出す。
 * 選んだ回数と所持数は画面を開いている間だけ持つ。
 */
export const EventShopList: React.FC<{ event: EventPlannerEvent; apPrices?: Readonly<Record<number, number>> }> = ({
  event,
  apPrices = NO_AP_PRICES,
}) => {
  const { shop } = event
  const groups = useMemo(() => groupShopByCurrency(shop), [shop])
  const thresholds = useMemo(() => currencyApThresholds(event.farmingNodes), [event.farmingNodes])
  const [counts, setCounts] = useState<ShopExchangeCounts>(() => new Map())
  const [owned, setOwned] = useState<ReadonlyMap<number, number>>(() => new Map())
  const needs = useMemo(() => computeShopCurrencyNeeds(shop, counts, owned), [shop, counts, owned])
  const plan = useMemo(
    () => planShopCurrencies(event, new Map(needs.map(n => [n.costItemId, n.need]))),
    [event, needs],
  )
  // 区切りの線がどの通貨にも無ければ、「効率の良いところまで交換」は押しても何も変わらないので無効にする。
  const hasCutoff = useMemo(
    () => groups.some(g => (orderShopByEfficiency(g, apPrices, thresholds.get(g.costItemId)).cutoff ?? 0) > 0),
    [groups, apPrices, thresholds],
  )

  return (
    <div className="flex flex-col gap-4">
      <PlanSummary plan={plan} />
      <BulkSelect
        canSelectEfficient={hasCutoff}
        onSelectAll={() => setCounts(prev => selectAllCurrenciesUpToLimit(shop, prev))}
        onSelectEfficient={() => setCounts(prev => selectEfficientUpToLimit(shop, prev, apPrices, thresholds))}
      />
      {groups.map(group => (
        <CurrencyGroupCard
          key={group.costItemId}
          group={group}
          apPrices={apPrices}
          threshold={thresholds.get(group.costItemId)}
          indexOf={item => shop.indexOf(item)}
          counts={counts}
          need={needs.find(n => n.costItemId === group.costItemId)}
          owned={owned.get(group.costItemId) ?? 0}
          onCountChange={(index, count) => setCounts(prev => new Map(prev).set(index, count))}
          onOwnedChange={value => setOwned(prev => new Map(prev).set(group.costItemId, value))}
        />
      ))}
      <FarmingPlan plan={plan} groups={groups} needs={needs} />
      {plan.status === 'planned' && plan.result && plan.result.total_ap > 0 && (
        <ShopApBudget totalAp={plan.result.total_ap} partial={plan.unfarmable.length > 0} />
      )}
    </div>
  )
}
