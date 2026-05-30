'use client'

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { FaBolt } from 'react-icons/fa'
import { ItemIdentity } from '../common/ItemIdentity'
import { useDrops } from '../../hooks/use-drops'
import { useActiveCampaigns } from '../../hooks/use-active-campaigns'
import { useLocalStorage } from '../../hooks/use-local-storage'
import {
  computeSingleQuestEfficiency,
  DEFAULT_SURPLUS_THRESHOLD,
  SurplusThreshold,
} from '../../lib/quest-efficiency'

const parseGoals = (raw: Record<string, string | number | undefined>): Record<string, number> => {
  const out: Record<string, number> = {}
  for (const [id, v] of Object.entries(raw)) {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
    if (Number.isFinite(n) && n > 0) out[id] = n
  }
  return out
}

/**
 * クエスト詳細用: そのクエストの効率ポイント合計と素材別 contribution 内訳を表示。
 * 一覧と同じ localStorage 設定(所持数・目標・しきい値・トグル)を反映する。
 */
export const QuestEfficiencyCard: React.FC<{ questId: string }> = ({ questId }) => {
  const { t } = useTranslation('quests')
  const drops = useDrops()
  const { items: dropItems, isLoading } = drops
  const { activeCampaigns } = useActiveCampaigns(drops.campaigns)

  const [possession] = useLocalStorage<Record<string, number | undefined>>('posession', {})
  const [goalsRaw] = useLocalStorage<Record<string, string | number | undefined>>('items', {})
  const [threshold] = useLocalStorage<SurplusThreshold>(
    'efficiency/surplusThreshold',
    DEFAULT_SURPLUS_THRESHOLD,
  )
  const [shortageOnly] = useLocalStorage<boolean>('quests/efficiency/shortageOnly', true)
  const [includeSkillStones] = useLocalStorage<boolean>(
    'quests/efficiency/includeSkillStones',
    true,
  )

  const eff = useMemo(() => {
    if (isLoading || !drops.quests?.length) return null
    return computeSingleQuestEfficiency(drops, questId, {
      possession,
      goals: parseGoals(goalsRaw),
      activeCampaigns,
      shortageOnly,
      includeSkillStones,
      surplusThreshold: threshold,
    })
  }, [drops, isLoading, questId, possession, goalsRaw, activeCampaigns, shortageOnly, includeSkillStones, threshold])

  if (isLoading || !eff || eff.score <= 0) return null
  const itemById = new Map((dropItems ?? []).map(i => [i.id, i]))

  return (
    <div className="c-card p-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FaBolt style={{ color: 'var(--gold)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--navy)' }}>
              {t('効率ポイント')}
            </h3>
          </div>
          <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--gold)' }}>
            {eff.score.toFixed(2)}
          </span>
        </div>

        <div>
          <p className="text-xs mb-2" style={{ color: 'var(--text3)' }}>
            {t('効率内訳')}
          </p>
          <div className="flex flex-col gap-2">
            {eff.contributions.map(c => {
              const item = itemById.get(c.itemId)
              return (
                <div
                  key={c.itemId}
                  className="flex items-center gap-3 p-2 rounded-md"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                >
                  <ItemIdentity icon={item?.icon} name={item?.name ?? c.itemId} size={28} />
                  <span className="text-xs font-bold truncate flex-1 min-w-0">
                    {item?.name ?? c.itemId}
                  </span>
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
