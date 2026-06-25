'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMasterLevel } from '../../hooks/use-master-level'
import { computeApBudget } from '../../lib/ap-budget'

export const ResultStat = ({
  totalLap,
  totalAp,
}: {
  totalLap: number
  totalAp: number
}) => {
  const [showSum, setShowSum] = useState(false)
  const { t } = useTranslation('farming')
  // AP→聖晶石→円換算は ap-budget に統一（最大AP基準。固定144換算は廃止）。
  const { maxAp } = useMasterLevel()
  const budget = computeApBudget(totalAp, maxAp)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex items-center gap-2">
        <Checkbox
          id="result-stat-show"
          checked={showSum}
          onCheckedChange={(checked) => setShowSum(!!checked)}
        />
        <label htmlFor="result-stat-show" className="text-sm cursor-pointer">
          {t('表示')}
        </label>
      </div>
      <div className="flex flex-wrap">
        {[
          { label: '周回数', value: totalLap },
          { label: 'AP', value: totalAp },
          { label: '聖晶石', value: budget.quartzCount },
          { label: '費用', value: `¥${budget.yen.toLocaleString()}` },
        ].map(({ label, value }) => (
          <div key={label} className="c-stat m-5">
            <div className="c-stat-label">{t(label)}</div>
            {showSum ? (
              <div className="c-stat-num">{value}</div>
            ) : (
              <Skeleton className="h-8 w-16 mt-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
