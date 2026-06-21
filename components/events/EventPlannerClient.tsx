'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FaChevronLeft } from 'react-icons/fa'
import { Link } from '../common/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { EventPlannerEvent } from '../../lib/master-data/types'
import type { ChaldeaState } from '../../hooks/create-chaldea-state'
import { useLocalStorage } from '../../hooks/use-local-storage'
import {
  calcBoxLayer,
  allocateShop,
  computeShortfall,
  computeRosterImpact,
  reverseCalcBoxes,
  runEventSolver,
  type BoxLayerResult,
  type ShopAllocationResult,
  type RosterImpactResult,
  type EventSolverResult,
} from '../../lib/event-plan'
import type { MaterialsForServants } from '../../lib/get-materials'
import { getMaterialsForServantIds } from '../../lib/get-materials'
import { EventPlanResultCard } from './EventPlanResultCard'

/** AP per 果実 (golden apple): 40. 林檎 (silver apple): 20. */
const AP_PER_GOLDEN_APPLE = 40
const AP_PER_SILVER_APPLE = 20

interface Props {
  event: EventPlannerEvent
}

type InputMode = 'roster' | 'boxes' | 'items'

/**
 * 直接指定モードで選べる素材候補 (通常箱の確定報酬 + 交換所アイテムの atlasId を集約)。
 * rareRewards（サーヴァント・聖杯・伝承結晶など一発もの）は周回計画の対象外なので除外する。
 */
const collectSelectableItems = (event: EventPlannerEvent): { id: number; name: string; icon?: string }[] => {
  const map = new Map<number, { name: string; icon?: string }>()
  for (const box of event.lotteries) {
    for (const c of box.contents) {
      if (!map.has(c.itemId)) map.set(c.itemId, { name: c.name, icon: c.icon })
    }
  }
  for (const s of event.shop) {
    if (!map.has(s.itemId)) map.set(s.itemId, { name: s.name ?? '', icon: s.icon })
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([id, meta]) => ({ id, ...meta }))
}

export const EventPlannerClient: React.FC<Props> = ({ event }) => {
  const { t } = useTranslation('events')

  // ── Roster (read-only) ───────────────────────────────────────────────────────
  const [chaldeaState] = useLocalStorage<ChaldeaState>('material', {})
  const [possessionRaw] = useLocalStorage<Record<string, string | number>>('items', {})

  // Normalize possession to Record<string, number>
  const possession = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(possessionRaw)) {
      out[k] = Number(v) || 0
    }
    return out
  }, [possessionRaw])

  // Enabled servant IDs (ignore 'all' key and disabled servants)
  const enabledServantIds = useMemo<number[]>(() => {
    return Object.entries(chaldeaState)
      .filter(([id, s]) => id !== 'all' && !s.disabled)
      .map(([id]) => Number(id))
      .filter(Boolean)
  }, [chaldeaState])

  const hasRoster = enabledServantIds.length > 0

  // ── Mode ────────────────────────────────────────────────────────────────────
  const [inputMode, setInputMode] = useState<InputMode>(hasRoster ? 'roster' : 'boxes')

  // ── Inputs ──────────────────────────────────────────────────────────────────
  const maxBoxes = event.lotteries.length
  const [targetBoxes, setTargetBoxes] = useState(maxBoxes)
  const [ownedCurrency, setOwnedCurrency] = useState(0)
  // 会期途中: 既に開封済みの箱数（その分の通貨は払い済みなので残り計算から除く）。
  const [openedBoxes, setOpenedBoxes] = useState(0)
  // Manual drop input (US-5)
  const [manualDropPerRun, setManualDropPerRun] = useState<string>('')
  // Direct item demand input (US-2): atlasId(string) → desired quantity(string)
  const [itemDemandInput, setItemDemandInput] = useState<Record<string, string>>({})

  const selectableItems = useMemo(() => collectSelectableItems(event), [event])

  // Parsed item demand Map (atlasId → qty), positive entries only
  const itemDemand = useMemo<Map<number, number>>(() => {
    const m = new Map<number, number>()
    for (const [idStr, qtyStr] of Object.entries(itemDemandInput)) {
      const qty = Number(qtyStr)
      if (qty > 0) m.set(Number(idStr), qty)
    }
    return m
  }, [itemDemandInput])

  // ── Server data (materials for servants) ────────────────────────────────────
  const [materialsForServants, setMaterialsForServants] = useState<MaterialsForServants>({})
  const [materialsLoading, setMaterialsLoading] = useState(false)

  useEffect(() => {
    if (!hasRoster) return
    setMaterialsLoading(true)
    getMaterialsForServantIds(enabledServantIds)
      .then(setMaterialsForServants)
      .catch(console.error)
      .finally(() => setMaterialsLoading(false))
  }, [hasRoster, enabledServantIds.join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived: effective drop override ─────────────────────────────────────────
  const hasAtlasDrops = event.farmingNodes.some(n => n.drops.length > 0)
  const usingManualDrops = !hasAtlasDrops && Number(manualDropPerRun) > 0 && !!event.farmingNodes[0]

  // Build event with manual drops substituted when Atlas data is absent and user typed one
  const effectiveEvent = useMemo<EventPlannerEvent>(() => {
    const manualNum = Number(manualDropPerRun)
    if (hasAtlasDrops || !manualNum || !event.farmingNodes[0]) return event

    // Inject the manual drop into the first farming node as currency drop
    return {
      ...event,
      farmingNodes: event.farmingNodes.map((node, i) =>
        i === 0
          ? {
              ...node,
              drops: [{ itemId: event.currency.id, perRun: manualNum }],
            }
          : node
      ),
    }
  }, [event, hasAtlasDrops, manualDropPerRun])

  // ── Calculations ────────────────────────────────────────────────────────────

  // 直接指定モード(US-2): 欲しいアイテム数 → 最小箱数を逆算。
  const reverseResult = useMemo(() => {
    if (inputMode !== 'items' || itemDemand.size === 0) return null
    return reverseCalcBoxes(effectiveEvent, itemDemand, ownedCurrency)
  }, [inputMode, itemDemand, effectiveEvent, ownedCurrency])

  // 実効箱数: items モードでは逆算結果、それ以外はスライダー値。
  const effectiveBoxes = inputMode === 'items' && reverseResult
    ? reverseResult.minBoxes
    : targetBoxes

  const boxLayer = useMemo<BoxLayerResult>(() => {
    return calcBoxLayer(effectiveEvent, effectiveBoxes, ownedCurrency, openedBoxes)
  }, [effectiveEvent, effectiveBoxes, ownedCurrency, openedBoxes])

  // 不足素材(育成ロスター)。roster モードでのみ算出。
  const shortfall = useMemo<Map<number, number>>(() => {
    if (inputMode !== 'roster' || !hasRoster || materialsLoading) return new Map()
    if (Object.keys(materialsForServants).length === 0) return new Map()
    return computeShortfall(chaldeaState, materialsForServants, possession)
  }, [inputMode, hasRoster, materialsLoading, materialsForServants, chaldeaState, possession])

  // 交換所配分(全モード共通)。
  //  - roster: 不足素材 − ボックス確定報酬 を交換所に充当(limitNum で打ち切り)。
  //  - items : reverseCalcBoxes が算出した交換所配分をそのまま採用。
  //  - boxes : 交換所需要なし。
  const shopAllocation = useMemo<ShopAllocationResult>(() => {
    if (inputMode === 'items' && reverseResult) {
      return reverseResult.shopAllocation
    }
    if (inputMode === 'roster' && shortfall.size > 0) {
      // 不足から箱確定報酬を差し引いた残りを交換所需要にする。
      const residualAfterBoxes = new Map<number, number>()
      for (const [atlasId, deficit] of shortfall) {
        const fromBoxes = boxLayer.confirmedMaterials.get(atlasId) ?? 0
        const remaining = Math.max(0, deficit - fromBoxes)
        if (remaining > 0) residualAfterBoxes.set(atlasId, remaining)
      }
      return allocateShop(effectiveEvent.shop, residualAfterBoxes)
    }
    return allocateShop(effectiveEvent.shop, new Map<number, number>())
  }, [inputMode, reverseResult, shortfall, boxLayer.confirmedMaterials, effectiveEvent.shop])

  // 育成インパクト: 実際の交換所配分を反映して充当率を算出。
  const rosterImpact = useMemo<RosterImpactResult | null>(() => {
    if (inputMode !== 'roster' || shortfall.size === 0) return null
    return computeRosterImpact(
      chaldeaState,
      materialsForServants,
      possession,
      boxLayer,
      shopAllocation
    )
  }, [inputMode, shortfall.size, chaldeaState, materialsForServants, possession, boxLayer, shopAllocation])

  const solverResult = useMemo<EventSolverResult | null>(() => {
    const currencyDemand = boxLayer.remainingCurrency
    const shopCurrencyDemand = shopAllocation.totalCurrencyUsed

    // Total currency demand (boxes + shop)
    const totalCurrency = Math.max(0, currencyDemand + shopCurrencyDemand)

    // roster モードの残余不足を直接ドロップ需要としてソルバーに渡す。
    const extraItemDemand =
      inputMode === 'roster' && rosterImpact
        ? rosterImpact.solverDemand
        : inputMode === 'items' && reverseResult
        ? reverseResult.residualDemand
        : new Map<number, number>()

    if (totalCurrency === 0 && extraItemDemand.size === 0 && effectiveEvent.farmingNodes.length === 0) {
      return null
    }

    try {
      return runEventSolver(effectiveEvent, totalCurrency, extraItemDemand)
    } catch {
      return null
    }
  }, [effectiveEvent, boxLayer.remainingCurrency, shopAllocation.totalCurrencyUsed, inputMode, rosterImpact, reverseResult])

  // ── AP → Apple conversion ───────────────────────────────────────────────────
  const totalAp = solverResult?.result.total_ap ?? 0
  const goldenApples = totalAp > 0 ? Math.ceil(totalAp / AP_PER_GOLDEN_APPLE) : 0
  const silverApples = totalAp > 0 ? Math.ceil(totalAp / AP_PER_SILVER_APPLE) : 0

  const [clientNowSec, setClientNowSec] = useState(0)
  useEffect(() => { setClientNowSec(Math.floor(Date.now() / 1000)) }, [])
  const isActive = clientNowSec > 0 && event.startedAt <= clientNowSec && event.endedAt >= clientNowSec
  const isEnded = clientNowSec > 0 && event.endedAt < clientNowSec

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-6">

          {/* Header */}
          <div className="c-page-header">
            <div className="flex flex-col gap-2">
              <Link
                href="/events"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: 'var(--text3)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                <FaChevronLeft size={11} /> {t('イベント一覧へ戻る')}
              </Link>
              <div className="flex flex-col">
                <div className="c-page-en">EVENT PLANNER</div>
                <h1 className="c-page-title">{event.name}</h1>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isActive && (
                  <Badge variant="destructive" className="text-[10px]">
                    {t('開催中')}
                  </Badge>
                )}
                {isEnded && (
                  <Badge variant="outline" className="text-[10px]">
                    {t('終了')}
                  </Badge>
                )}
                {!isActive && !isEnded && (
                  <Badge variant="secondary" className="text-[10px]">
                    {t('開催予定')}
                  </Badge>
                )}
                <span className="text-xs" style={{ color: 'var(--text3)' }}>
                  {t('箱数', { count: maxBoxes })}
                </span>
                <span className="text-xs" style={{ color: 'var(--text3)' }}>
                  {event.currency.name}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Input panel */}
            <div className="lg:col-span-1 flex flex-col gap-4">
              {/* Mode selector */}
              <div
                className="rounded-lg p-4 flex flex-col gap-3"
                style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
                  {t('入力モード')}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {hasRoster && (
                    <Button
                      size="sm"
                      variant={inputMode === 'roster' ? 'default' : 'outline'}
                      className="text-xs"
                      onClick={() => setInputMode('roster')}
                    >
                      {t('育成ロスター')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={inputMode === 'boxes' ? 'default' : 'outline'}
                    className="text-xs"
                    onClick={() => setInputMode('boxes')}
                  >
                    {t('箱数指定')}
                  </Button>
                  <Button
                    size="sm"
                    variant={inputMode === 'items' ? 'default' : 'outline'}
                    className="text-xs"
                    onClick={() => setInputMode('items')}
                  >
                    {t('欲しい素材指定')}
                  </Button>
                </div>
                {!hasRoster && (
                  <p className="text-xs" style={{ color: 'var(--text3)' }}>
                    {t('ロスター未設定時の説明')}
                  </p>
                )}
                {inputMode === 'roster' && materialsLoading && (
                  <p className="text-xs" style={{ color: 'var(--text3)' }}>
                    {t('素材データ読み込み中')}
                  </p>
                )}
              </div>

              {/* Target boxes (boxes/roster modes — items mode derives the box count) */}
              {inputMode !== 'items' && (
                <div
                  className="rounded-lg p-4 flex flex-col gap-3"
                  style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
                >
                  <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
                    {t('目標箱数')}
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      {...(event.unlimitedBoxes ? {} : { max: maxBoxes })}
                      value={targetBoxes}
                      onChange={e =>
                        setTargetBoxes(
                          event.unlimitedBoxes
                            ? Math.max(0, Math.floor(Number(e.target.value)))
                            : Math.min(maxBoxes, Math.max(0, Number(e.target.value)))
                        )
                      }
                      className="w-24 text-sm"
                    />
                    <span className="text-sm" style={{ color: 'var(--text3)' }}>
                      {event.unlimitedBoxes ? t('箱') : `/ ${maxBoxes} ${t('箱')}`}
                    </span>
                  </div>
                </div>
              )}

              {/* Direct item demand (items mode — US-2) */}
              {inputMode === 'items' && (
                <div
                  className="rounded-lg p-4 flex flex-col gap-3"
                  style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
                >
                  <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
                    {t('欲しい素材の個数')}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text3)' }}>
                    {t('欲しい素材説明')}
                  </p>
                  <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                    {selectableItems.map(({ id, name, icon }) => (
                      <div key={id} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 min-w-0">
                          {icon && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={icon} alt={name} className="w-5 h-5 object-contain flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          )}
                          <span className="text-xs truncate" style={{ color: 'var(--text2)' }}>
                            {name || `#${id}`}
                          </span>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          value={itemDemandInput[String(id)] ?? ''}
                          onChange={e =>
                            setItemDemandInput(prev => ({ ...prev, [String(id)]: e.target.value }))
                          }
                          className="w-24 text-sm flex-shrink-0"
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                  {reverseResult && (
                    <p className="text-xs" style={{ color: 'var(--text3)' }}>
                      {t('逆算結果説明', { boxes: reverseResult.minBoxes })}
                    </p>
                  )}
                </div>
              )}

              {/* Owned currency */}
              <div
                className="rounded-lg p-4 flex flex-col gap-3"
                style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
              >
                <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
                  {t('所持通貨')}
                </p>
                <div className="flex items-center gap-2">
                  {event.currency.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={event.currency.icon}
                      alt={event.currency.name}
                      className="w-6 h-6"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  )}
                  <Input
                    type="number"
                    min={0}
                    value={ownedCurrency}
                    onChange={e => setOwnedCurrency(Math.max(0, Number(e.target.value)))}
                    className="w-28 text-sm"
                    placeholder="0"
                  />
                  <span className="text-xs" style={{ color: 'var(--text3)' }}>
                    {event.currency.name}
                  </span>
                </div>
                <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
                  {t('今開けた箱数')}
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={openedBoxes}
                    onChange={e => setOpenedBoxes(Math.max(0, Math.floor(Number(e.target.value))))}
                    className="w-28 text-sm"
                    placeholder="0"
                  />
                  <span className="text-xs" style={{ color: 'var(--text3)' }}>
                    {t('箱')}
                  </span>
                </div>
              </div>

              {/* Manual drop fallback (US-5) */}
              {!hasAtlasDrops && (
                <div
                  className="rounded-lg p-4 flex flex-col gap-3"
                  style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
                >
                  <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
                    {t('手入力ドロップ')}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text3)' }}>
                    {t('手入力ドロップ説明')}
                  </p>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs">
                      {event.farmingNodes[0]?.name ?? t('周回ノード')} — {event.currency.name} / {t('1周')}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={manualDropPerRun}
                      onChange={e => setManualDropPerRun(e.target.value)}
                      className="w-28 text-sm"
                      placeholder="54.0"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Result panel */}
            <div className="lg:col-span-2 flex flex-col gap-4">

              {/* Roster impact (mode=roster only) */}
              {inputMode === 'roster' && rosterImpact && (
                <div
                  className="rounded-lg p-4 flex flex-col gap-3"
                  style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
                >
                  <p className="text-sm font-semibold" style={{ color: 'var(--text1)' }}>
                    {t('育成インパクト')}
                  </p>
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold" style={{ color: 'var(--gold)' }}>
                      {Math.round(rosterImpact.coverageRate * 100)}%
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text3)' }}>
                        {t('育成カバー率説明')}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                        {t('不足素材N種', { count: rosterImpact.shortfall.size })}
                      </p>
                    </div>
                  </div>
                  {rosterImpact.residualShortfall.size > 0 && (
                    <p className="text-xs" style={{ color: 'var(--text3)' }}>
                      {t('残余不足説明', { count: rosterImpact.residualShortfall.size })}
                    </p>
                  )}
                </div>
              )}

              {/* Main result card */}
              <EventPlanResultCard
                event={effectiveEvent}
                boxLayer={boxLayer}
                shopAllocation={shopAllocation}
                solverResult={solverResult}
                goldenApples={goldenApples}
                silverApples={silverApples}
                dropSource={
                  usingManualDrops
                    ? 'manual'
                    : solverResult?.dropSource ?? (hasAtlasDrops ? 'atlas' : 'none')
                }
              />

              {/* Overflow warnings (US-6) */}
              {shopAllocation.hasOverflow && (
                <div
                  className="rounded-lg p-3 text-xs"
                  style={{
                    background: 'rgba(234,179,8,0.1)',
                    border: '1px solid rgba(234,179,8,0.4)',
                    color: 'var(--text2)',
                  }}
                >
                  <p className="font-semibold mb-1" style={{ color: 'rgb(202,138,4)' }}>
                    {t('交換所在庫上限警告タイトル')}
                  </p>
                  {shopAllocation.allocations
                    .filter(a => a.cappedByLimit)
                    .map((a, i) => (
                      <p key={i}>
                        {t('交換所在庫上限警告', {
                          item: `ID:${a.shopItem.itemId}`,
                          overflow: a.overflow,
                        })}
                      </p>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
