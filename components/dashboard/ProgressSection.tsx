'use client'

import React, { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useTranslation } from 'react-i18next'
import { CHART_COLORS } from '../../constants/chart-colors'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { ChaldeaState } from '../../hooks/create-chaldea-state'
import NextLink from 'next/link'
import { Button } from '@/components/ui/button'

export const ProgressSection: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common'])
  const [chaldea] = useLocalStorage<ChaldeaState>('material', {})
  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 0)
    return () => clearTimeout(timer)
  }, [])

  const stats = useMemo(() => {
    if (!chaldea || Object.keys(chaldea).length === 0) return []

    const breakdown = {
      ascension: { current: 0, total: 0 },
      skill: { current: 0, total: 0 },
      append: { current: 0, total: 0 },
    }

    Object.values(chaldea).forEach(servant => {
      if (servant.disabled) return
      const asc = servant.targets.ascension
      if (asc && !asc.disabled) {
        asc.ranges.forEach(r => { breakdown.ascension.current += r.start; breakdown.ascension.total += r.end })
      }
      const sk = servant.targets.skill
      if (sk && !sk.disabled) {
        sk.ranges.forEach(r => { breakdown.skill.current += (r.start - 1); breakdown.skill.total += (r.end - 1) })
      }
      const ap = servant.targets.appendSkill
      if (ap && !ap.disabled) {
        ap.ranges.forEach(r => { breakdown.append.current += r.start; breakdown.append.total += r.end })
      }
    })

    return [
      { name: t('再臨'), value: breakdown.ascension.current, total: breakdown.ascension.total, color: CHART_COLORS.ascension },
      { name: t('スキル'), value: breakdown.skill.current, total: breakdown.skill.total, color: CHART_COLORS.skill },
      { name: t('アペンド'), value: breakdown.append.current, total: breakdown.append.total, color: CHART_COLORS.append },
    ].filter(d => d.total > 0)
  }, [chaldea, t])

  if (!stats || stats.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="u-section-header">
          <h2 className="u-section-header-title">{t('あなたの育成進捗')}</h2>
          <div className="u-section-header-line" />
        </div>
        <div className="u-fgo-card p-8 text-center rounded-xl" style={{ background: 'var(--panel2)' }}>
          <div className="flex flex-col items-center gap-4">
            <p style={{ color: 'var(--text2)', fontWeight: 'bold' }}>{t('目標が設定されていません')}</p>
            <p className="text-sm" style={{ color: 'var(--text3)' }}>
              {t('育成素材計算機で目標レベルを設定すると、全体の進捗がグラフで表示されます。')}
            </p>
            <NextLink href="/material">
              <Button size="sm" className="mt-2 bg-yellow-500 hover:bg-yellow-400 text-black">
                {t('common:育成素材計算機へ')}
              </Button>
            </NextLink>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('あなたの育成進捗')}</h2>
        <div className="u-section-header-line" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map(stat => {
          const percent = stat.total > 0 ? Math.round((stat.value / stat.total) * 100) : 0
          const chartData = [
            { name: 'Completed', value: stat.value },
            { name: 'Remaining', value: Math.max(0, stat.total - stat.value) },
          ]
          return (
            <div key={stat.name} className="u-fgo-card relative p-2 rounded-md" style={{ background: 'var(--panel2)' }}>
              <div className="flex flex-col items-center gap-1">
                <div className="relative h-[60px] w-full">
                  {isMounted && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie data={chartData} cx="50%" cy="50%" innerRadius={18} outerRadius={27} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270} isAnimationActive={false}>
                          <Cell fill={stat.color} stroke="none" />
                          <Cell fill="rgba(0,0,0,0.1)" stroke="none" />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                    <p className="text-xs font-bold" style={{ color: 'var(--navy)' }}>{percent}%</p>
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <p style={{ fontSize: '11px', color: 'var(--text2)', fontWeight: 600 }}>{stat.name}</p>
                  <p style={{ fontSize: '9px', color: 'var(--text3)' }}>{stat.value} / {stat.total}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
