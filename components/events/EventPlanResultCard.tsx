'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { Info } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import type { EventPlannerEvent } from '../../lib/master-data/types'
import type {
  BoxLayerResult,
  ShopAllocationResult,
  EventSolverResult,
} from '../../lib/event-plan'
import type { ApBudget } from '../../lib/ap-budget'

interface Props {
  event: EventPlannerEvent
  boxLayer: BoxLayerResult
  shopAllocation: ShopAllocationResult
  solverResult: EventSolverResult | null
  apBudget: ApBudget
  dropSource: 'atlas' | 'manual' | 'none'
}

const StatBlock: React.FC<{ label: string; value: React.ReactNode; sub?: string }> = ({ label, value, sub }) => (
  <div className="flex flex-col gap-0.5">
    <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--text3)' }}>
      {label}
    </p>
    <p className="text-xl font-bold" style={{ color: 'var(--text1)' }}>
      {value}
    </p>
    {sub && (
      <p className="text-[10px]" style={{ color: 'var(--text3)' }}>
        {sub}
      </p>
    )}
  </div>
)

export const EventPlanResultCard: React.FC<Props> = ({
  event,
  boxLayer,
  shopAllocation,
  solverResult,
  apBudget,
  dropSource,
}) => {
  const { t } = useTranslation('events')

  // confirmedMaterials 描画用に itemId → {name, icon} を事前構築（チップ毎の
  // flatMap().find() の O(N*M) を回避）。
  const itemMetaMap = React.useMemo(() => {
    const map = new Map<number, { name: string; icon?: string }>()
    for (const box of event.lotteries) {
      for (const c of box.contents) {
        if (!map.has(c.itemId)) map.set(c.itemId, { name: c.name, icon: c.icon })
      }
    }
    return map
  }, [event.lotteries])

  const totalLap = solverResult?.result.total_lap ?? 0
  const totalAp = solverResult?.result.total_ap ?? 0

  const sourceLabel =
    dropSource === 'atlas'
      ? t('データソース:Atlas')
      : dropSource === 'manual'
      ? t('データソース:手入力')
      : t('データソース:なし')

  return (
    <div
      className="rounded-lg p-4 flex flex-col gap-4"
      style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" style={{ color: 'var(--text1)' }}>
          {t('計算結果')}
        </p>
        <Badge
          variant={dropSource === 'atlas' ? 'secondary' : dropSource === 'manual' ? 'outline' : 'destructive'}
          className="text-[10px]"
        >
          {sourceLabel}
        </Badge>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatBlock
          label={t('必要通貨')}
          value={boxLayer.remainingCurrency.toLocaleString()}
          sub={event.currency.name}
        />
        <StatBlock
          label={t('必要箱数')}
          value={`${boxLayer.boxesToOpen}`}
          sub={event.unlimitedBoxes ? t('箱') : `/ ${event.lotteries.length} ${t('箱')}`}
        />
        <StatBlock
          label={t('必要周回数')}
          value={totalLap > 0 ? totalLap.toLocaleString() : '—'}
        />
        <StatBlock
          label={t('消費AP')}
          value={totalAp > 0 ? totalAp.toLocaleString() : '—'}
          sub={totalAp > 0 ? t('最大AP基準', { maxAp: apBudget.maxAp }) : undefined}
        />
      </div>

      {/* AP予算内訳（黄金の果実 → 聖晶石 → 課金額） */}
      {totalAp > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
                {t('AP予算内訳')}
              </p>
              <Tooltip>
                <TooltipTrigger className="flex-shrink-0 cursor-default" style={{ color: 'var(--text3)' }}>
                  <Info size={13} />
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[260px] text-left leading-relaxed">
                  {t('課金額換算説明')}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatBlock
                label={t('黄金の果実消費')}
                value={apBudget.goldenFruitUsed.toLocaleString()}
                sub={t('所持N', { count: apBudget.goldenFruitOwned })}
              />
              <StatBlock
                label={t('必要聖晶石')}
                value={apBudget.quartzCount.toLocaleString()}
              />
              <StatBlock
                label={t('課金額目安')}
                value={`¥${apBudget.yen.toLocaleString()}`}
              />
            </div>
          </div>
        </>
      )}

      {/* Quests breakdown */}
      {solverResult && solverResult.result.quests.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
              {t('周回計画')}
            </p>
            {solverResult.result.quests.map(q => (
              <div key={q.id} className="flex justify-between items-center text-xs">
                <span style={{ color: 'var(--text2)' }}>{q.name}</span>
                <span className="font-medium" style={{ color: 'var(--text1)' }}>
                  {q.lap.toLocaleString()} {t('周')} / {(q.lap * q.ap).toLocaleString()} AP
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {dropSource === 'none' && (
        <div
          className="rounded p-3 text-xs"
          style={{ background: 'var(--panel)', color: 'var(--text3)' }}
        >
          {t('ドロップデータなし説明')}
        </div>
      )}

      <Separator />

      {/* Confirmed materials (box rewards) */}
      {boxLayer.confirmedMaterials.size > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
            {t('ボックス確定報酬')}
          </p>
          <div className="flex flex-wrap gap-2">
            {Array.from(boxLayer.confirmedMaterials.entries()).slice(0, 20).map(([itemId, num]) => {
              // Find name/icon from prebuilt lookup map
              const meta = itemMetaMap.get(itemId)
              const name = meta?.name || ''
              const icon = meta?.icon
              return (
                <div
                  key={itemId}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                  style={{ background: 'var(--panel)', color: 'var(--text2)' }}
                >
                  {icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={icon} alt={name} className="w-4 h-4 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                  <span className="text-[10px] opacity-60">{name || `#${itemId}`}</span>
                  <span className="font-medium">×{num.toLocaleString()}</span>
                </div>
              )
            })}
            {boxLayer.confirmedMaterials.size > 20 && (
              <span className="text-[10px]" style={{ color: 'var(--text3)' }}>
                +{boxLayer.confirmedMaterials.size - 20}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Farming drops (solver result items) */}
      {solverResult && solverResult.result.items.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
            {t('周回ドロップ見込み')}
          </p>
          <div className="flex flex-wrap gap-2">
            {solverResult.result.items.slice(0, 12).map(item => (
              <div
                key={item.id}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                style={{ background: 'var(--panel)', color: 'var(--text2)' }}
              >
                <span className="text-[10px] opacity-60">{item.name}</span>
                <span className="font-medium">×{Math.floor(item.count).toLocaleString()}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px]" style={{ color: 'var(--text3)' }}>
            {t('確定ドロップ内訳注記')}
          </p>
        </div>
      )}

      {/* Shop allocation */}
      {shopAllocation.allocations.filter(a => a.allocated > 0).length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold" style={{ color: 'var(--text3)' }}>
            {t('交換所')} — {t('必要通貨N', { count: shopAllocation.totalCurrencyUsed.toLocaleString() })}
          </p>
          <div className="flex flex-wrap gap-2">
            {shopAllocation.allocations
              .filter(a => a.allocated > 0)
              .map((a, i) => {
                const name = a.shopItem.name || ''
                const icon = a.shopItem.icon
                return (
                  <div
                    key={i}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded"
                    style={{ background: 'var(--panel)', color: 'var(--text2)' }}
                  >
                    {icon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={icon} alt={name} className="w-4 h-4 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    )}
                    <span className="text-[10px] opacity-60">{name || `#${a.shopItem.itemId}`}</span>
                    <span className="font-medium">×{a.totalQty}</span>
                    {a.cappedByLimit && (
                      <span style={{ color: 'rgb(202,138,4)' }}>⚠</span>
                    )}
                  </div>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
