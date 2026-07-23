'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ImageUp } from 'lucide-react'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useStockTarget } from '../../hooks/use-stock-target'
import { EnrichedItem } from '../../lib/get-items'
import { toApiItemId } from '../../lib/to-api-item-id'
import { groupBy } from '../../utils/group-by'
import { buffer, effectiveDeficiency } from '../../lib/quest-efficiency'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StockTargetSettings } from '../common/StockTargetSettings'
import { PossessionImportDialog } from '../common/possession-import/PossessionImportDialog'
import { MaterialSelectionAdvisor } from './material-selection-advisor'

export type MaterialResultProps = {
  items: EnrichedItem[]
  locale?: string
}

// priority floor で largeCategory を決定（get-items.ts と同じロジック）
const LARGE_SECTIONS = [
  { floor: 1, label: 'スキル石',  color: '#5566aa' },  // 輝石/魔石/秘石
  { floor: 2, label: '強化素材',  color: '#7a5c34' },  // 汎用強化素材
  { floor: 3, label: 'モニュピ', color: '#9a7224' },  // ピース/モニュメント
]
// 育成と無関係なため必要数画面に表示しないアイテム(Atlas ID)。
const EXCLUDED_ITEM_IDS = new Set([7998]) // 聖杯の雫

const bgColor = (bg: string) =>
  bg === 'bronze' ? '#b06030' : bg === 'silver' ? '#6878a8' : '#9a7224'

// getItems が付与済みの category/largeCategory を、buffer
// (lib/item-rarity.ts ベース)が読む ItemLike 形にそのまま渡す。
const toStockItemLike = (item: EnrichedItem): { id: string; category: string; largeCategory: string } => ({
  id: item.id.toString(),
  category: item.category,
  largeCategory: item.largeCategory,
})

type MatCardProps = {
  item: EnrichedItem
  required: number
  owned: number | undefined
  deficiency: number
  /** 必要数+buffer 未達分(effectiveDeficiency)。stock OFF 時は deficiency と一致。 */
  stockDeficiency?: number
  rarityColor: string
  onChange: (id: string, val: number) => void
  stockEnabled?: boolean
  stockBufferAmount?: number
}

import { getItemIconUrl } from '../../lib/get-item-icon-url'

const MatCard = ({
  item,
  required,
  owned,
  deficiency,
  stockDeficiency = 0,
  rarityColor,
  onChange,
  stockEnabled,
  stockBufferAmount,
}: MatCardProps) => {
  const [editing, setEditing] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const isShort = deficiency > 0
  // 必要数は満たすが buffer 分が足りない(stock-only)。stock ON のときだけ立つ。
  const isStockShort = deficiency === 0 && stockDeficiency > 0
  const isMet = deficiency === 0 && stockDeficiency === 0 && required > 0

  useEffect(() => {
    if (editing && cardRef.current) {
      cardRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }
  }, [editing])

  return (
    <div
      ref={cardRef}
      className={`c-mat-card${isShort ? ' short' : isStockShort ? ' stock-short' : isMet ? ' met' : ''}`}
      style={{ '--rarity-color': rarityColor } as React.CSSProperties}
    >
      {isMet && <div className="c-mat-met-badge">✓</div>}
      <div className="c-mat-icon-area">
        {item.icon ? (
          <Image
            src={getItemIconUrl(item.icon)}
            alt={item.name}
            width={48}
            height={48}
            className="c-mat-icon"
          />
        ) : (
          <div className="c-mat-icon-placeholder" />
        )}
        {isShort && <div className="c-mat-short-badge">−{deficiency}</div>}
        {isStockShort && <div className="c-mat-stock-badge">−{stockDeficiency}</div>}
      </div>
      <div className="c-mat-name">{item.name}</div>

      <div className="c-mat-counts">
        <div className="c-mat-count-row">
          <span className="c-mat-count-label">必要</span>
          <span className="c-mat-count-val required">{required}</span>
          {stockEnabled && (stockBufferAmount ?? 0) > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}>
              +ストック {stockBufferAmount}
            </span>
          )}
        </div>
        <div className="c-mat-count-row">
          <span className="c-mat-count-label">所持</span>
          {editing ? (
            <input
              className="c-mat-count-input"
              type="number"
              defaultValue={owned ?? 0}
              min={0}
              autoFocus
              onBlur={e => { onChange(item.id.toString(), Number(e.target.value)); setEditing(false) }}
              onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
            />
          ) : (
            <span
              className={`c-mat-count-val owned${isShort ? ' insufficient' : ''}`}
              tabIndex={0}
              onClick={() => setEditing(true)}
              onFocus={() => setEditing(true)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true) } }}
            >
              {owned ?? 0}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export const Result = ({ items = [] }: MaterialResultProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = Object.fromEntries(searchParams?.entries() ?? [])
  const initialAmounts = Object.fromEntries(
    Object.entries(query).map(([k, v]) => [k, parseInt(typeof v === 'string' ? v : '0') || 0])
  )
  const [amounts] = useLocalStorage<Record<string, number>>('material/result', initialAmounts)

  const { stockEnabled, stockBuffer: resolvedStockBuffer } = useStockTarget()

  // 表示・計算対象のアイテム。stock ON 時はバッファ込みの所持トラッキングのため
  // 全アイテムを対象にする(育成必要数=0 でも buffer 目標があるため)。
  // stock OFF 時は従来どおり育成必要分(amounts に含まれる)のみ。
  const trackedItems = useMemo(
    () => (stockEnabled ? items : items.filter(item => item.id.toString() in amounts))
      .filter(item => !EXCLUDED_ITEM_IDS.has(Number(item.id))),
    [stockEnabled, amounts, items]
  )

  const [possession, setPossession] = useLocalStorage<Record<string, number | undefined>>(
    'posession',
    Object.fromEntries(trackedItems.map(item => [item.id.toString(), 0]))
  )

  // 表示フィルタ: all=全て / short=不足(必要数未達) / stock=ストック不足(必要数+buffer未達)。
  // stock は stockEnabled のときだけ選べる。
  const [filterMode, setFilterMode] = useState<'all' | 'short' | 'stock'>('all')
  const [stockOpen, setStockOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    if (window.location.hash === '#advisor') {
      // hash 付きで直接遷移した場合、mount 後にアドバイザーセクションへスクロール。
      requestAnimationFrame(() => {
        document.getElementById('advisor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [])

  const deficiencies = useMemo(
    () => Object.fromEntries(
      trackedItems.map(item => [
        item.id.toString(),
        Math.max(0, (amounts[item.id.toString()] ?? 0) - (possession[item.id.toString()] ?? 0)),
      ])
    ),
    [amounts, possession, trackedItems]
  )

  // ストック不足(目標B): max(0, 必要数+buffer−所持)。stock OFF 時は deficiencies と一致。
  const stockDeficiencies = useMemo(
    () => Object.fromEntries(
      trackedItems.map(item => [
        item.id.toString(),
        effectiveDeficiency(
          toStockItemLike(item),
          amounts[item.id.toString()] ?? 0,
          possession[item.id.toString()] ?? 0,
          resolvedStockBuffer,
          stockEnabled,
        ),
      ])
    ),
    [amounts, possession, trackedItems, resolvedStockBuffer, stockEnabled]
  )

  // stock を OFF にしたら「ストック不足」フィルタは選べないので不足にフォールバック。
  useEffect(() => {
    if (!stockEnabled && filterMode === 'stock') setFilterMode('short')
  }, [stockEnabled, filterMode])

  const onChange = useCallback((id: string, val: number) => {
    setPossession(prev => ({ ...prev, [id]: val }))
  }, [setPossession])

  const goSolver = useCallback(() => {
    // 目標A: max(0, 必要数 − 所持)。stock-only 素材(充足済みだが buffer 分が不足)は含まれない。
    const plainDeficiency = (item: EnrichedItem): number =>
      Math.max(
        0,
        (amounts[item.id.toString()] ?? 0) - (possession[item.id.toString()] ?? 0),
      )

    // 周回対象は育成関連素材(amounts に含まれる)に限定。育成不要な素材は表示・所持追跡のみで、
    // Goal B のストックを「全素材」に広げない(全素材ストック=AP膨張を防ぐ)。
    const solverItems = trackedItems.filter(item => item.id.toString() in amounts)

    const queryItemsA = solverItems
      .filter(item => plainDeficiency(item) > 0 && toApiItemId(item, items))
      .map(item => `${toApiItemId(item, items)}:${plainDeficiency(item)}`)
      .join(',')

    // 目標B: effectiveDeficiency = max(0, 必要数+buffer(item)−所持)。
    // stock-only 素材(A=0 だが B>0)も含む。goSolver 側で算出して URL 搬送する(D2訂正)。
    let stockParam = ''
    if (stockEnabled) {
      const effDef = (item: EnrichedItem): number =>
        effectiveDeficiency(
          toStockItemLike(item),
          amounts[item.id.toString()] ?? 0,
          possession[item.id.toString()] ?? 0,
          resolvedStockBuffer,
          true,
        )
      const queryItemsB = solverItems
        .filter(item => effDef(item) > 0 && toApiItemId(item, items))
        .map(item => `${toApiItemId(item, items)}:${effDef(item)}`)
        .join(',')
      // B と A が完全一致(全素材 buffer=0)のときは送らない。
      if (queryItemsB && queryItemsB !== queryItemsA) {
        stockParam = `&itemsStock=${queryItemsB}`
      }
    }

    router.push(`/farming?items=${queryItemsA}${stockParam}`)
  }, [trackedItems, router, amounts, possession, items, stockEnabled, resolvedStockBuffer])

  const displayedItems =
    filterMode === 'short'
      ? trackedItems.filter(item => deficiencies[item.id.toString()] > 0)
      : filterMode === 'stock' && stockEnabled
        ? trackedItems.filter(item => stockDeficiencies[item.id.toString()] > 0)
        : trackedItems

  const itemsByFloor = useMemo(
    () => groupBy(
      [...displayedItems].sort((a, b) => a.priority - b.priority),
      item => String(Math.floor(item.priority / 100))
    ) as Partial<Record<string, EnrichedItem[]>>,
    [displayedItems]
  )

  // floor 1〜3(スキル石/強化素材/モニュピ)に加え、それ以外の floor
  // (伝承結晶・特殊素材など)も「その他」へまとめて必ず描画する(取りこぼし防止)。
  const sections = useMemo(() => {
    const known = new Set(LARGE_SECTIONS.map(s => s.floor))
    const base = LARGE_SECTIONS.map(s => ({
      key: String(s.floor), label: s.label, color: s.color,
      items: itemsByFloor[String(s.floor)] ?? [],
    }))
    // floor 1〜3 以外(QP=floor0 / 聖杯=floor4 / 星光の砂等=floor10…)のうち、
    // 「その他」は当面 QP のみ表示する(聖杯・特殊素材等は出さない)。
    // これらは toApiItemId が空=ソルバー対象外で、表示・所持トラッキング専用。
    const otherItems = Object.entries(itemsByFloor)
      .filter(([floor]) => !known.has(Number(floor)))
      .flatMap(([, arr]) => arr ?? [])
      .filter(item => item.type === 'qp')
      .sort((a, b) => a.priority - b.priority)
    if (otherItems.length > 0) {
      base.push({ key: 'other', label: 'その他', color: 'var(--steel)', items: otherItems })
    }
    return base.filter(s => s.items.length > 0)
  }, [itemsByFloor])

  const totalShort = trackedItems.filter(item => deficiencies[item.id.toString()] > 0).length
  // ストック不足(必要数は満たすが buffer 未達 = stock-only)。stock ON のときのみ。
  const totalStockShort = stockEnabled
    ? trackedItems.filter(item => deficiencies[item.id.toString()] === 0 && stockDeficiencies[item.id.toString()] > 0).length
    : 0
  const totalMet = trackedItems.filter(item =>
    (amounts[item.id.toString()] ?? 0) > 0 &&
    deficiencies[item.id.toString()] === 0 &&
    (!stockEnabled || stockDeficiencies[item.id.toString()] === 0)
  ).length

  if (!mounted) return null

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">REQUIRED MATERIALS</div>
            <h1 className="c-page-title">アイテム必要数</h1>
          </div>
          <div className="c-result-actions">
            {totalShort > 0 && (
              <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600, letterSpacing: '0.02em' }}>
                不足 {totalShort}種
              </span>
            )}
            {totalStockShort > 0 && (
              <span style={{ fontSize: 12, color: 'var(--gold2)', fontWeight: 600, letterSpacing: '0.02em' }}>
                ストック不足 {totalStockShort}種
              </span>
            )}
            {totalShort === 0 && totalStockShort === 0 && totalMet > 0 && (
              <span style={{ fontSize: 12, color: '#60c890', fontWeight: 600 }}>
                充足 {totalMet}種
              </span>
            )}
            <div className="c-seg" role="group" aria-label="表示フィルタ">
              <button
                type="button"
                className={`c-seg-btn${filterMode === 'all' ? ' active' : ''}`}
                onClick={() => setFilterMode('all')}
              >
                全て
              </button>
              <button
                type="button"
                className={`c-seg-btn${filterMode === 'short' ? ' active' : ''}`}
                onClick={() => setFilterMode('short')}
              >
                {stockEnabled ? '不足' : '不足のみ'}
              </button>
              {stockEnabled && (
                <button
                  type="button"
                  className={`c-seg-btn stock${filterMode === 'stock' ? ' active' : ''}`}
                  onClick={() => setFilterMode('stock')}
                >
                  ストック不足
                </button>
              )}
            </div>
            <button
              type="button"
              className="c-back-btn"
              onClick={() => setImportOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <ImageUp size={14} />
              スクショから取り込む
            </button>
            <button
              type="button"
              className="c-back-btn"
              style={stockEnabled ? { color: 'var(--gold2)', borderColor: 'var(--gold-dim)' } : undefined}
              onClick={() => setStockOpen(true)}
            >
              ⚙ ストック目標
            </button>
            <Dialog open={stockOpen} onOpenChange={setStockOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>ストック目標設定</DialogTitle>
                </DialogHeader>
                <StockTargetSettings />
              </DialogContent>
            </Dialog>
            <PossessionImportDialog
              open={importOpen}
              onOpenChange={setImportOpen}
              items={items.map(item => ({
                id: item.id.toString(),
                name: item.name,
                icon: item.icon,
                atlasId: item.id,
              }))}
              possession={possession}
              onConfirm={updates =>
                setPossession(prev => ({ ...prev, ...updates }))
              }
            />
            <Link href="/material" className="c-back-btn">← 設定に戻る</Link>
          </div>
        </div>

        {displayedItems.length === 0 ? (
          <div className="c-empty">
            <div className="c-empty-icon">◎</div>
            <div className="c-empty-msg">
              {filterMode === 'short'
                ? '不足素材はありません'
                : filterMode === 'stock'
                  ? 'ストック不足の素材はありません'
                  : 'サーヴァントを所持済みに設定してください'}
            </div>
          </div>
        ) : (
          <>
          {sections.map(({ key, label, color, items: sectionItems }) => {
            return (
              <div key={key} className="c-mat-section">
                <div className="c-mat-section-title" style={{ color }}>
                  <span className="c-mat-section-line" style={{ background: color }} />
                  {label}
                  <span className="c-mat-section-line" style={{ background: color }} />
                </div>
                <div className="c-mat-grid">
                  {sectionItems.map((item: EnrichedItem) => (
                    <MatCard
                      key={item.id}
                      item={item}
                      required={amounts[item.id.toString()] ?? 0}
                      owned={possession[item.id.toString()]}
                      deficiency={deficiencies[item.id.toString()] ?? 0}
                      stockDeficiency={stockDeficiencies[item.id.toString()] ?? 0}
                      rarityColor={bgColor(item.background)}
                      onChange={onChange}
                      stockEnabled={stockEnabled}
                      stockBufferAmount={buffer(toStockItemLike(item), resolvedStockBuffer)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          </>
        )}

        <div id="advisor" className="c-mat-section">
          <Accordion multiple={false} defaultValue={['advisor']}>
            <AccordionItem value="advisor" style={{ border: 'none' }}>
              <AccordionTrigger className="c-mat-section-title" style={{ color: 'var(--gold)' }}>
                配布・交換券アドバイザー
              </AccordionTrigger>
              <AccordionContent>
                <MaterialSelectionAdvisor
                  items={items}
                  amounts={amounts}
                  possession={possession}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      <div className="c-farming-footer">
        <div className="c-summary-row">
          <div className="c-summary-item">
            <div className={`c-summary-num${totalShort > 0 ? ' short' : ' ok'}`}>{totalShort}</div>
            <div className="c-summary-label">不足種類</div>
          </div>
          <div className="c-summary-item">
            <div className="c-summary-num ok">{totalMet}</div>
            <div className="c-summary-label">充足種類</div>
          </div>
        </div>
        <button className="c-farming-btn" onClick={goSolver}>
          <span className="c-farming-btn-en">SOLVE FARMING ROUTE</span>
          <span className="c-farming-btn-jp">周回数を求める</span>
        </button>
      </div>
    </div>
  )
}
