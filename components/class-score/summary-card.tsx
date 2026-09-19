'use client'

import React from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Sparkles } from 'lucide-react'

export type ClassScoreSummaryProps = {
  targetCount: number
  completedCount: number
  totalMaterials: Record<string, number>
}

const getMaterialAmount = (
  materials: Record<string, number>,
  id: string,
): number => {
  const val: unknown = Reflect.get(materials, id)
  return typeof val === 'number' ? val : 0
}

type SummaryMetricsProps = {
  totalMaterials: Record<string, number>
}

const SummaryMetrics: React.FC<SummaryMetricsProps> = ({ totalMaterials }) => {
  const { t } = useTranslation('classScore')
  const totalQp = getMaterialAmount(totalMaterials, '1')
  const totalSand = getMaterialAmount(totalMaterials, '50')
  const totalNovaTorch = getMaterialAmount(totalMaterials, '51')
  const totalMorningTorch = getMaterialAmount(totalMaterials, '52')
  const totalPolarTorch = getMaterialAmount(totalMaterials, '53')

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
      <div className="bg-muted/40 p-3 rounded-lg">
        <span className="text-muted-foreground block mb-0.5">
          {t('summary.totalQp', '合計必要QP')}
        </span>
        <span className="font-bold text-base text-foreground">
          {(totalQp / 100000000).toFixed(2)}
          <span className="text-xs font-normal ml-0.5">億</span>
        </span>
      </div>
      <div className="bg-muted/40 p-3 rounded-lg">
        <span className="text-muted-foreground block mb-0.5">
          {t('summary.totalSand', '星光の砂')}
        </span>
        <span className="font-bold text-base text-foreground font-mono">
          {totalSand.toLocaleString()}
        </span>
      </div>
      <div className="bg-muted/40 p-3 rounded-lg">
        <span className="text-muted-foreground block mb-0.5">
          {t('summary.torches', 'トーチ合計')}
        </span>
        <span className="font-bold text-base text-foreground">
          {totalNovaTorch + totalMorningTorch + totalPolarTorch}
          <span className="text-xs font-normal ml-0.5">個</span>
        </span>
        <span className="block text-[10px] text-muted-foreground mt-0.5">
          新{totalNovaTorch} / 明{totalMorningTorch} / 極{totalPolarTorch}
        </span>
      </div>
      <div className="bg-muted/40 p-3 rounded-lg flex flex-col justify-between">
        <div>
          <span className="text-muted-foreground block mb-0.5">
            {t('summary.actionDesc', '周回ソルバー反映')}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {t('summary.syncNote', '計算時に素材目標へ自動合算されます')}
          </span>
        </div>
        <Link
          href="/material/result"
          className="text-xs text-primary hover:underline font-semibold inline-flex items-center gap-0.5 mt-1"
        >
          <span>{t('summary.goToResult', '必要数一覧を見る')}</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}

export const ClassScoreSummary: React.FC<ClassScoreSummaryProps> = ({
  targetCount,
  completedCount,
  totalMaterials,
}) => {
  const { t } = useTranslation('classScore')

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-sm">
            {t('summary.title', '目標集計サマリー')}
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            {t('summary.targetCount', '目標')}:{' '}
            <strong className="text-primary font-bold text-sm">
              {targetCount}
            </strong>{' '}
            / 9
          </span>
          {completedCount > 0 && (
            <span className="text-muted-foreground">
              {t('summary.completedCount', '解放済')}:{' '}
              <strong className="text-emerald-500 font-bold text-sm">
                {completedCount}
              </strong>
            </span>
          )}
        </div>
      </div>

      {targetCount === 0 ? (
        <div className="text-center py-4 text-xs text-muted-foreground">
          {t(
            'summary.empty',
            '目標に設定されているクラススコアはありません。下のカードから目標にするクラスを選んでください。',
          )}
        </div>
      ) : (
        <SummaryMetrics totalMaterials={totalMaterials} />
      )}
    </div>
  )
}
