'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ImageUp, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { useStockTarget } from '../../hooks/use-stock-target'
import { useQuestTree } from '../../hooks/use-quest-tree'
import { useExcludedQuests } from '../../hooks/use-excluded-quests'
import { useChecked } from '../../hooks/use-checked-from-quest-state'
import { useCheckboxTree } from '../../hooks/use-checkbox-tree'
import { parsePossessionInput } from '../../lib/possession-count'
import { EnrichedItem } from '../../lib/get-items'
import { Quest } from '../../interfaces/fgodrop'
import { groupBy } from '../../utils/group-by'
import { buffer, computeFiniteTarget } from '../../lib/quest-efficiency'
import { submitSolve } from '../../lib/farming/submit-solve'
import {
  buildSolveParams,
  toStockItemLike,
} from '../../lib/farming/build-solve-params'
import { STORAGE_KEYS } from '../../lib/constants/storage-keys'
import { CheckboxTree } from '../common/checkbox-tree'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import { FarmingPurposeSelector } from '../common/FarmingPurposeSelector'
import { PossessionImportDialog } from '../common/possession-import/PossessionImportDialog'
import { MaterialSelectionAdvisor } from './material-selection-advisor'

export type MaterialResultProps = {
  items: EnrichedItem[]
  quests: Quest[]
  locale?: string
}

// priority floor で largeCategory を決定（get-items.ts と同じロジック）
const LARGE_SECTIONS = [
  { floor: 1, label: 'スキル石', color: '#5566aa' }, // 輝石/魔石/秘石
  { floor: 2, label: '強化素材', color: '#7a5c34' }, // 汎用強化素材
  { floor: 3, label: 'モニュピ', color: '#9a7224' }, // ピース/モニュメント
]
// 育成と無関係なため必要数画面に表示しないアイテム(Atlas ID)。
const EXCLUDED_ITEM_IDS = new Set([7998]) // 聖杯の雫

const bgColor = (bg: string) =>
  bg === 'bronze' ? '#b06030' : bg === 'silver' ? '#6878a8' : '#9a7224'

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
        {isStockShort && (
          <div className="c-mat-stock-badge">−{stockDeficiency}</div>
        )}
      </div>
      <div className="c-mat-name">{item.name}</div>

      <div className="c-mat-counts">
        <div className="c-mat-count-row">
          <span className="c-mat-count-label">必要</span>
          <span className="c-mat-count-val required">{required}</span>
          {stockEnabled && (stockBufferAmount ?? 0) > 0 && (
            <span
              style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 4 }}
            >
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
              onBlur={(e) => {
                onChange(
                  item.id.toString(),
                  parsePossessionInput(e.target.value) ?? 0,
                )
                setEditing(false)
              }}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            />
          ) : (
            <span
              className={`c-mat-count-val owned${isShort ? ' insufficient' : ''}`}
              tabIndex={0}
              onClick={() => setEditing(true)}
              onFocus={() => setEditing(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setEditing(true)
                }
              }}
            >
              {owned ?? 0}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export const Result = ({ items = [], quests = [] }: MaterialResultProps) => {
  const { t } = useTranslation('material')
  const router = useRouter()
  const searchParams = useSearchParams()
  const query = Object.fromEntries(searchParams?.entries() ?? [])
  const initialAmounts = Object.fromEntries(
    Object.entries(query).map(([k, v]) => [
      k,
      parseInt(typeof v === 'string' ? v : '0') || 0,
    ]),
  )
  const [amounts] = useLocalStorage<Record<string, number>>(
    STORAGE_KEYS.MATERIAL_RESULT,
    initialAmounts,
  )

  const {
    purpose,
    stockEnabled,
    stockBuffer: resolvedStockBuffer,
  } = useStockTarget()

  // 表示・計算対象のアイテム。stock ON 時はバッファ込みの所持トラッキングのため
  // 全アイテムを対象にする(育成必要数=0 でも buffer 目標があるため)。
  // stock OFF 時は従来どおり育成必要分(amounts に含まれる)のみ。
  const trackedItems = useMemo(
    () =>
      (stockEnabled
        ? items
        : items.filter((item) => item.id.toString() in amounts)
      ).filter((item) => !EXCLUDED_ITEM_IDS.has(Number(item.id))),
    [stockEnabled, amounts, items],
  )

  const [possession, setPossession] = useLocalStorage<
    Record<string, number | undefined>
  >(
    STORAGE_KEYS.POSSESSION,
    Object.fromEntries(trackedItems.map((item) => [item.id.toString(), 0])),
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
        document
          .getElementById('advisor')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    }
  }, [])

  const deficiencies = useMemo(
    () =>
      Object.fromEntries(
        trackedItems.map((item) => [
          item.id.toString(),
          Math.max(
            0,
            (amounts[item.id.toString()] ?? 0) -
              (possession[item.id.toString()] ?? 0),
          ),
        ]),
      ),
    [amounts, possession, trackedItems],
  )

  // ストック不足(目標B): max(0, 必要数+buffer−所持)。stock OFF 時は deficiencies と一致。
  const stockDeficiencies = useMemo(
    () =>
      Object.fromEntries(
        trackedItems.map((item) => [
          item.id.toString(),
          Math.max(
            0,
            computeFiniteTarget(
              toStockItemLike(item),
              amounts[item.id.toString()] ?? 0,
              resolvedStockBuffer,
              purpose === 'reserve' ? 'reserve' : 'training',
            ) - (possession[item.id.toString()] ?? 0),
          ),
        ]),
      ),
    [amounts, possession, trackedItems, resolvedStockBuffer, purpose],
  )

  // stock を OFF にしたら「ストック不足」フィルタは選べないので不足にフォールバック。
  useEffect(() => {
    if (!stockEnabled && filterMode === 'stock') setFilterMode('short')
  }, [stockEnabled, filterMode])

  const onChange = useCallback(
    (id: string, val: number) => {
      setPossession((prev) => ({ ...prev, [id]: val }))
    },
    [setPossession],
  )

  // PossessionImportDialog は常時マウントされ、Result は所持数入力のたびに再レンダー
  // される。items を毎回 map し直すと閉じている間もダイアログ側の Map 再構築を招くため
  // メモ化して参照を固定する。
  const importItems = useMemo(
    () =>
      items.map((item) => ({
        id: item.id.toString(),
        name: item.name,
        icon: item.icon,
        atlasId: item.id,
      })),
    [items],
  )

  // 周回対象クエスト選択(/farming と同じ組み合わせ)。goSolver への配線は別タスク。
  const { tree: questTree } = useQuestTree(quests)
  const questIds = useMemo(() => quests.map(({ id }) => id), [quests])
  const [checkedQuests, setCheckedQuests] = useExcludedQuests(questIds)
  const [selectedQuests, setSelectedQuests] = useChecked(
    questIds,
    checkedQuests,
    setCheckedQuests,
  )
  const {
    checked: checkedQuestTree,
    onCheck: onCheckQuest,
    expanded: expandedQuests,
    onExpand: onExpandQuests,
  } = useCheckboxTree(questTree, selectedQuests, setSelectedQuests)

  // 在庫確保では、所持数を入力済みの素材だけを在庫基準まで集める。
  // 未入力を 0 個扱いして全素材へ目標を広げない。
  const solverItems = useMemo(
    () =>
      trackedItems.filter(
        (item) =>
          item.id.toString() in amounts ||
          (purpose === 'reserve' && item.id.toString() in possession),
      ),
    [trackedItems, amounts, possession, purpose],
  )

  const {
    needsItemTarget,
    needsQuestSelection,
    params: solveParams,
  } = useMemo(
    () =>
      buildSolveParams({
        solverItems,
        amounts,
        possession,
        purpose,
        resolvedStockBuffer,
        items,
        checkedQuests,
      }),
    [
      solverItems,
      amounts,
      possession,
      purpose,
      resolvedStockBuffer,
      items,
      checkedQuests,
    ],
  )

  const [isLoading, setIsLoading] = useState(false)

  const goSolver = useCallback(async () => {
    if (!solveParams) return

    setIsLoading(true)
    try {
      await submitSolve(solveParams, router)
    } catch (e) {
      // submitSolve が reject するのは fetch 自体の失敗時のみ(不正レスポンスは
      // 内部で /500 へ遷移する)。ここで拾わないとローディング表示が固まったまま
      // 再送信できなくなるため、ローディング解除だけは確実に行う。
      console.error('[material/result] solve submission failed:', e)
    } finally {
      setIsLoading(false)
    }
  }, [solveParams, router])

  const displayedItems =
    filterMode === 'short'
      ? trackedItems.filter((item) => deficiencies[item.id.toString()] > 0)
      : filterMode === 'stock' && stockEnabled
        ? trackedItems.filter(
            (item) => stockDeficiencies[item.id.toString()] > 0,
          )
        : trackedItems

  const itemsByFloor = useMemo(
    () =>
      groupBy(
        [...displayedItems].sort((a, b) => a.priority - b.priority),
        (item) => String(Math.floor(item.priority / 100)),
      ) as Partial<Record<string, EnrichedItem[]>>,
    [displayedItems],
  )

  // floor 1〜3(スキル石/強化素材/モニュピ)に加え、それ以外の floor
  // (伝承結晶・特殊素材など)も「その他」へまとめて必ず描画する(取りこぼし防止)。
  const sections = useMemo(() => {
    const known = new Set(LARGE_SECTIONS.map((s) => s.floor))
    const base = LARGE_SECTIONS.map((s) => ({
      key: String(s.floor),
      label: s.label,
      color: s.color,
      items: itemsByFloor[String(s.floor)] ?? [],
    }))
    // floor 1〜3 以外(QP=floor0 / 聖杯=floor4 / 星光の砂等=floor10…)のうち、
    // 「その他」は当面 QP のみ表示する(聖杯・特殊素材等は出さない)。
    // これらは toApiItemId が空=ソルバー対象外で、表示・所持トラッキング専用。
    const otherItems = Object.entries(itemsByFloor)
      .filter(([floor]) => !known.has(Number(floor)))
      .flatMap(([, arr]) => arr ?? [])
      .filter((item) => item.type === 'qp')
      .sort((a, b) => a.priority - b.priority)
    if (otherItems.length > 0) {
      base.push({
        key: 'other',
        label: 'その他',
        color: 'var(--steel)',
        items: otherItems,
      })
    }
    return base.filter((s) => s.items.length > 0)
  }, [itemsByFloor])

  const totalShort = trackedItems.filter(
    (item) => deficiencies[item.id.toString()] > 0,
  ).length
  // ストック不足(必要数は満たすが buffer 未達 = stock-only)。stock ON のときのみ。
  const totalStockShort = stockEnabled
    ? trackedItems.filter(
        (item) =>
          deficiencies[item.id.toString()] === 0 &&
          stockDeficiencies[item.id.toString()] > 0,
      ).length
    : 0
  const totalMet = trackedItems.filter(
    (item) =>
      (amounts[item.id.toString()] ?? 0) > 0 &&
      deficiencies[item.id.toString()] === 0 &&
      (!stockEnabled || stockDeficiencies[item.id.toString()] === 0),
  ).length

  if (!mounted) return null

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      )}
      <div className="c-page">
        <div className="c-page-inner">
          <div className="c-page-header">
            <div>
              <div className="c-page-en">REQUIRED MATERIALS</div>
              <h1 className="c-page-title">アイテム必要数</h1>
            </div>
            <div className="c-result-actions">
              {totalShort > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--red)',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                  }}
                >
                  不足 {totalShort}種
                </span>
              )}
              {totalStockShort > 0 && (
                <span
                  style={{
                    fontSize: 12,
                    color: 'var(--gold2)',
                    fontWeight: 600,
                    letterSpacing: '0.02em',
                  }}
                >
                  ストック不足 {totalStockShort}種
                </span>
              )}
              {totalShort === 0 && totalStockShort === 0 && totalMet > 0 && (
                <span
                  style={{ fontSize: 12, color: '#60c890', fontWeight: 600 }}
                >
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
              </div>
              <FarmingPurposeSelector compact />
              {purpose === 'all' && (
                <span className="text-xs" style={{ color: 'var(--text3)' }}>
                  {t(
                    'common:farming-purpose-solver-fallback',
                    '周回計算は今の育成を使用',
                  )}
                </span>
              )}
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
                style={
                  stockEnabled
                    ? { color: 'var(--gold2)', borderColor: 'var(--gold-dim)' }
                    : undefined
                }
                onClick={() => setStockOpen(true)}
              >
                ⚙ {t('common:inventory-baseline-settings', '在庫基準')}
              </button>
              <Dialog open={stockOpen} onOpenChange={setStockOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>
                      {t(
                        'common:inventory-baseline-settings',
                        '在庫基準の設定',
                      )}
                    </DialogTitle>
                  </DialogHeader>
                  <StockTargetSettings />
                </DialogContent>
              </Dialog>
              <PossessionImportDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                items={importItems}
                possession={possession}
                onConfirm={(updates) =>
                  setPossession((prev) => ({ ...prev, ...updates }))
                }
              />
              <Link href="/material" className="c-back-btn">
                ← 設定に戻る
              </Link>
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
                      <span
                        className="c-mat-section-line"
                        style={{ background: color }}
                      />
                      {label}
                      <span
                        className="c-mat-section-line"
                        style={{ background: color }}
                      />
                    </div>
                    <div className="c-mat-grid">
                      {sectionItems.map((item: EnrichedItem) => (
                        <MatCard
                          key={item.id}
                          item={item}
                          required={amounts[item.id.toString()] ?? 0}
                          owned={possession[item.id.toString()]}
                          deficiency={deficiencies[item.id.toString()] ?? 0}
                          stockDeficiency={
                            stockDeficiencies[item.id.toString()] ?? 0
                          }
                          rarityColor={bgColor(item.background)}
                          onChange={onChange}
                          stockEnabled={stockEnabled}
                          stockBufferAmount={buffer(
                            toStockItemLike(item),
                            resolvedStockBuffer,
                          )}
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
                <AccordionTrigger
                  className="c-mat-section-title"
                  style={{ color: 'var(--gold)' }}
                >
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

          <div id="quest-selection" className="c-mat-section">
            <Accordion multiple={false} defaultValue={[]}>
              <AccordionItem value="quest-selection" style={{ border: 'none' }}>
                <AccordionTrigger
                  className="c-mat-section-title"
                  style={{ color: 'var(--gold)' }}
                >
                  {t('quest-selection-heading', '周回対象に含めるクエスト')}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="c-card w-full p-5">
                    <CheckboxTree
                      tree={questTree}
                      checked={checkedQuestTree}
                      onCheck={onCheckQuest}
                      expanded={expandedQuests}
                      onExpand={onExpandQuests}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {needsItemTarget && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>
                {t(
                  'submit-need-item-target',
                  '集めたいアイテムの数を最低1つ入力してください。',
                )}
              </AlertDescription>
            </Alert>
          )}
          {needsQuestSelection && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertDescription>
                {t(
                  'submit-need-quest-selection',
                  '周回対象に含めるクエストを最低1つ選択してください。',
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <div className="c-farming-footer">
          <div className="c-summary-row">
            <div className="c-summary-item">
              <div
                className={`c-summary-num${totalShort > 0 ? ' short' : ' ok'}`}
              >
                {totalShort}
              </div>
              <div className="c-summary-label">不足種類</div>
            </div>
            <div className="c-summary-item">
              <div className="c-summary-num ok">{totalMet}</div>
              <div className="c-summary-label">充足種類</div>
            </div>
          </div>
          <button
            className="c-farming-btn"
            onClick={() => void goSolver()}
            disabled={isLoading || needsItemTarget || needsQuestSelection}
          >
            <span className="c-farming-btn-en">SOLVE FARMING ROUTE</span>
            <span className="c-farming-btn-jp">周回数を求める</span>
          </button>
        </div>
      </div>
    </>
  )
}
