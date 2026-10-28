'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Link } from '../common/link'
import type { EventPlannerEvent, EventShopItem } from '../../lib/master-data/types'
import {
  allocateShortfallOnly,
  clampExchangeCount,
  computeShopCurrencyNeeds,
  computeShopShortfall,
  formatEfficiency,
  groupShopByCurrency,
  orderShopByEfficiency,
  selectAllCurrenciesUpToLimit,
  shopItemStatus,
  summarizeShortfall,
  type RankedShopItem,
  type ShopCurrencyGroup,
  type ShopCurrencyNeed,
  type ShopExchangeCounts,
  type ShopItemStatus,
  type ShortfallSummary,
} from '../../lib/event-shop-summary'
import { useRosterNeed, type RosterNeed } from '../../hooks/use-roster-need'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useMaterialCatalog } from '../../hooks/use-material-catalog'
import { materialCatalogItemIds } from '../../lib/material-catalog'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { applyDropBonus, planShopCurrencies, type ShopCurrencyPlan } from '../../lib/event-plan'
import type { Result } from '../../interfaces/api'
import { computeApBudget } from '../../lib/ap-budget'
import { ApBudgetBreakdown, ApBudgetInputs, useApBudgetProfile } from './ApBudget'
import { DropBonusInputs, toCount, type BonusTarget } from './DropBonusInputs'

const Icon: React.FC<{ src?: string }> = ({ src }) =>
  src ? <Image src={src} alt="" width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" /> : null

const useCurrencyLabel = () => {
  const { t } = useTranslation('events')
  return (group: Pick<ShopCurrencyGroup, 'costItemId' | 'costName'>) =>
    group.costName || t('event-shop-currency-id', '名前不明のアイテム（ID {{id}}）', { id: group.costItemId })
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

/** 育成計画から見た品目の行の表示。育成計画が使えないときは undefined。 */
interface RowPlan {
  /** 状態なし（QP・見分けられない品目）は undefined。 */
  status?: ShopItemStatus
  wanted: boolean
  onWantedChange: (wanted: boolean) => void
  /** 交換所で埋まらない不足。 */
  remainder?: number
  /** 在庫上限が無くて回数を入れなかった「要る」の品目。 */
  promptUnlimited: boolean
}

const WantedToggle: React.FC<{ name: string; wanted: boolean; onChange: (wanted: boolean) => void }> = ({
  name,
  wanted,
  onChange,
}) => {
  const { t } = useTranslation('events')
  const option = (value: boolean, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={wanted === value}
      onClick={() => onChange(value)}
      className="h-11 min-w-11 px-2 text-[11px] font-medium whitespace-nowrap"
      style={
        wanted === value
          ? { background: 'var(--gold)', color: 'var(--bg)' }
          : { background: 'transparent', color: 'var(--text2)' }
      }
    >
      {label}
    </button>
  )
  return (
    <span
      role="radiogroup"
      aria-label={t('event-shop-wanted-label', '{{name}} は必要か', { name })}
      className="inline-flex rounded-md overflow-hidden"
      style={{ border: '1px solid var(--border)' }}
    >
      {option(true, t('event-shop-wanted', '必要'))}
      {option(false, t('event-shop-not-wanted', '不要'))}
    </span>
  )
}

const RowPlanLabel: React.FC<{ name: string; plan: RowPlan; count: number }> = ({ name, plan, count }) => {
  const { t } = useTranslation('events')
  const { status } = plan
  if (!status) return null
  return (
    <span className="flex items-center gap-x-2 gap-y-1 flex-wrap text-[11px] mt-0.5">
      {status.kind === 'short' && (
        <span style={{ color: 'var(--text1)' }}>
          {t('event-shop-status-short', 'あと {{n}} 個', { n: status.shortfall.toLocaleString() })}
        </span>
      )}
      {status.kind === 'short' && plan.remainder !== undefined && (
        <span style={{ color: 'var(--red)' }}>
          {t('event-shop-status-remainder', '交換所では {{n}} 個足りない', {
            n: plan.remainder.toLocaleString(),
          })}
        </span>
      )}
      {status.kind === 'enough' && <span>{t('event-shop-status-enough', '足りている（交換不要）')}</span>}
      {status.kind === 'unused' && <span>{t('event-shop-status-unused', '使わない')}</span>}
      {status.kind === 'outside' && (
        <>
          <span className="flex items-center gap-2 whitespace-nowrap">
            <span style={{ color: 'var(--text3)' }}>{t('event-shop-status-outside', '計画の対象外')}</span>
            <WantedToggle name={name} wanted={plan.wanted} onChange={plan.onWantedChange} />
          </span>
          {plan.wanted && plan.promptUnlimited && count === 0 && (
            <span style={{ color: 'var(--red)' }}>
              {t('event-shop-unlimited-prompt', '上限なし: 回数を入れてください')}
            </span>
          )}
        </>
      )}
    </span>
  )
}

interface ShopRowProps {
  item: EventShopItem
  /** 効率順の品目の順位と効率。AP 換算値の無い品目は undefined。 */
  ranked?: Pick<RankedShopItem, 'rank' | 'efficiency'>
  count: number
  onCountChange: (count: number) => void
  plan?: RowPlan
}

const ShopRow: React.FC<ShopRowProps> = ({ item, ranked, count, onCountChange, plan }) => {
  const { t } = useTranslation('events')
  const name = item.name || `#${item.itemId}`
  const dimmed = plan?.status?.kind === 'enough' || plan?.status?.kind === 'unused'
  return (
    <tr
      style={{ borderTop: '1px solid var(--border)', color: dimmed ? 'var(--text3)' : 'var(--text2)' }}
    >
      <td className="text-right pl-3 pr-1 py-1.5 tabular-nums" style={{ color: 'var(--text3)' }}>
        {ranked?.rank}
      </td>
      <td className="px-1 py-1.5">
        <span className="flex items-center gap-1.5">
          <Icon src={item.icon} />
          <span>{name}</span>
        </span>
        {plan && <RowPlanLabel name={name} plan={plan} count={count} />}
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
      <td className="text-right pl-1 pr-3 py-1.5 whitespace-nowrap tabular-nums" style={{ color: 'var(--text2)' }}>
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

interface CurrencyGroupCardProps {
  group: ShopCurrencyGroup
  apPrices: Readonly<Record<number, number>>
  indexOf: (item: EventShopItem) => number
  counts: ShopExchangeCounts
  planOf: (item: EventShopItem, index: number) => RowPlan | undefined
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
  Pick<CurrencyGroupCardProps, 'group' | 'apPrices' | 'indexOf' | 'counts' | 'planOf' | 'onCountChange'>
> = ({ group, apPrices, indexOf, counts, planOf, onCountChange }) => {
  const { t } = useTranslation('events')
  const { unpriced, ranked } = useMemo(() => orderShopByEfficiency(group, apPrices), [group, apPrices])
  const showLabels = unpriced.length > 0 && ranked.length > 0
  // 交換回数は交換所の配列全体の添字で品目に結び付ける（並べ替えた後の位置や通貨内の添字は使わない）。
  const row = (item: EventShopItem, rankedItem?: RankedShopItem) => {
    const index = indexOf(item)
    return (
      <ShopRow
        key={index}
        item={item}
        ranked={rankedItem}
        count={counts.get(index) ?? 0}
        onCountChange={count => onCountChange(index, count)}
        plan={planOf(item, index)}
      />
    )
  }

  // 狭い幅では表の中だけを横スクロールにし、カードの外へはみ出さない。
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="whitespace-nowrap" style={{ color: 'var(--text3)' }}>
            <th className="text-right font-medium pl-3 pr-1 py-1.5">{t('event-shop-col-rank', '#')}</th>
            <th className="text-left font-medium px-1 py-1.5">{t('event-shop-col-item', '品目')}</th>
            <th className="text-left font-medium px-1 py-1.5">{t('event-shop-col-count', '回数')}</th>
            <th className="text-right font-medium px-1 py-1.5">{t('event-shop-col-qty', '個数')}</th>
            <th className="text-right font-medium px-1 py-1.5">{t('event-shop-col-limit', '上限')}</th>
            <th className="text-right font-medium px-1 py-1.5">{t('event-shop-col-cost', '対価')}</th>
            <th className="text-right font-medium pl-1 pr-3 py-1.5">{t('event-shop-col-efficiency', 'AP/個')}</th>
          </tr>
        </thead>
        <tbody>
          {showLabels && <GroupLabelRow>{t('event-shop-group-unpriced', 'AP 換算なし')}</GroupLabelRow>}
          {unpriced.map(item => row(item))}
          {showLabels && <GroupLabelRow>{t('event-shop-group-ranked', '効率順')}</GroupLabelRow>}
          {ranked.map(r => row(r.item, r))}
        </tbody>
      </table>
    </div>
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

const FarmingPlan: React.FC<{
  plan: ShopCurrencyPlan
  groups: ShopCurrencyGroup[]
  needs: ShopCurrencyNeed[]
  bonusApplied: boolean
}> = ({ plan, groups, needs, bonusApplied }) => {
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
          {plan.result && (
            <PlanBreakdown result={plan.result} needs={needs} nameOf={nameOf} bonusApplied={bonusApplied} />
          )}
        </>
      )}
    </div>
  )
}

const PlanBreakdown: React.FC<{
  result: Result
  needs: ShopCurrencyNeed[]
  nameOf: (id: number) => string
  bonusApplied: boolean
}> = ({ result, needs, nameOf, bonusApplied }) => {
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
        {t('event-shop-plan-bonus-note', 'ドロップはイベントのボーナス（ドロップ増加礼装）を含まない統計値です。')}
        {bonusApplied &&
          t(
            'event-shop-plan-bonus-applied',
            '入れたドロップ増加礼装のボーナス（1ドロップにつき +N）を足して計算しています。',
          )}
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
        <ApBudgetBreakdown apBudget={apBudget} />
        {partial && (
          <Message>{t('event-shop-ap-budget-partial', '周回で集められる通貨の分の AP で計算しています。')}</Message>
        )}
      </div>
      <ApBudgetInputs />
    </div>
  )
}

const NO_AP_PRICES: Readonly<Record<number, number>> = {}

const formatPerRun = (value: number): string => value.toFixed(1)

type FarmingDrops = EventPlannerEvent['farmingNodes'][number]['drops']

const sumPerRun = (drops: FarmingDrops, itemId: number): number =>
  drops.reduce((acc, d) => (d.itemId === itemId ? acc + d.perRun : acc), 0)

/** クエストごとの行（ボーナス込みの値と素の値との差）。通貨もポイントも落ちないクエストは除く。 */
const perRunRows = (base: EventPlannerEvent, bonused: EventPlannerEvent, targets: BonusTarget[]) => {
  const baseDropsOf = new Map(base.farmingNodes.map(node => [node.questId, node.drops]))
  return bonused.farmingNodes.flatMap(node => {
    const baseDrops = baseDropsOf.get(node.questId) ?? []
    const cells = targets.map(target => {
      const value = sumPerRun(node.drops, target.itemId)
      return {
        itemId: target.itemId,
        has: node.drops.some(d => d.itemId === target.itemId),
        value,
        diff: value - sumPerRun(baseDrops, target.itemId),
      }
    })
    return cells.some(cell => cell.has) ? [{ node, cells }] : []
  })
}

/** クエストごとの、通貨とイベントポイントの1周の獲得量（ボーナス込み）。 */
const PerRunTable: React.FC<{
  base: EventPlannerEvent
  bonused: EventPlannerEvent
  targets: BonusTarget[]
  bonus: ReadonlyMap<number, number>
}> = ({ base, bonused, targets, bonus }) => {
  const { t } = useTranslation('events')
  const rows = perRunRows(base, bonused, targets)
  if (rows.length === 0) return null

  return (
    <div
      data-testid="shop-per-run"
      className="rounded-md flex flex-col gap-2 px-4 py-3 min-w-0"
      style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
    >
      <h3 className="text-sm font-semibold" style={{ color: 'var(--text1)' }}>
        {t('event-shop-per-run-title', '1周の獲得量')}
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: 'var(--text3)' }}>
              <th className="text-left font-medium py-1 pr-2">{t('event-shop-plan-col-quest', 'クエスト')}</th>
              {targets.map(target => (
                <th key={target.itemId} className="text-right font-medium py-1 px-1 whitespace-nowrap">
                  {target.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ node, cells }) => (
              <tr key={node.questId} style={{ borderTop: '1px solid var(--border)', color: 'var(--text2)' }}>
                <td className="py-1 pr-2">
                  {node.name}
                  <span className="ml-1" style={{ color: 'var(--text3)' }}>
                    {t('event-shop-plan-ap', 'AP{{ap}}', { ap: node.ap })}
                  </span>
                </td>
                {cells.map(cell => (
                  <td key={cell.itemId} className="text-right py-1 px-1 whitespace-nowrap tabular-nums">
                    {cell.has ? formatPerRun(cell.value) : '-'}
                    {cell.has && (bonus.get(cell.itemId) ?? 0) > 0 && cell.diff > 0 && (
                      <span className="ml-1 text-[10px]" style={{ color: 'var(--text3)' }}>
                        +{formatPerRun(cell.diff)}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const SelectAll: React.FC<{ onSelectAll: () => void }> = ({ onSelectAll }) => {
  const { t } = useTranslation('events')
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Button size="sm" variant="outline" onClick={onSelectAll}>
        {t('event-shop-select-all-currencies', '全部交換')}
      </Button>
      <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
        {t('event-shop-select-all-hint', '上限のある品目をすべて上限まで')}
      </span>
    </div>
  )
}

const SelectShortfall: React.FC<{ onSelect?: () => void }> = ({ onSelect }) => {
  const { t } = useTranslation('events')
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Button size="sm" variant="outline" onClick={onSelect} disabled={!onSelect}>
        {t('event-shop-select-shortfall', '不足素材のみ')}
      </Button>
      <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
        {t('event-shop-select-shortfall-hint', '育成計画で足りない分と、要るにした品目')}
      </span>
    </div>
  )
}

/** 育成計画の状態か、交換所で埋まる不足の要約を1行で出す。 */
const RosterLine: React.FC<{
  status: RosterNeed['status']
  summary?: ShortfallSummary
  catalogFailed: boolean
  onReloadCatalog: () => void
}> = ({ status, summary, catalogFailed, onReloadCatalog }) => {
  const { t } = useTranslation('events')
  if (status === 'empty') {
    return (
      <p className="text-xs flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: 'var(--text3)' }}>
        <span>{t('event-shop-roster-empty', '育成対象を設定すると、足りている品目と要る分が分かります。')}</span>
        <Link href="/material" className="font-semibold" style={{ color: 'var(--gold)' }}>
          {t('event-shop-roster-link', '育成対象を設定する')}
        </Link>
      </p>
    )
  }
  if (status === 'loading') return <Message>{t('event-shop-roster-loading', '育成計画を読み込み中...')}</Message>
  if (status === 'error') {
    return (
      <p className="text-xs" style={{ color: 'var(--red)' }}>
        {t('event-roster-material-error', '育成素材データの一部を取得できませんでした。時間をおいて再読み込みしてください。')}
      </p>
    )
  }
  return (
    <div data-testid="shop-shortfall-summary" className="flex flex-col items-start gap-1">
      {summary && (
        <p className="text-xs" style={{ color: 'var(--text2)' }}>
          {summary.shortMaterials > 0
            ? t('event-shop-shortfall-summary', '育成計画の不足 {{short}} 素材のうち、交換所で埋まるのは {{filled}} 素材', {
                short: summary.shortMaterials,
                filled: summary.filledMaterials,
              })
            : t('event-shop-shortfall-none', '交換所に並ぶ素材に、育成計画の不足はありません')}
        </p>
      )}
      {catalogFailed && (
        <p className="text-xs flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: 'var(--red)' }}>
          <span>{t('event-shop-catalog-error', '素材の一覧を読み込めず、計画の対象外の品目を見分けられません。')}</span>
          <Button size="sm" variant="outline" onClick={onReloadCatalog}>
            {t('event-shop-catalog-reload', '再読み込み')}
          </Button>
        </p>
      )}
    </div>
  )
}

interface PlanItemIds {
  /** 育成計画で扱う素材の atlasId。読み込み中・失敗なら undefined。 */
  ids?: ReadonlySet<number>
  failed: boolean
  reload: () => void
}

/** 素材カタログを読み、育成計画で扱う素材の集合を親へ渡す。育成計画が使えるときだけ置く。 */
const PlanItemIdsLoader: React.FC<{ onChange: (value: PlanItemIds | undefined) => void }> = ({ onChange }) => {
  const { catalog, failed, reload } = useMaterialCatalog()
  const ids = useMemo(() => (catalog ? materialCatalogItemIds(catalog.materials) : undefined), [catalog])
  useEffect(() => {
    onChange({ ids, failed, reload })
  }, [ids, failed, reload, onChange])
  useEffect(() => () => onChange(undefined), [onChange])
  return null
}

const NO_WANTED: Record<string, true> = {}

/**
 * 計画の対象外の品目の「要る」を、品目（atlasId）ごとに端末へ保存する。イベントをまたいで共通。
 * 「要る」だけを持ち、「要らない」に戻したらキーを消す。
 */
const useWantedItems = () => {
  const [wanted, setWanted] = useLocalStorage<Record<string, true>>(
    STORAGE_KEYS.EVENTS_SHOP_WANTED_ITEMS,
    NO_WANTED,
    { lazyWrite: true },
  )
  const wantedIds = useMemo(
    () => new Set(Object.entries(wanted).filter(([, value]) => value === true).map(([id]) => Number(id))),
    [wanted],
  )
  const setItemWanted = (itemId: number, value: boolean) =>
    setWanted(prev => {
      const rest = Object.fromEntries(Object.entries(prev).filter(([id]) => id !== String(itemId)))
      return value ? { ...rest, [String(itemId)]: true } : rest
    })
  return { wantedIds, setItemWanted }
}

/** 育成計画と実所持数から、品目の状態と不足素材のみの回数を出す。育成計画と所持数は読むだけ。 */
const useShopRosterPlan = (shop: EventShopItem[], setCounts: (counts: ShopExchangeCounts) => void) => {
  const roster = useRosterNeed()
  // 周回目標（STORAGE_KEYS.ITEMS）ではなく実所持数を使う。
  const [possession] = useLocalStorage<Record<string, number | undefined>>(
    STORAGE_KEYS.POSSESSION,
    {},
    { lazyWrite: true },
  )
  const { wantedIds, setItemWanted } = useWantedItems()
  const [planItemIds, setPlanItemIds] = useState<PlanItemIds>()
  const [unlimitedPrompt, setUnlimitedPrompt] = useState<ReadonlySet<number>>(() => new Set())

  const ready = roster.status === 'ready' ? roster : undefined
  const catalogIds = ready ? planItemIds?.ids : undefined
  const statusOf = useMemo(() => {
    if (!ready) return undefined
    const shortfall = computeShopShortfall(ready.totalNeed, possession)
    return {
      shortfall,
      of: (itemId: number) => shopItemStatus(itemId, ready.totalNeed, shortfall, catalogIds),
    }
  }, [ready, possession, catalogIds])
  const allocation = useMemo(
    () => statusOf && allocateShortfallOnly(shop, statusOf.shortfall, statusOf.of, wantedIds),
    [shop, statusOf, wantedIds],
  )
  const summary = useMemo(() => allocation && summarizeShortfall(allocation), [allocation])

  const planOf = (item: EventShopItem, index: number): RowPlan | undefined =>
    statusOf && allocation
      ? {
          status: statusOf.of(item.itemId),
          wanted: wantedIds.has(item.itemId),
          onWantedChange: value => setItemWanted(item.itemId, value),
          remainder: allocation.remainders.get(index),
          promptUnlimited: unlimitedPrompt.has(index),
        }
      : undefined

  return {
    roster,
    /** 素材カタログは育成計画が使えるときだけ読む。 */
    loader: ready ? <PlanItemIdsLoader onChange={setPlanItemIds} /> : null,
    summary,
    catalogFailed: !!ready && !!planItemIds?.failed,
    reloadCatalog: () => planItemIds?.reload(),
    planOf,
    /** 交換回数を不足素材のみの回数で置き換える。育成計画が使えないときは undefined。 */
    selectShortfall:
      allocation &&
      (() => {
        setCounts(allocation.counts)
        setUnlimitedPrompt(allocation.unlimitedWanted)
      }),
  }
}

/** 全部交換・不足素材のみのボタンと、育成計画から見た要約の1行。 */
const SelectControls: React.FC<{
  onSelectAll: () => void
  rosterPlan: ReturnType<typeof useShopRosterPlan>
}> = ({ onSelectAll, rosterPlan }) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-start gap-3">
      <SelectAll onSelectAll={onSelectAll} />
      <SelectShortfall onSelect={rosterPlan.selectShortfall} />
    </div>
    <RosterLine
      status={rosterPlan.roster.status}
      summary={rosterPlan.summary}
      catalogFailed={rosterPlan.catalogFailed}
      onReloadCatalog={rosterPlan.reloadCatalog}
    />
  </div>
)

/** ボーナスの欄に並べる通貨と、交換所の通貨に無いイベントポイントの品目。 */
const useBonusTargets = (
  event: EventPlannerEvent,
  groups: ShopCurrencyGroup[],
  pointItemId: number | undefined,
): BonusTarget[] => {
  const { t } = useTranslation('events')
  const label = useCurrencyLabel()
  const targets: BonusTarget[] = groups.map(group => ({
    itemId: group.costItemId,
    label: label(group),
    icon: group.costIcon,
  }))
  if (pointItemId !== undefined && !targets.some(target => target.itemId === pointItemId)) {
    const drop = event.farmingNodes.flatMap(n => n.drops).find(d => d.itemId === pointItemId)
    targets.push({
      itemId: pointItemId,
      label: drop?.name || t('event-shop-currency-id', '名前不明のアイテム（ID {{id}}）', { id: pointItemId }),
      icon: drop?.icon,
    })
  }
  return targets
}

/**
 * 交換所の品目を対価の通貨ごとにまとめて回数を選ばせ、通貨ごとの必要量と、それを満たす周回の内訳を出す。
 * 選んだ回数と所持数とドロップ増加礼装のボーナスは画面を開いている間だけ持つ。
 */
export const EventShopList: React.FC<{
  event: EventPlannerEvent
  apPrices?: Readonly<Record<number, number>>
  /** イベントポイントの品目の atlasId。あればボーナスの欄と1周の獲得量の列に出す。 */
  pointItemId?: number
}> = ({ event, apPrices = NO_AP_PRICES, pointItemId }) => {
  const { t } = useTranslation('events')
  const { shop } = event
  const groups = useMemo(() => groupShopByCurrency(shop), [shop])
  const [counts, setCounts] = useState<ShopExchangeCounts>(() => new Map())
  const [owned, setOwned] = useState<ReadonlyMap<number, number>>(() => new Map())
  const [bonus, setBonus] = useState<ReadonlyMap<number, number>>(() => new Map())
  const needs = useMemo(() => computeShopCurrencyNeeds(shop, counts, owned), [shop, counts, owned])
  const bonused = useMemo(() => applyDropBonus(event, new Map(bonus)), [event, bonus])
  const plan = useMemo(
    () => planShopCurrencies(bonused.event, new Map(needs.map(n => [n.costItemId, n.need]))),
    [bonused, needs],
  )
  const rosterPlan = useShopRosterPlan(shop, setCounts)

  const targets = useBonusTargets(event, groups, pointItemId)
  const unappliedLabels = bonused.unapplied.map(id => targets.find(target => target.itemId === id)?.label ?? `#${id}`)
  const bonusApplied = [...bonus.values()].some(n => n > 0)

  return (
    <div className="flex flex-col gap-4">
      {rosterPlan.loader}
      <PlanSummary plan={plan} />
      <SelectControls onSelectAll={() => setCounts(prev => selectAllCurrenciesUpToLimit(shop, prev))} rosterPlan={rosterPlan} />
      <DropBonusInputs
        targets={targets}
        bonus={bonus}
        unappliedLabels={unappliedLabels}
        description={t(
          'event-shop-bonus-description',
          '編成した礼装の 1ドロップにつき +N を入れると、1周の獲得量と周回数がボーナス込みになります',
        )}
        onChange={(itemId, value) => setBonus(prev => new Map(prev).set(itemId, value))}
      />
      <PerRunTable base={event} bonused={bonused.event} targets={targets} bonus={bonus} />
      {groups.map(group => (
        <CurrencyGroupCard
          key={group.costItemId}
          group={group}
          apPrices={apPrices}
          indexOf={item => shop.indexOf(item)}
          counts={counts}
          planOf={rosterPlan.planOf}
          need={needs.find(n => n.costItemId === group.costItemId)}
          owned={owned.get(group.costItemId) ?? 0}
          onCountChange={(index, count) => setCounts(prev => new Map(prev).set(index, count))}
          onOwnedChange={value => setOwned(prev => new Map(prev).set(group.costItemId, value))}
        />
      ))}
      <FarmingPlan plan={plan} groups={groups} needs={needs} bonusApplied={bonusApplied} />
      {plan.status === 'planned' && plan.result && plan.result.total_ap > 0 && (
        <ShopApBudget totalAp={plan.result.total_ap} partial={plan.unfarmable.length > 0} />
      )}
    </div>
  )
}
