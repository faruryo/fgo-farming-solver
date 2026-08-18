'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FaBolt } from 'react-icons/fa'
import { Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { ItemIdentity } from '../common/ItemIdentity'
import { useDrops } from '../../hooks/use-drops'
import { useActiveCampaigns } from '../../hooks/use-active-campaigns'
import { useQuestEfficiencyOptions } from '../../hooks/use-quest-efficiency-options'
import {
  computeSingleQuestEfficiency,
  mergeGoals,
  REWARD_ITEM_PREFIX,
} from '../../lib/quest-efficiency'

const REWARD_NAMES: Record<string, string> = { qp: 'QP', bond: '基本絆P', exp: 'EXP' }

/**
 * クエスト詳細用: そのクエストの効率ポイント合計と素材別 contribution 内訳を表示。
 * 一覧と同じ localStorage 設定(所持数・目標・しきい値・トグル)を反映する。
 */
export const QuestEfficiencyCard: React.FC<{ questId: string }> = ({ questId }) => {
  const { t } = useTranslation('quests')
  const drops = useDrops()
  const { items: dropItems, isLoading } = drops
  const { activeCampaigns } = useActiveCampaigns(drops.campaigns)

  const {
    possession,
    materialResult,
    itemsRaw,
    stockEnabled,
    resolvedStockBuffer,
    shortageOnly,
    includeSkillStones,
    includePieces,
    denominator,
    includeQp,
    includeBond,
    includeExp,
  } = useQuestEfficiencyOptions()

  const eff = useMemo(() => {
    if (isLoading || !drops.quests?.length) return null
    return computeSingleQuestEfficiency(drops, questId, {
      possession,
      goals: mergeGoals(materialResult, itemsRaw, dropItems ?? []),
      activeCampaigns,
      shortageOnly,
      includeSkillStones,
      includePieces,
      stockBuffer: resolvedStockBuffer,
      stockEnabled,
      denominator,
      includeQp,
      includeBond,
      includeExp,
    })
  }, [drops, isLoading, questId, possession, materialResult, itemsRaw, dropItems, activeCampaigns, shortageOnly, includeSkillStones, includePieces, resolvedStockBuffer, stockEnabled, denominator, includeQp, includeBond, includeExp])

  if (isLoading || !eff || eff.score <= 0) return null
  const itemById = new Map((dropItems ?? []).map(i => [i.id, i]))

  return (
    <div className="c-card p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FaBolt style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>
              {t('efficiency-score', '効率ポイント')}
            </h3>
            <Tooltip>
              <TooltipTrigger
                className="flex-shrink-0 cursor-help"
                style={{ color: 'var(--text3)' }}
                aria-label={t('efficiency-score-help', '効率ポイントの説明')}
              >
                <Info size={14} />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[260px] text-left leading-relaxed">
                {t('efficiency-score-explanation', '所持数や目標必要数をもとに、どのクエストを周回すると効率的かを表すスコアです。数値が大きいほど、そのクエストを周回する価値が高いことを意味します。フィルターで 石の有無・分母(AP/ターン)・対象(不足/全部)・報酬加算(QP/絆/EXP) を切替できます。')}
              </TooltipContent>
            </Tooltip>
            {stockEnabled && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--accent)', color: 'var(--gold)', border: '1px solid var(--gold-dim)' }}
              >
                {t('ストック込み')}
              </span>
            )}
          </div>
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--gold)' }}>
            {eff.score.toFixed(2)}
          </span>
        </div>

        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--text3)' }}>
            {t('効率内訳')}
          </p>
          <div
            className="flex items-center gap-3 px-2 mb-1 text-[10px] font-semibold tracking-wide"
            style={{ color: 'var(--text3)' }}
          >
            <span className="w-7 flex-shrink-0" />
            <span className="flex-1 min-w-0">{t('breakdown-material', '素材')}</span>
            <span>{t('breakdown-weight', '重み')}</span>
            <span className="w-12 text-right">{t('breakdown-contribution', '寄与度')}</span>
          </div>
          <div className="flex flex-col gap-2">
            {eff.contributions.map(c => {
              const reward = c.itemId.startsWith(REWARD_ITEM_PREFIX)
                ? REWARD_NAMES[c.itemId.slice(REWARD_ITEM_PREFIX.length)]
                : undefined
              const item = reward ? undefined : itemById.get(c.itemId)
              const label = reward ?? item?.name ?? c.itemId
              return (
                <div
                  key={c.itemId}
                  className="flex items-center gap-3 p-2 rounded-md"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  {reward ? (
                    <span
                      className="w-7 h-7 flex-shrink-0 flex items-center justify-center rounded text-[9px] font-bold"
                      style={{ background: 'rgba(154,114,36,0.15)', color: 'var(--gold)' }}
                    >
                      {reward}
                    </span>
                  ) : (
                    <ItemIdentity icon={item?.icon} name={label} size={28} />
                  )}
                  <span className="text-xs font-bold truncate flex-1 min-w-0">{label}</span>
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--text3)' }}>
                    ×{c.weight}
                  </span>
                  <span className="text-xs font-bold tabular-nums w-12 text-right" style={{ color: 'var(--gold)' }}>
                    {c.weighted.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
