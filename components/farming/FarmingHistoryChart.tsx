"use client";

import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { FaCalendarAlt } from 'react-icons/fa'

export interface HistoryItem {
  id: string
  objective: string
  total_ap: number
  total_lap: number
  // JSON string (QuestSelection). NULL for rows saved before the feature.
  quest_selection?: string | null
  // 余剰ストック込みの目標で解いたか(json_extract 由来: 1 / null)。
  stock_included?: number | boolean | null
  // 2目標(A/B)のペアを紐付ける UUID。NULL = 単独行。
  batch_id?: string | null
  created_at: string
}

export type StockFilter = 'normal' | 'stock'

interface FarmingHistoryChartProps {
  history: HistoryItem[]
  height?: number | string
  // ストック込み/通常の絞り込み(トグルのハイライト用)。一覧と同期させるため親が所有する(controlled)。
  // 親は history をこの種別に絞り込んだ上で渡す前提。
  stockFilter?: StockFilter
  // 両種別が履歴に存在しトグルを出すべきか。省略時はトグル非表示(ダッシュボードの簡易表示など)。
  showStockToggle?: boolean
  onStockFilterChange?: (f: StockFilter) => void
}

type ChartTab = 'ap' | 'lap'
type PeriodRange = '1m' | '3m' | '6m' | '1y' | 'all'

// 余剰ストック込みの目標で解いた履歴か。混在すると合計APの桁が変わり回帰(予測線)が破綻するため、
// 一覧・グラフともこのフラグで片方に絞る。
export const isStock = (h: HistoryItem) => !!h.stock_included

// 履歴から「両種別が混在するか」と「既定の絞り込み(最新履歴の種別)」を導出。
export const deriveStockMeta = (history: HistoryItem[]): { bothExist: boolean; defaultFilter: StockFilter } => {
  let hasStock = false
  let hasNormal = false
  let mostRecent: HistoryItem | null = null
  for (const h of history) {
    if (isStock(h)) hasStock = true
    else hasNormal = true
    if (!mostRecent || new Date(h.created_at) > new Date(mostRecent.created_at)) mostRecent = h
  }
  return {
    bothExist: hasStock && hasNormal,
    defaultFilter: mostRecent && isStock(mostRecent) ? 'stock' : 'normal',
  }
}

const CHART_CONFIG: Record<ChartTab, { label: string; dataKey: string; color: string; gradId: string }> = {
  ap:  { label: '消費AP推移',  dataKey: '消費AP',  color: '#9a7224', gradId: 'gradFarmingAP' },
  lap: { label: '周回数推移',  dataKey: '周回数',  color: '#4a6888', gradId: 'gradFarmingLap' },
}

const PERIOD_OPTIONS: { label: string; value: PeriodRange }[] = [
  { label: '1ヶ月', value: '1m' },
  { label: '3ヶ月', value: '3m' },
  { label: '6ヶ月', value: '6m' },
  { label: '1年', value: '1y' },
  { label: '全期間', value: 'all' },
]

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const timestamp = Number(label);
    const dateStr = isNaN(timestamp) ? label : new Date(timestamp).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return (
      <div
        className="rounded-md p-3 text-sm"
        style={{ background: 'rgba(18,28,48,0.95)', border: '1px solid var(--gold-dim)', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      >
        <p className="text-xs mb-1" style={{ color: 'var(--gold-dim)' }}>{dateStr}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} className="font-bold text-sm" style={{ color: entry.color }}>
            {entry.name}: {entry.value.toLocaleString()}
            {entry.name.includes('予測') && ' (予想)'}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Linear regression helper
const calculateRegression = (data: { x: number; y: number }[]) => {
  const n = data.length;
  if (n < 2) return null;

  // Normalize x to prevent precision issues with large timestamps
  const minX = data[0].x;
  const normData = data.map(p => ({ x: p.x - minX, y: p.y }));

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const p of normData) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  }
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  // Return adjusted intercept for original X values
  return { slope, intercept: intercept - slope * minX };
};

export const FarmingHistoryChart: React.FC<FarmingHistoryChartProps> = ({
  history,
  height,
  stockFilter = 'normal',
  showStockToggle = false,
  onStockFilterChange,
}) => {
  const { t } = useTranslation(['dashboard', 'common'])
  const [chartTab, setChartTab] = useState<ChartTab>('ap')
  const [period, setPeriod] = useState<PeriodRange>('3m')
  const [isMounted, setIsMounted] = useState(false)
  const [responsiveHeight, setResponsiveHeight] = useState(180)

  useEffect(() => {
    const update = () => setResponsiveHeight(window.innerWidth >= 768 ? 220 : 180)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const { chartData, predictionDate, xDomain } = useMemo(() => {
    if (!history.length) return { chartData: [], predictionDate: null, xDomain: ['auto', 'auto'] as ['auto', 'auto'] };

    // history は親で既にストック込み/通常のどちらかに絞り込まれている(回帰も同一種別内で行われ予測線が破綻しない)。
    const scoped = history;

    const now = new Date();
    const startTime = new Date();
    if (period === '1m') startTime.setMonth(now.getMonth() - 1);
    else if (period === '3m') startTime.setMonth(now.getMonth() - 3);
    else if (period === '6m') startTime.setMonth(now.getMonth() - 6);
    else if (period === '1y') startTime.setFullYear(now.getFullYear() - 1);
    else startTime.setFullYear(2015); // Fallback to "all"

    const filtered = scoped
      .filter(h => new Date(h.created_at) >= startTime && h.total_ap > 0)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (filtered.length === 0) return { chartData: [], predictionDate: null, xDomain: ['auto', 'auto'] as ['auto', 'auto'] };

    const dataKey = CHART_CONFIG[chartTab].dataKey;
    const baseData = filtered.map(h => ({
      timestamp: new Date(h.created_at).getTime(),
      [dataKey]: chartTab === 'ap' ? Math.round(h.total_ap) : Math.round(h.total_lap),
    }));

    // Prediction logic - Use ALL available history (same stock type) for more stable regression
    const allValidHistory = scoped
      .filter(h => h.total_ap > 0)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    const regressionData = allValidHistory.map(h => ({ 
      x: new Date(h.created_at).getTime(), 
      y: chartTab === 'ap' ? Math.round(h.total_ap) : Math.round(h.total_lap) 
    }));
    
    const reg = calculateRegression(regressionData);
    let predTimestamp: number | null = null;
    const finalChartData = baseData.map(d => ({ ...d })); 

    if (reg && reg.slope < 0) {
      predTimestamp = -reg.intercept / reg.slope;
      
      const rangeMs = now.getTime() - startTime.getTime();
      const maxFutureMs = rangeMs * 0.4;
      const displayEnd = Math.min(predTimestamp, now.getTime() + maxFutureMs);
      
      // Start prediction from the last actual data point
      const lastPoint = finalChartData[finalChartData.length - 1];
      if (lastPoint) {
        (lastPoint as any)[`${dataKey}予測`] = lastPoint[dataKey];
      }

      // Add the final prediction point
      finalChartData.push({
        timestamp: displayEnd,
        [`${dataKey}予測`]: Math.max(0, reg.slope * displayEnd + reg.intercept),
      } as any);
    }

    const startX = period === 'all' ? baseData[0].timestamp : startTime.getTime();
    const endX = predTimestamp && predTimestamp > now.getTime() 
      ? Math.min(predTimestamp, now.getTime() + (now.getTime() - startX) * 0.4)
      : now.getTime();

    return { 
      chartData: finalChartData, 
      predictionDate: predTimestamp ? new Date(predTimestamp) : null,
      xDomain: [startX, endX] as [number, number]
    };
  }, [history, period, chartTab]);

  const cfg = CHART_CONFIG[chartTab];

  // ストック込み/通常トグル。データ不足の早期returnでも表示し、片方が0〜1件でも
  // もう片方へ切り替えられる(=操作不能に陥らない)ようにする。
  const stockToggle = showStockToggle ? (
    <div className="flex w-fit self-start rounded-md overflow-hidden" style={{ background: 'var(--panel)' }}>
      {([['normal', '通常'], ['stock', 'ストック込み']] as [StockFilter, string][]).map(([val, label]) => (
        <button
          key={val}
          onClick={() => onStockFilterChange?.(val)}
          className="text-[10px] px-3 py-1 border-y border-r first:border-l transition-colors"
          style={{
            background: stockFilter === val ? 'var(--gold)' : 'transparent',
            color: stockFilter === val ? 'white' : 'var(--text2)',
            borderColor: 'var(--border)',
            fontWeight: stockFilter === val ? 'bold' : 'normal',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  ) : null

  if (!history.length || chartData.length < 2) {
    return (
      <div className="flex flex-col gap-4">
        {stockToggle}
        <div className="p-8 text-center rounded-xl" style={{ color: 'var(--gold-dim)', background: 'var(--panel2)' }}>
          <p className="text-sm">{t('履歴が不足しているためグラフを表示できません')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between flex-wrap gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {stockToggle}
          <div className="flex rounded-md overflow-hidden" style={{ background: 'var(--panel)' }}>
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className="text-[10px] px-3 py-1 border-y border-r first:border-l transition-colors"
              style={{
                background: period === opt.value ? 'var(--gold)' : 'transparent',
                color: period === opt.value ? 'white' : 'var(--text2)',
                borderColor: 'var(--border)',
                fontWeight: period === opt.value ? 'bold' : 'normal',
              }}
            >
              {opt.label}
            </button>
          ))}
          </div>
        </div>

        <div className="flex gap-1">
          {(['ap', 'lap'] as ChartTab[]).map(tab => (
            <Button
              key={tab}
              size="sm"
              variant={chartTab === tab ? 'default' : 'ghost'}
              onClick={() => setChartTab(tab)}
              className="text-[10px] px-3 h-7 rounded-md"
              style={{
                background: chartTab === tab ? (tab === 'ap' ? 'var(--gold)' : 'var(--steel)') : 'transparent',
                color: chartTab === tab ? 'white' : 'var(--text2)',
              }}
            >
              {CHART_CONFIG[tab].label}
            </Button>
          ))}
        </div>
      </div>

      <div className="p-4 rounded-xl relative" style={{ background: 'var(--panel2)' }}>
        {predictionDate && (
          <div className="absolute top-2 right-4 z-10">
            <Tooltip>
              <TooltipTrigger render={<span />}>
                <div className="flex items-center gap-1" style={{ color: 'var(--gold-dim)' }}>
                  <FaCalendarAlt size={10} />
                  <span className="text-[10px] font-bold">
                    予想: {predictionDate.toLocaleDateString('ja-JP')}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent>現在のペースでの目標達成予想日</TooltipContent>
            </Tooltip>
          </div>
        )}

        {isMounted && (
          <ResponsiveContainer width="100%" height={height || responsiveHeight} minWidth={0} minHeight={0}>
            <AreaChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={cfg.gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,104,136,0.12)" vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={xDomain}
                tickFormatter={(val) => new Date(val).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                tick={{ fill: 'var(--text3)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text3)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={cfg.dataKey}
                stroke={cfg.color}
                strokeWidth={3}
                fill={`url(#${cfg.gradId})`}
                dot={{ r: 4, fill: 'var(--bg)', stroke: cfg.color, strokeWidth: 2 }}
                activeDot={{ r: 6, fill: cfg.color, stroke: 'white', strokeWidth: 2 }}
                animationDuration={1000}
                isAnimationActive={true}
              />
              <Area
                type="monotone"
                dataKey={`${cfg.dataKey}予測`}
                stroke={cfg.color}
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="transparent"
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
