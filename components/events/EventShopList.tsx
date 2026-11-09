'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { Link } from '../common/link'
import { ItemWantToggle } from '../common/item-want-toggle'
import type { EventPlannerEvent, EventShopItem } from '../../lib/master-data/types'
import {
  allocateShortfallOnly,
  buildShopListRows,
  computeShopCurrencyNeeds,
  computeShopShortfall,
  countsFromItemKeys,
  countsToItemKeys,
  excludeUnwantedCounts,
  formatEfficiency,
  groupShopByCurrency,
  orderShopByEfficiency,
  pickIdTable,
  readShopSavedInputs,
  rowCountOf,
  rowLimit,
  selectAllCurrenciesUpToLimit,
  shopItemStatus,
  shopRowEntries,
  shopWantedKey,
  splitRowCount,
  summarizeShortfall,
  type ShopCurrencyGroup,
  type ShopCurrencyNeed,
  type ShopExchangeCounts,
  type ShopItemStatus,
  type ShopListRow,
  type ShopSavedInputs,
  type ShortfallSummary,
} from '../../lib/event-shop-summary'
import { useRosterNeed, type RosterNeed } from '../../hooks/use-roster-need'
import { countsOrEmpty, useLocalStorage } from '../../hooks/use-local-storage'
import { useItemWantSetting } from '../../hooks/use-item-want-setting'
import { useMaterialCatalog } from '../../hooks/use-material-catalog'
import { materialCatalogItemIds } from '../../lib/material-catalog'
import { STORAGE_KEYS, eventShopInputsKey } from '../../lib/constants/storage-keys'
import {
  applyDropBonus,
  compareBonusCraftEssences,
  planShopCurrencies,
  selectBonusCraftEssenceRow,
  type BonusCraftEssenceComparison,
  type BonusRarity,
  type ShopCurrencyPlan,
} from '../../lib/event-plan'
import type { Result } from '../../interfaces/api'
import { computeApBudget } from '../../lib/ap-budget'
import { ApBudgetBreakdown, ApBudgetInputs, useApBudgetProfile } from './ApBudget'
import { DropBonusInputs, toCount, type BonusTarget } from './DropBonusInputs'
import {
  BonusComparisonTable,
  BonusRarityInputs,
  EMPTY_RARITY_VALUES,
  type RarityTarget,
  type RarityValues,
} from './BonusCraftEssenceInputs'

const Icon: React.FC<{ src?: string }> = ({ src }) =>
  src ? <Image src={src} alt="" width={20} height={20} className="w-5 h-5 object-contain flex-shrink-0" /> : null

const useCurrencyLabel = () => {
  const { t } = useTranslation('events')
  return (group: Pick<ShopCurrencyGroup, 'costItemId' | 'costName'>) =>
    group.costName || t('event-shop-currency-id', '名前不明のアイテム（ID {{id}}）', { id: group.costItemId })
}

type CurrencyRef = Pick<ShopCurrencyGroup, 'costItemId' | 'costName' | 'costIcon'>

/** 通貨のアイコン（無ければ名前）。アイコンには通貨の名前を代替テキストに付ける。 */
const CurrencyMark: React.FC<{ currency: CurrencyRef }> = ({ currency }) => {
  const label = useCurrencyLabel()
  return currency.costIcon ? (
    <Image
      src={currency.costIcon}
      alt={label(currency)}
      title={label(currency)}
      width={16}
      height={16}
      className="w-4 h-4 object-contain flex-shrink-0"
    />
  ) : (
    <span className="whitespace-nowrap">{label(currency)}</span>
  )
}

/** 品目ごとの通貨と値（対価・在庫上限）を、通貨のアイコンまたは名前と並べる。 */
const PerCurrencyValues: React.FC<{
  items: EventShopItem[]
  valueOf: (item: EventShopItem) => string
  small?: boolean
}> = ({ items, valueOf, small = false }) => (
  <span className={`flex flex-col items-end gap-0.5 ${small ? 'text-[10px]' : ''}`}>
    {items.map((item, k) => (
      <span key={k} className="inline-flex items-center justify-end gap-1 whitespace-nowrap">
        <CurrencyMark currency={item} />
        <span>{valueOf(item)}</span>
      </span>
    ))}
  </span>
)

/** 行の在庫上限。まとめた行は合計と通貨ごとの在庫上限。 */
const LimitCell: React.FC<{ row: ShopListRow }> = ({ row }) => {
  const { t } = useTranslation('events')
  const limit = rowLimit(row)
  return (
    <>
      <span>{limit > 0 ? limit.toLocaleString() : t('event-shop-unlimited', '上限なし')}</span>
      {row.items.length > 1 && (
        <span style={{ color: 'var(--text3)' }}>
          <PerCurrencyValues items={row.items} valueOf={item => item.limitNum.toLocaleString()} small />
        </span>
      )}
    </>
  )
}

/** 行の対価（通貨のアイコンまたは名前と数。まとめた行は通貨ごと）。 */
const CostCell: React.FC<{ row: ShopListRow }> = ({ row }) => (
  <PerCurrencyValues items={row.items} valueOf={item => item.costAmount.toLocaleString()} />
)

const Card: React.FC<{
  children: React.ReactNode
  className?: string
  testId?: string
  cardRef?: React.Ref<HTMLDivElement>
}> = ({ children, className = '', testId, cardRef }) => (
  <div
    ref={cardRef}
    data-testid={testId}
    className={`rounded-md flex flex-col ${className}`}
    style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
  >
    {children}
  </div>
)

const COLUMN_COUNT = 7

/** 育成計画から見た品目の行の表示。育成計画が使えないときは undefined。 */
interface RowPlan {
  /** 状態なし（QP・見分けられない品目）は undefined。 */
  status?: ShopItemStatus
  /** 在庫上限が無くて回数を入れなかった「欲しい」の計画の対象外の品目。 */
  promptUnlimited: boolean
}

/** 品目名のボタンに付ける、行の key（交換所の配列の添字の先頭）の属性。切り替えのあとのフォーカスの移し先を探す。 */
const ROW_KEY_ATTR = 'data-shop-row-key'
/** 畳んだ「いらない品目」の開閉の見出しに付ける属性。 */
const UNWANTED_SUMMARY_ATTR = 'data-shop-unwanted-summary'

/**
 * 品目名を押すと、その品目の「欲しい」と「いらない」を選べるポップアップを出す。選ぶとすぐに設定を変えて閉じる。
 * 呼び出し側へは、選んだ値とキーボードで選んだか（click の detail が 0）を渡す。
 */
const ItemWantPopover: React.FC<{
  name: string
  wanted: boolean
  rowKey: number
  onChange: (wanted: boolean, viaKeyboard: boolean) => void
}> = ({ name, wanted, rowKey, onChange }) => {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            {...{ [ROW_KEY_ATTR]: rowKey }}
            className="text-left underline decoration-dotted underline-offset-2 cursor-pointer"
            style={{ textDecorationColor: 'var(--text3)' }}
          />
        }
      >
        {name}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <ItemWantToggle
          name={name}
          wanted={wanted}
          onChange={(value, event) => {
            onChange(value, event.detail === 0)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}

const RowPlanLabel: React.FC<{ plan: RowPlan; count: number }> = ({ plan, count }) => {
  const { t } = useTranslation('events')
  const { status } = plan
  if (!status) return null
  return (
    <span className="flex items-center gap-x-2 gap-y-1 flex-wrap text-[11px] mt-0.5">
      <span className="whitespace-nowrap">
        {status.kind === 'short' && (
          <span style={{ color: 'var(--text1)' }}>
            {t('event-shop-status-short', '育成にあと {{n}} 個', { n: status.shortfall.toLocaleString() })}
          </span>
        )}
        {status.kind === 'enough' && <span>{t('event-shop-status-enough', '足りている（交換不要）')}</span>}
        {status.kind === 'unused' && <span>{t('event-shop-status-unused', '使わない')}</span>}
        {status.kind === 'outside' && (
          <span style={{ color: 'var(--text3)' }}>{t('event-shop-status-outside', '計画の対象外')}</span>
        )}
      </span>
      {plan.promptUnlimited && count === 0 && (
        <span style={{ color: 'var(--red)' }}>
          {t('event-shop-unlimited-prompt', '上限なし: 回数を入れてください')}
        </span>
      )}
    </span>
  )
}

interface ShopRowProps {
  row: ShopListRow
  /** 効率順の行の順位と効率。効率の無い行は undefined。 */
  ranked?: { rank: number; efficiency: number }
  counts: ShopExchangeCounts
  onRowCountChange: (row: ShopListRow, count: number) => void
  onWantedChange: (row: ShopListRow, wanted: boolean, viaKeyboard: boolean) => void
  plan?: RowPlan
}

/** まとめた行の、回数が 1 以上の通貨ごとの回数（例: 武蔵うどん 2・江戸むすび 1）。 */
const RowBreakdown: React.FC<{
  parts: ReturnType<typeof rowCountOf>['parts']
}> = ({ parts }) => {
  const { t } = useTranslation('events')
  const label = useCurrencyLabel()
  if (parts.length === 0) return null
  return (
    <span className="block text-[11px] mt-0.5" style={{ color: 'var(--text3)' }}>
      {parts
        .map(part =>
          t('event-shop-row-breakdown-part', '{{name}} {{n}}', {
            name: label(part),
            n: part.count.toLocaleString(),
          }),
        )
        .join('・')}
    </span>
  )
}

const rowName = (item: EventShopItem): string => item.name || `#${item.itemId}`

const ShopRow: React.FC<ShopRowProps> = ({ row, ranked, counts, onRowCountChange, onWantedChange, plan }) => {
  const { t } = useTranslation('events')
  const [first] = row.items
  if (!first) return null
  const name = rowName(first)
  const { count, parts } = rowCountOf(row, counts)
  const limit = rowLimit(row)
  // 足りている・使わない行も、回数を入れたら他の行と同じ色に戻す。
  const dimmed = (plan?.status?.kind === 'enough' || plan?.status?.kind === 'unused') && count === 0
  const color = dimmed ? 'var(--text3)' : 'var(--text2)'
  return (
    <tr style={{ borderTop: '1px solid var(--border)', color }}>
      <td className="hidden sm:table-cell text-right pl-3 pr-1 py-1.5 tabular-nums" style={{ color: 'var(--text3)' }}>
        {ranked?.rank}
      </td>
      {/* 品目名が数文字ごとに折り返さないよう幅を取る。sm 未満は 375px でも横スクロールなしで収めるため、
          順位の列を隠し、アイコンを名前の上に置いて名前に幅を回す。表は残りの幅を品目名に回すので、最小幅は
          3文字分（4em）の下限に留め、他の列が広い交換所でもまず品目名の幅で吸収する。 */}
      <td className="pl-1.5 pr-0.5 sm:px-1 py-1.5 min-w-[4em] sm:min-w-[8em]">
        <span className="flex flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-1.5">
          <Icon src={first.icon} />
          <ItemWantPopover
            name={name}
            wanted
            rowKey={row.indices[0]}
            onChange={(wanted, viaKeyboard) => onWantedChange(row, wanted, viaKeyboard)}
          />
        </span>
        {row.items.length > 1 && <RowBreakdown parts={parts} />}
        {plan && <RowPlanLabel plan={plan} count={count} />}
      </td>
      <td className="px-0.5 sm:px-1 py-1.5">
        {/* 数字を周りの 12px（text-xs）に揃える。iOS Safari は 16px 未満の入力欄にフォーカスすると画面を拡大するので、
            文字は 16px のまま 3/4 に縮めて 12px に見せる。縮めても配置の大きさは変わらないため、外側の箱で見た目の
            大きさ（sm 未満 40px・sm 以上 48px × 28px）を決め、入力欄はその 4/3 倍の大きさで左上を基点に縮める。 */}
        <div className="h-7 w-10 sm:w-12">
          <Input
            type="number"
            min={0}
            {...(limit > 0 ? { max: limit } : {})}
            value={count}
            onChange={e => onRowCountChange(row, toCount(e.target.value))}
            aria-label={t('event-shop-count-label', '{{name}} の交換回数', {
              name,
            })}
            className="h-[133.333%] w-[133.333%] origin-top-left scale-75 px-1.5 text-base sm:px-2 md:text-base"
          />
        </div>
      </td>
      <td className="text-right px-0.5 sm:px-1 py-1.5 whitespace-nowrap">×{first.qty.toLocaleString()}</td>
      <td className="text-right px-0.5 sm:px-1 py-1.5">
        <LimitCell row={row} />
      </td>
      <td className="text-right px-0.5 sm:px-1 py-1.5">
        <CostCell row={row} />
      </td>
      <td className="text-right pl-0.5 pr-1.5 sm:pl-1 sm:pr-3 py-1.5 whitespace-nowrap tabular-nums" style={{ color: 'var(--text2)' }}>
        {ranked && formatEfficiency(ranked.efficiency)}
      </td>
    </tr>
  )
}

/**
 * 表の見出しの行。`group` は育成計画で分けたグループの見出しで、「効率順」「AP 換算なし」より強く出す。
 * `indented` はグループの中の「効率順」「AP 換算なし」で、1段下げる。
 */
const GroupLabelRow: React.FC<{ children: React.ReactNode; group?: boolean; indented?: boolean }> = ({
  children,
  group = false,
  indented = false,
}) => {
  const padding = indented ? 'pl-6 pr-3' : 'px-3'
  const className = group
    ? 'text-left font-semibold px-3 py-1.5 text-xs'
    : `text-left font-medium py-1 text-[11px] ${padding}`
  return (
    <tr style={{ borderTop: '1px solid var(--border)' }}>
      <th
        colSpan={COLUMN_COUNT}
        scope="colgroup"
        className={className}
        style={{ color: group ? 'var(--text1)' : 'var(--text3)', background: 'var(--panel)' }}
      >
        {children}
      </th>
    </tr>
  )
}

type RankedShopRow = ReturnType<typeof orderShopByEfficiency>['ranked'][number]

/** 表に出す行のまとまり。`kind` は育成計画で分けたグループで、グループの見出しを出すときだけ付く。 */
interface ShopRowGroup {
  kind?: 'short' | 'other'
  ranked: RankedShopRow[]
  unpriced: ShopListRow[]
}

/**
 * 効率順に並べた行を、育成計画で不足のある行（上）とそれ以外（下）に分ける。各グループの中の順と順位は分ける前のまま。
 * 育成計画が使えないときや、どちらかのグループが空のときは、1つのまとまり（グループの見出しなし）にする。
 */
const groupShopRows = (
  ranked: RankedShopRow[],
  unpriced: ShopListRow[],
  planOf: (row: ShopListRow) => RowPlan | undefined,
): ShopRowGroup[] => {
  const whole: ShopRowGroup[] = [{ ranked, unpriced }]
  if (![...ranked.map(r => r.row), ...unpriced].some(row => planOf(row) !== undefined)) return whole
  const isShort = (row: ShopListRow) => planOf(row)?.status?.kind === 'short'
  const short: ShopRowGroup = {
    kind: 'short',
    ranked: ranked.filter(r => isShort(r.row)),
    unpriced: unpriced.filter(isShort),
  }
  const other: ShopRowGroup = {
    kind: 'other',
    ranked: ranked.filter(r => !isShort(r.row)),
    unpriced: unpriced.filter(row => !isShort(row)),
  }
  const isEmpty = (g: ShopRowGroup) => g.ranked.length === 0 && g.unpriced.length === 0
  return isEmpty(short) || isEmpty(other) ? whole : [short, other]
}

/**
 * 1つのまとまりの見出しと行。グループの見出しは育成計画で分けたときだけ出し、
 * 「効率順」「AP 換算なし」はそのまとまりに効率のある行と無い行の両方があるときだけ出す。
 */
const ShopRowGroupRows: React.FC<{
  group: ShopRowGroup
  row: (shopRow: ShopListRow, rankedRow?: RankedShopRow) => React.ReactNode
}> = ({ group, row }) => {
  const { t } = useTranslation('events')
  const showLabels = group.unpriced.length > 0 && group.ranked.length > 0
  const indented = group.kind !== undefined
  return (
    <>
      {group.kind === 'short' && (
        <GroupLabelRow group>{t('event-shop-group-short', '育成に足りない品目')}</GroupLabelRow>
      )}
      {group.kind === 'other' && <GroupLabelRow group>{t('event-shop-group-other', 'そのほかの品目')}</GroupLabelRow>}
      {showLabels && <GroupLabelRow indented={indented}>{t('event-shop-group-ranked', '効率順')}</GroupLabelRow>}
      {group.ranked.map(r => row(r.row, r))}
      {showLabels && (
        <GroupLabelRow indented={indented}>{t('event-shop-group-unpriced', 'AP 換算なし')}</GroupLabelRow>
      )}
      {group.unpriced.map(r => row(r))}
    </>
  )
}

/** 表に出ている行の順（見出しの行は数えない）。 */
const displayOrder = (groups: ShopRowGroup[]): ShopListRow[] =>
  groups.flatMap(g => [...g.ranked.map(r => r.row), ...g.unpriced])

/**
 * 表の最後に畳んだ「いらない」の品目。開くと名前だけを並べ、名前を押すと品目名と同じポップアップを出す。
 * 開閉は保存せず、開くたびに閉じた状態から始める。
 */
const UnwantedRows: React.FC<{
  rows: ShopListRow[]
  onWantedChange: (row: ShopListRow, wanted: boolean, viaKeyboard: boolean) => void
}> = ({ rows, onWantedChange }) => {
  const { t } = useTranslation('events')
  const [open, setOpen] = useState(false)
  return (
    <div data-testid="shop-unwanted-items" className="px-3 py-2 text-xs" style={{ borderTop: '1px solid var(--border)' }}>
      <button
        type="button"
        {...{ [UNWANTED_SUMMARY_ATTR]: '' }}
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
        className="min-h-6 font-medium"
        style={{ color: 'var(--text2)' }}
      >
        <span aria-hidden="true">{open ? '▾' : '▸'} </span>
        {t('event-shop-unwanted-count', 'いらない品目 {{count}} 件', { count: rows.length })}
      </button>
      {open && (
        <ul className="flex flex-wrap gap-x-4 gap-y-2 mt-2" style={{ color: 'var(--text3)' }}>
          {rows.map(row => {
            const [first] = row.items
            if (!first) return null
            return (
              <li key={row.indices[0]}>
                <ItemWantPopover
                  name={rowName(first)}
                  wanted={false}
                  rowKey={row.indices[0]}
                  onChange={(wanted, viaKeyboard) => onWantedChange(row, wanted, viaKeyboard)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/**
 * 切り替えで行が表と「いらない品目」の間を動くと、押した品目名が描き直しで消え、フォーカスが body に落ちる。
 * 行き先を押した時点の並びで決めて1回だけ持ち、行が動いた描き直しのあとに移す。
 * 「いらない」にしたときは次の行（無ければ前の行、表に行が残らなければ「いらない品目」の見出し）、
 * 「欲しい」に戻したときは戻った行の品目名へ移す。タップやクリックで選んだときは画面をスクロールしない。
 */
const useFocusAfterWantedMove = (
  rows: ShopListRow[],
  /** 表に出ている「欲しい」の行の順（見出しの行は数えない）。 */
  order: ShopListRow[],
  setRowWanted: (row: ShopListRow, wanted: boolean) => void,
) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<{
    movedKey: number
    wanted: boolean
    target: number | 'unwanted-summary'
    viaKeyboard: boolean
  } | null>(null)
  const onWantedChange = (shopRow: ShopListRow, wanted: boolean, viaKeyboard: boolean) => {
    const key = shopRow.indices[0]
    const index = order.findIndex(r => r.indices[0] === key)
    const isWanted = index >= 0
    if (wanted === isWanted) {
      pendingFocus.current = null
    } else if (wanted) {
      pendingFocus.current = { movedKey: key, wanted, target: key, viaKeyboard }
    } else {
      const neighbor = order[index + 1] ?? order[index - 1]
      pendingFocus.current = {
        movedKey: key,
        wanted,
        target: neighbor ? neighbor.indices[0] : 'unwanted-summary',
        viaKeyboard,
      }
    }
    setRowWanted(shopRow, wanted)
  }
  useEffect(() => {
    const pending = pendingFocus.current
    if (!pending) return
    // 設定の反映が遅れて行がまだ動いていなければ、動いた描き直しを待つ。
    const moved = rows.some(r => r.indices[0] === pending.movedKey) === pending.wanted
    if (!moved) return
    pendingFocus.current = null
    const selector =
      pending.target === 'unwanted-summary' ? `[${UNWANTED_SUMMARY_ATTR}]` : `[${ROW_KEY_ATTR}="${pending.target}"]`
    // 「いらない品目」の名前にも同じ key が付くので、行き先が品目の行なら表の中から探す。
    const scope = pending.target === 'unwanted-summary' ? cardRef.current : cardRef.current?.querySelector('table')
    const element = scope?.querySelector<HTMLElement>(selector)
    if (!element) return
    if (pending.viaKeyboard) element.focus()
    else element.focus({ preventScroll: true })
  }, [rows])
  return { cardRef, onWantedChange }
}

/**
 * 交換所の品目の1つの一覧。「欲しい」の行のうち、効率のある行を通貨をまたいで効率の高い順（順位つき）に、
 * その後に効率の無い行を交換所の順に並べ、「いらない」の行は表の最後に畳む。
 * 育成計画が使えるときは、不足のある行をまとめて上に、それ以外を下に並べる（順位は分ける前のまま）。
 * 交換回数は交換所の配列全体の添字で品目に結び付ける（並べ替えた後の位置は使わない）。
 */
const ShopTable: React.FC<{
  list: Pick<ShopListRows, 'wantedRows' | 'unwantedRows' | 'planOf' | 'setRowCount' | 'setRowWanted'>
  apPrices: Readonly<Record<number, number>>
  counts: ShopExchangeCounts
}> = ({ list, apPrices, counts }) => {
  const { wantedRows: rows, unwantedRows, planOf, setRowCount: onRowCountChange, setRowWanted } = list
  const { t } = useTranslation('events')
  const { ranked, unpriced } = useMemo(() => orderShopByEfficiency(rows, apPrices), [rows, apPrices])
  const groups = groupShopRows(ranked, unpriced, planOf)
  const { cardRef, onWantedChange } = useFocusAfterWantedMove(rows, displayOrder(groups), setRowWanted)
  const row = (shopRow: ShopListRow, rankedRow?: { rank: number; efficiency: number }) => (
    <ShopRow
      key={shopRow.indices[0]}
      row={shopRow}
      ranked={rankedRow}
      counts={counts}
      onRowCountChange={onRowCountChange}
      onWantedChange={onWantedChange}
      plan={planOf(shopRow)}
    />
  )

  // 狭い幅では表の中だけを横スクロールにし、カードの外へはみ出さない。
  return (
    <Card testId="shop-item-list" cardRef={cardRef}>
      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="whitespace-nowrap" style={{ color: 'var(--text3)' }}>
              <th className="hidden sm:table-cell text-right font-medium pl-3 pr-1 py-1.5">{t('event-shop-col-rank', '#')}</th>
              <th className="text-left font-medium pl-1.5 pr-0.5 sm:px-1 py-1.5">{t('event-shop-col-item', '品目')}</th>
              <th className="text-left font-medium px-0.5 sm:px-1 py-1.5">{t('event-shop-col-count', '回数')}</th>
              <th className="text-right font-medium px-0.5 sm:px-1 py-1.5">{t('event-shop-col-qty', '個数')}</th>
              <th className="text-right font-medium px-0.5 sm:px-1 py-1.5">{t('event-shop-col-limit', '上限')}</th>
              <th className="text-right font-medium px-0.5 sm:px-1 py-1.5">{t('event-shop-col-cost', '対価')}</th>
              <th className="text-right font-medium pl-0.5 pr-1.5 sm:pl-1 sm:pr-3 py-1.5">{t('event-shop-col-efficiency', 'AP/個')}</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              <ShopRowGroupRows key={group.kind ?? 'all'} group={group} row={row} />
            ))}
          </tbody>
        </table>
      </div>
      {unwantedRows.length > 0 && <UnwantedRows rows={unwantedRows} onWantedChange={onWantedChange} />}
    </Card>
  )
}

/**
 * 通貨ごとのカード（通貨は交換所に最初に現れた順）。見出しの下に所持数の入力・選んだ交換の合計・必要量の段、
 * その下に全交換の合計と上限なしの品目の数の段を出す。
 */
const CurrencyNeeds: React.FC<{
  groups: ShopCurrencyGroup[]
  needs: ShopCurrencyNeed[]
  owned: ReadonlyMap<number, number>
  onOwnedChange: (costItemId: number, owned: number) => void
}> = ({ groups, needs, owned, onOwnedChange }) => {
  const { t } = useTranslation('events')
  const label = useCurrencyLabel()
  return (
    <div data-testid="shop-currency-needs" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {groups.map(group => {
        const need = needs.find(n => n.costItemId === group.costItemId)
        return (
          <Card key={group.costItemId} className="px-4 py-3 gap-1.5 text-xs">
            <h3 className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text1)' }}>
              <Icon src={group.costIcon} />
              {label(group)}
            </h3>
            <div className="flex items-center gap-x-4 gap-y-1 flex-wrap" style={{ color: 'var(--text2)' }}>
              <label className="flex items-center gap-1.5">
                <span>{t('event-shop-owned', '所持数')}</span>
                {/* 交換回数の入力欄と同じく、16px のまま 3/4 に縮めて周りの 12px に揃える（iOS Safari の拡大を避ける）。 */}
                <span className="block h-7 w-24">
                  <Input
                    type="number"
                    min={0}
                    value={owned.get(group.costItemId) ?? 0}
                    onChange={e => onOwnedChange(group.costItemId, toCount(e.target.value))}
                    aria-label={t('event-shop-owned-label', '{{name}} の所持数', {
                      name: label(group),
                    })}
                    className="h-[133.333%] w-[133.333%] origin-top-left scale-75 px-3.5 text-base md:text-base"
                  />
                </span>
              </label>
              <span>
                {t('event-shop-selected-cost', '選んだ交換 {{cost}}', {
                  cost: (need?.selectedCost ?? 0).toLocaleString(),
                })}
              </span>
              <span className="font-semibold" style={{ color: 'var(--text1)' }}>
                {t('event-shop-need', '必要量 {{need}}', {
                  need: (need?.need ?? 0).toLocaleString(),
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap" style={{ color: 'var(--text3)' }}>
              <span>
                {t('event-shop-total', '全交換 {{total}}', {
                  total: group.totalCost.toLocaleString(),
                })}
              </span>
              {group.unlimitedCount > 0 && (
                <span>
                  {t('event-shop-unlimited-count', '＋上限なし {{count}} 品目', { count: group.unlimitedCount })}
                </span>
              )}
            </div>
          </Card>
        )
      })}
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
  const { maxAp, goldenFruitOwned, loaded } = useApBudgetProfile()
  const apBudget = useMemo(() => computeApBudget(totalAp, maxAp, goldenFruitOwned), [totalAp, maxAp, goldenFruitOwned])
  return (
    <div data-testid="shop-ap-budget" className="flex flex-col gap-4">
      <div
        className="rounded-md flex flex-col gap-2 px-4 py-3"
        style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
      >
        {loaded ? (
          <ApBudgetBreakdown apBudget={apBudget} />
        ) : (
          <div aria-busy="true">
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {partial && (
          <Message>{t('event-shop-ap-budget-partial', '周回で集められる通貨の分の AP で計算しています。')}</Message>
        )}
      </div>
      {loaded ? (
        <ApBudgetInputs />
      ) : (
        <div aria-busy="true">
          <Skeleton className="h-40 w-full" />
        </div>
      )}
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
        {t('event-shop-select-all-hint', '欲しい品目のうち、上限のある品目をすべて上限まで')}
      </span>
    </div>
  )
}

const SelectShortfall: React.FC<{ onSelect?: () => void }> = ({ onSelect }) => {
  const { t } = useTranslation('events')
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Button size="sm" variant="outline" onClick={onSelect} disabled={!onSelect}>
        {t('event-shop-select-priority', '優先素材')}
      </Button>
      <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
        {t('event-shop-select-priority-hint', '欲しい品目に、育成計画で足りない分と、計画の対象外の品目を上限まで')}
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
  switch (status) {
    case 'empty':
      return (
        <p className="text-xs flex flex-wrap items-center gap-x-2 gap-y-1" style={{ color: 'var(--text3)' }}>
          <span>{t('event-shop-roster-empty', '育成対象を設定すると、足りている品目と要る分が分かります。')}</span>
          <Link href="/material" className="font-semibold" style={{ color: 'var(--gold)' }}>
            {t('event-shop-roster-link', '育成対象を設定する')}
          </Link>
        </p>
      )
    case 'unread':
    case 'loading':
      return <Message>{t('event-shop-roster-loading', '育成計画を読み込み中...')}</Message>
    case 'error':
      return (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {t('event-roster-material-error', '育成素材データの一部を取得できませんでした。時間をおいて再読み込みしてください。')}
        </p>
      )
    case 'ready':
      break
    default: {
      const unhandled: never = status
      return unhandled
    }
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

/**
 * 育成計画と実所持数から、品目の状態と優先素材の回数を出す。育成計画と所持数は読むだけ。
 * `unwanted` は「いらない」の品目のキー（`shopWantedKey`）で、優先素材はその品目の回数を変えない。
 */
const useShopRosterPlan = (
  shop: EventShopItem[],
  updateCounts: (update: (prev: ShopExchangeCounts) => ShopExchangeCounts) => void,
  unwanted: ReadonlySet<string>,
) => {
  const roster = useRosterNeed()
  // 周回目標（STORAGE_KEYS.ITEMS）ではなく実所持数を使う。
  const [possession, , possessionLoaded] = useLocalStorage<Record<string, number | undefined>>(
    STORAGE_KEYS.POSSESSION,
    {},
    { lazyWrite: true, onGet: countsOrEmpty, repairOnGet: true },
  )
  const [planItemIds, setPlanItemIds] = useState<PlanItemIds>()
  const [unlimitedPrompt, setUnlimitedPrompt] = useState<ReadonlySet<number>>(() => new Set())

  const ready = roster.status === 'ready' ? roster : undefined
  const catalogIds = ready ? planItemIds?.ids : undefined
  const statusOf = useMemo(() => {
    if (!ready) return undefined
    const shortfall = computeShopShortfall(ready.totalNeed, possession)
    return {
      shortfall,
      of: (item: EventShopItem) => shopItemStatus(item, ready.totalNeed, shortfall, catalogIds),
    }
  }, [ready, possession, catalogIds])
  const allocation = useMemo(
    () => statusOf && allocateShortfallOnly(shop, statusOf.shortfall, statusOf.of, unwanted),
    [shop, statusOf, unwanted],
  )
  const summary = useMemo(() => allocation && summarizeShortfall(allocation), [allocation])

  const planOf = (item: EventShopItem, index: number): RowPlan | undefined =>
    statusOf && allocation
      ? {
          status: statusOf.of(item),
          promptUnlimited: unlimitedPrompt.has(index),
        }
      : undefined

  return {
    roster,
    /** 所持数・育成計画の保存値をすべて読み終えたか。 */
    loaded: possessionLoaded && roster.status !== 'unread',
    /** 素材カタログは育成計画が使えるときだけ読む。 */
    loader: ready ? <PlanItemIdsLoader onChange={setPlanItemIds} /> : null,
    summary,
    catalogFailed: !!ready && !!planItemIds?.failed,
    reloadCatalog: () => planItemIds?.reload(),
    planOf,
    /** 「欲しい」の品目の交換回数を優先素材の回数で置き換える。育成計画が使えないときは undefined。 */
    selectShortfall:
      statusOf && allocation
        ? () => {
            // 「いらない」の品目は今の回数のまま残すので、前の値に重ねる。
            updateCounts(prev => allocateShortfallOnly(shop, statusOf.shortfall, statusOf.of, unwanted, prev).counts)
            setUnlimitedPrompt(allocation.unlimitedWanted)
          }
        : undefined,
  }
}

/** 全部交換・優先素材のボタンと、育成計画から見た要約の1行。 */
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

const NO_COMPARISON: BonusCraftEssenceComparison = { rows: [], unfarmable: [] }

/**
 * ボーナス礼装の ☆ ごとの入力と比較の表の状態。☆ と対応する通貨の +N は選んだ行の編成から求め、
 * 表を出さないときは 0 にする。ほかの品目は通貨ごとの欄の値を使う。
 * 値は交換所の入力（`useShopSavedInputs`）と一緒にイベントごとに端末へ保存する。
 */
const useBonusCraftEssences = (
  event: EventPlannerEvent,
  currencyNeed: Map<number, number>,
  bonus: ReadonlyMap<number, number>,
  targets: BonusTarget[],
  saved: ShopSavedState,
) => {
  const mappings = event.bonusRarities
  const { inputs, edit, edited } = saved
  const values = useMemo(() => rarityValuesFor(mappings, inputs.rarity), [mappings, inputs.rarity])
  // 今の対応に無い ☆ の保存値は未選択として読む。
  const savedFriend = inputs.friendRarity
  const friendChoice = savedFriend === null ? null : mappings?.find(m => m.rarity === savedFriend)?.rarity
  const { selectedTotal } = inputs

  const rarityTargets: RarityTarget[] = useMemo(
    () =>
      (mappings ?? []).map(m => ({
        rarity: m.rarity,
        currency: targets.find(target => target.itemId === m.itemId) ?? { itemId: m.itemId, label: `#${m.itemId}` },
        craftEssences: m.craftEssences,
        bonus: m.bonus,
      })),
    [mappings, targets],
  )
  const mappedIds = useMemo(() => new Set((mappings ?? []).map(m => m.itemId)), [mappings])
  // 未選択のフレンドの礼装は、対応のある最も高い ☆。
  const friendRarity =
    friendChoice === undefined
      ? (mappings ?? []).reduce<BonusRarity | null>((max, m) => (max === null || m.rarity > max ? m.rarity : max), null)
      : friendChoice

  const comparison = useMemo(() => {
    if (!mappings || mappings.length === 0) return NO_COMPARISON
    const otherBonus = new Map([...bonus].filter(([id]) => !mappedIds.has(id)))
    const rarityInputs = mappings.map(m => ({ ...m, ...(values.get(m.rarity) ?? EMPTY_RARITY_VALUES) }))
    return compareBonusCraftEssences(event, currencyNeed, otherBonus, rarityInputs, friendRarity)
  }, [event, currencyNeed, bonus, mappings, mappedIds, values, friendRarity])

  const row = selectBonusCraftEssenceRow(comparison.rows, selectedTotal)
  // 選んだ合計枚数の行が無くなったら、AP が最も少ない行に付いていく状態に戻す。表が消えている間は選んだ行を残す。
  // 開いただけでは書かないよう、利用者が値を変えるまでは保存値を消さず、AP が最も少ない行を出すだけにする。
  if (edited && selectedTotal !== undefined && comparison.rows.length > 0 && row?.total !== selectedTotal) {
    edit(prev => ({ ...prev, selectedTotal: undefined }))
  }

  const effectiveBonus = useMemo(() => {
    if (row) return row.bonus
    const next = new Map(bonus)
    for (const id of mappedIds) next.set(id, 0)
    return next
  }, [row, bonus, mappedIds])

  return {
    mappings,
    rarityTargets,
    values,
    setRarityValue: (rarity: BonusRarity, key: keyof RarityValues, value: number) =>
      edit(prev => withRarityValue(prev, rarity, key, value)),
    friendRarity,
    setFriendRarity: (rarity: BonusRarity | null) => edit(prev => ({ ...prev, friendRarity: rarity })),
    comparison,
    selectedTotal: row?.total,
    selectRow: (total: number) => edit(prev => ({ ...prev, selectedTotal: total })),
    effectiveBonus,
    /** 通貨ごとの +N の欄に出す品目（☆ と対応する通貨を除く）。 */
    perItemTargets: targets.filter(target => !mappedIds.has(target.itemId)),
  }
}

/** ☆ ごとの欄・比較の表、または対応を持たないデータであることの1行。対応が空なら何も出さない。 */
const BonusCraftEssenceSection: React.FC<{
  state: ReturnType<typeof useBonusCraftEssences>
  hasNeed: boolean
  nameOf: (id: number) => string
}> = ({ state, hasNeed, nameOf }) => {
  const { t } = useTranslation('events')
  if (!state.mappings) {
    return (
      <p className="text-xs" style={{ color: 'var(--text3)' }}>
        {t('event-shop-ce-stale', 'データの更新前のため、礼装の枚数を比べられません。')}
      </p>
    )
  }
  if (state.mappings.length === 0) return null
  const { rows, unfarmable } = state.comparison
  return (
    <>
      <BonusRarityInputs
        targets={state.rarityTargets}
        values={state.values}
        friendRarity={state.friendRarity}
        onChange={state.setRarityValue}
        onFriendChange={state.setFriendRarity}
      />
      {rows.length > 0 && (
        <BonusComparisonTable
          targets={state.rarityTargets}
          values={state.values}
          friendRarity={state.friendRarity}
          rows={rows}
          selectedTotal={state.selectedTotal}
          onSelect={state.selectRow}
        />
      )}
      {rows.length > 0 && unfarmable.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--red)' }}>
          {t('event-shop-ce-unfarmable', '{{names}} は周回では集められないため、集められる通貨だけで比べています。', {
            names: unfarmable.map(nameOf).join('、'),
          })}
        </p>
      )}
      {!hasNeed && (
        <Message>
          {t('event-shop-ce-no-need', '周回で集める通貨が無いため、枚数の比較はありません。')}
        </Message>
      )}
    </>
  )
}

/** 「ドロップ増加礼装」の枠: ☆ ごとの欄・比較の表・☆ と対応しない品目の通貨ごとの欄。 */
const ShopBonusCard: React.FC<{
  state: ReturnType<typeof useBonusCraftEssences>
  bonus: ReadonlyMap<number, number>
  unappliedLabels: string[]
  hasNeed: boolean
  nameOf: (id: number) => string
  onChange: (itemId: number, value: number) => void
}> = ({ state, bonus, unappliedLabels, hasNeed, nameOf, onChange }) => {
  const { t } = useTranslation('events')
  const hasRarityInputs = !!state.mappings && state.mappings.length > 0
  return (
    <DropBonusInputs
      targets={state.perItemTargets}
      bonus={bonus}
      unappliedLabels={unappliedLabels}
      description={
        hasRarityInputs
          ? t(
              'event-shop-ce-description',
              '手持ちの礼装を入れると、枚数ごとの周回数と AP を比べ、選んだ編成で周回数を計算します',
            )
          : t(
              'event-shop-bonus-description',
              '編成した礼装の 1ドロップにつき +N を入れると、1周の獲得量と周回数がボーナス込みになります',
            )
      }
      onChange={onChange}
    >
      <BonusCraftEssenceSection state={state} hasNeed={hasNeed} nameOf={nameOf} />
    </DropBonusInputs>
  )
}

/**
 * 交換所の品目を交換所の順の1つの一覧に並べるだけの表示。回数の入力や周回の計算はしない。
 * 複数の通貨で交換できる品目は周回計算の一覧と同じ規則で1行にまとめ、在庫上限の合計と通貨ごとの在庫上限・対価を出す。
 */
export const EventShopCatalog: React.FC<{ shop: EventShopItem[] }> = ({ shop }) => {
  const { t } = useTranslation('events')
  const rows = useMemo(() => buildShopListRows(shop), [shop])
  return (
    <Card testId="shop-item-list">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="whitespace-nowrap" style={{ color: 'var(--text3)' }}>
              <th className="text-left font-medium pl-3 pr-1 py-1.5">{t('event-shop-col-item', '品目')}</th>
              <th className="text-right font-medium px-1 py-1.5">{t('event-shop-col-qty', '個数')}</th>
              <th className="text-right font-medium px-1 py-1.5">{t('event-shop-col-limit', '上限')}</th>
              <th className="text-right font-medium pl-1 pr-3 py-1.5">{t('event-shop-col-cost', '対価')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const [first] = row.items
              if (!first) return null
              return (
                <tr
                  key={row.indices[0]}
                  style={{
                    borderTop: '1px solid var(--border)',
                    color: 'var(--text2)',
                  }}
                >
                  <td className="pl-3 pr-1 py-1.5">
                    <span className="flex items-center gap-1.5">
                      <Icon src={first.icon} />
                      <span>{first.name || `#${first.itemId}`}</span>
                    </span>
                  </td>
                  <td className="text-right px-1 py-1.5 whitespace-nowrap">×{first.qty.toLocaleString()}</td>
                  <td className="text-right px-1 py-1.5">
                    <LimitCell row={row} />
                  </td>
                  <td className="text-right pl-1 pr-3 py-1.5">
                    <CostCell row={row} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

/**
 * 保存値を読み終えるまでの交換所の表示。操作の欄・品目の一覧・通貨ごとの所持数と必要量のおおよその高さを持たせ、
 * 読み終えた時のずれを小さくする。育成計画の素材の読み込み（`loader`）は待たずに置く。
 */
const ShopLoadingSkeleton: React.FC<{
  rowCount: number
  loader: React.ReactNode
}> = ({ rowCount, loader }) => (
  <div className="flex flex-col gap-4">
    {loader}
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="w-full" style={{ height: 32 + rowCount * 41 }} />
      <Skeleton className="h-24 w-full" />
    </div>
  </div>
)

const EMPTY_SHOP_INPUTS: ShopSavedInputs = { counts: {}, owned: {}, bonus: {}, rarity: {} }

/** 保存した ☆ の表から、凸・無凸の +N と所持枚数だけを取り出す（無い値は 0）。 */
const rarityValuesOf = (table: Readonly<Record<string, number>> | undefined): RarityValues => ({
  maxBonus: table?.maxBonus ?? 0,
  baseBonus: table?.baseBonus ?? 0,
  maxOwned: table?.maxOwned ?? 0,
  baseOwned: table?.baseOwned ?? 0,
})

/** ☆ ごとの入力値。データに +N がある ☆ は、保存した +N を使わずデータの値を使う。 */
const rarityValuesFor = (
  mappings: EventPlannerEvent['bonusRarities'],
  saved: ShopSavedInputs['rarity'],
): ReadonlyMap<BonusRarity, RarityValues> => {
  const byRarity = new Map(Object.entries(saved))
  return new Map(
    (mappings ?? []).map(m => {
      const v = rarityValuesOf(byRarity.get(String(m.rarity)))
      return [m.rarity, m.bonus ? { ...v, maxBonus: m.bonus.max, baseBonus: m.bonus.base } : v]
    }),
  )
}

/** ☆ の保存値のうち1つの値だけを書き換える（データに +N がある ☆ でも、変えていない +N は書かない）。 */
const withRarityValue = (
  prev: ShopSavedInputs,
  rarity: BonusRarity,
  key: keyof RarityValues,
  value: number,
): ShopSavedInputs => {
  const table = new Map(Object.entries(prev.rarity)).get(String(rarity))
  return { ...prev, rarity: { ...prev.rarity, [rarity]: { ...table, [key]: value } } }
}

/** 保存した入力と、関数形で書き込む setter と、この画面で利用者が値を変えたか。 */
interface ShopSavedState {
  inputs: ShopSavedInputs
  edit: (update: (prev: ShopSavedInputs) => ShopSavedInputs) => void
  edited: boolean
}

/** 交換所の入力をイベントごとに端末へ保存して読む。保存値との競合で入れた値が消えないよう、書き込みはすべて関数形で行う。 */
const useShopSavedInputs = (event: EventPlannerEvent, groups: ShopCurrencyGroup[], pointItemId: number | undefined) => {
  const { shop } = event
  const [inputs, setInputs, loaded] = useLocalStorage<ShopSavedInputs>(eventShopInputsKey(event.id), EMPTY_SHOP_INPUTS, {
    lazyWrite: true,
    onGet: readShopSavedInputs,
  })
  const [edited, setEdited] = useState(false)
  const edit = useCallback(
    (update: (prev: ShopSavedInputs) => ShopSavedInputs) => {
      setEdited(true)
      setInputs(update)
    },
    [setInputs],
  )
  const counts = useMemo(() => countsFromItemKeys(shop, inputs.counts), [shop, inputs.counts])
  const owned = useMemo(() => pickIdTable(inputs.owned, groups.map(g => g.costItemId)), [inputs.owned, groups])
  const bonus = useMemo(
    () => pickIdTable(inputs.bonus, [...groups.map(g => g.costItemId), ...(pointItemId === undefined ? [] : [pointItemId])]),
    [inputs.bonus, groups, pointItemId],
  )
  const updateCounts = useCallback(
    (update: (prev: ShopExchangeCounts) => ShopExchangeCounts) =>
      edit(prev => ({ ...prev, counts: countsToItemKeys(shop, update(countsFromItemKeys(shop, prev.counts))) })),
    [shop, edit],
  )
  const setOwned = (id: number, value: number) => edit(prev => ({ ...prev, owned: { ...prev.owned, [id]: value } }))
  const setBonus = (id: number, value: number) => edit(prev => ({ ...prev, bonus: { ...prev.bonus, [id]: value } }))
  const saved: ShopSavedState = { inputs, edit, edited }
  return { counts, owned, bonus, updateCounts, setOwned, setBonus, saved, loaded }
}

/**
 * 交換所の品目の一覧の行と、行ごとの育成計画の表示・回数の入れ方。
 * 行は「欲しい」の行と「いらない」の行に分ける（まとめた行は品目が同じなので最初の品目の設定を使う）。
 * まとめた行は最初の品目の表示を使う。
 * 行に入れた回数は品目ごとの回数に分け直し、ほかの行の回数は変えない。
 */
const useShopListRows = (
  shop: EventShopItem[],
  itemPlanOf: (item: EventShopItem, index: number) => RowPlan | undefined,
  updateCounts: (update: (prev: ShopExchangeCounts) => ShopExchangeCounts) => void,
  { unwanted, setWanted }: Pick<ReturnType<typeof useItemWantSetting>, 'unwanted' | 'setWanted'>,
) => {
  const rows = useMemo(() => buildShopListRows(shop), [shop])
  const { wantedRows, unwantedRows } = useMemo(() => {
    const isUnwanted = (row: ShopListRow) => row.items.some(item => unwanted.has(shopWantedKey(item)))
    return { wantedRows: rows.filter(row => !isUnwanted(row)), unwantedRows: rows.filter(isUnwanted) }
  }, [rows, unwanted])
  const planOf = (row: ShopListRow): RowPlan | undefined => {
    const plans = shopRowEntries(row).map(({ index, item }) => itemPlanOf(item, index))
    const [first] = plans
    if (!first) return undefined
    return {
      ...first,
      promptUnlimited: plans.some(p => p?.promptUnlimited),
    }
  }
  const setRowCount = (row: ShopListRow, count: number) =>
    updateCounts(prev => {
      const next = new Map(prev)
      for (const [index, n] of splitRowCount(row, count)) next.set(index, n)
      return next
    })
  /** 行の品目の設定を変える（まとめた行は品目が同じなので1つ）。 */
  const setRowWanted = (row: ShopListRow, wanted: boolean) => {
    const [first] = row.items
    if (first) setWanted(shopWantedKey(first), wanted)
  }
  return { rows, wantedRows, unwantedRows, planOf, setRowCount, setRowWanted }
}

type ShopListRows = ReturnType<typeof useShopListRows>

/**
 * 交換所の品目を1つの一覧に並べて回数を選ばせ（複数の通貨で交換できる品目は1行にまとめる）、
 * 通貨ごとの必要量と、それを満たす周回の内訳を出す。
 * 選んだ回数と所持数とドロップ増加礼装のボーナス（☆ ごとの欄・フレンドの ☆・比較の表で選んだ行を含む）は
 * イベントごとに端末へ保存する（開いただけでは書かない）。
 * 「いらない」の品目の回数は保存値に残したまま、必要量・周回・AP 予算・ボーナス礼装の比較に入れない。
 * 保存のキーがイベントで変わるため、呼び出し側はイベントごとに作り直すこと（`key={event.id}`）。
 */
export const EventShopList: React.FC<{
  event: EventPlannerEvent
  apPrices?: Readonly<Record<number, number>>
  /** イベントポイントの品目の atlasId。あればボーナスの欄と1周の獲得量の列に出す。 */
  pointItemId?: number
}> = ({ event, apPrices = NO_AP_PRICES, pointItemId }) => {
  const { shop } = event
  const groups = useMemo(() => groupShopByCurrency(shop), [shop])
  const { counts, owned, bonus, updateCounts, setOwned, setBonus, saved, loaded } = useShopSavedInputs(
    event,
    groups,
    pointItemId,
  )
  const want = useItemWantSetting()
  const { unwanted } = want
  const needs = useMemo(
    () => computeShopCurrencyNeeds(shop, excludeUnwantedCounts(shop, counts, unwanted), owned),
    [shop, counts, unwanted, owned],
  )
  const currencyNeed = useMemo(() => new Map(needs.map(n => [n.costItemId, n.need])), [needs])
  const targets = useBonusTargets(event, groups, pointItemId)
  const craftEssences = useBonusCraftEssences(event, currencyNeed, bonus, targets, saved)
  const { effectiveBonus } = craftEssences
  const bonused = useMemo(() => applyDropBonus(event, new Map(effectiveBonus)), [event, effectiveBonus])
  const plan = useMemo(() => planShopCurrencies(bonused.event, currencyNeed), [bonused, currencyNeed])
  const rosterPlan = useShopRosterPlan(shop, updateCounts, unwanted)
  const list = useShopListRows(shop, rosterPlan.planOf, updateCounts, want)

  const labelOf = (id: number) => targets.find(target => target.itemId === id)?.label ?? `#${id}`
  const bonusApplied = [...effectiveBonus.values()].some(n => n > 0)

  // 保存値を読む前の値は初期値（0・空・欲しい）なので、読み終えるまで欄も計算結果も出さない。
  if (!loaded || !rosterPlan.loaded || !want.loaded) {
    return <ShopLoadingSkeleton rowCount={list.rows.length} loader={rosterPlan.loader} />
  }

  return (
    <div className="flex flex-col gap-4">
      {rosterPlan.loader}
      <PlanSummary plan={plan} />
      <SelectControls
        onSelectAll={() => updateCounts(prev => selectAllCurrenciesUpToLimit(shop, prev, unwanted))}
        rosterPlan={rosterPlan}
      />
      <ShopTable list={list} apPrices={apPrices} counts={counts} />
      <CurrencyNeeds groups={groups} needs={needs} owned={owned} onOwnedChange={setOwned} />
      <ShopBonusCard
        state={craftEssences}
        bonus={bonus}
        unappliedLabels={bonused.unapplied.map(labelOf)}
        hasNeed={[...currencyNeed.values()].some(n => n > 0)}
        nameOf={labelOf}
        onChange={setBonus}
      />
      <PerRunTable base={event} bonused={bonused.event} targets={targets} bonus={effectiveBonus} />
      <FarmingPlan plan={plan} groups={groups} needs={needs} bonusApplied={bonusApplied} />
      {plan.status === 'planned' && plan.result && plan.result.total_ap > 0 && (
        <ShopApBudget totalAp={plan.result.total_ap} partial={plan.unfarmable.length > 0} />
      )}
    </div>
  )
}
