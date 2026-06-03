'use client'

import React from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type ResultStatsBarProps = {
  totalLap: number
  totalAp: number
  yen: number
  tooltips?: { lap: string; ap: string; cost: string }
}

// 結果ページのモード別スタッツ(周回数 / 消費AP / 費用)。
// 旧 ProgressReportPanel の stats ブロックを切り出したもの。
export const ResultStatsBar: React.FC<ResultStatsBarProps> = ({
  totalLap,
  totalAp,
  yen,
  tooltips,
}) => (
  <div className="c-card p-3 text-sm">
    <div className="c-stats" style={{ justifyContent: 'flex-start', gap: 20 }}>
      <Tooltip>
        <TooltipTrigger render={<div className="c-stat" style={{ cursor: 'help' }} />}>
          <div className="c-stat-num">{totalLap}</div>
          <div className="c-stat-label">周回数</div>
        </TooltipTrigger>
        {tooltips && <TooltipContent>{tooltips.lap}</TooltipContent>}
      </Tooltip>
      <Tooltip>
        <TooltipTrigger render={<div className="c-stat" style={{ cursor: 'help' }} />}>
          <div className="c-stat-num">{totalAp}</div>
          <div className="c-stat-label">消費AP</div>
        </TooltipTrigger>
        {tooltips && <TooltipContent>{tooltips.ap}</TooltipContent>}
      </Tooltip>
      <Tooltip>
        <TooltipTrigger render={<div className="c-stat" style={{ cursor: 'help' }} />}>
          <div className="c-stat-num">¥{yen.toLocaleString()}</div>
          <div className="c-stat-label">費用</div>
        </TooltipTrigger>
        {tooltips && <TooltipContent>{tooltips.cost}</TooltipContent>}
      </Tooltip>
    </div>
  </div>
)
