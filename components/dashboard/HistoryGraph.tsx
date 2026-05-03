import React, { useState, useEffect, useMemo } from 'react'
import {
  Box,
  VStack,
  HStack,
  Text,
  Spinner,
  Button,
  useBreakpointValue,
} from '@chakra-ui/react'
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
import { FaChartLine } from 'react-icons/fa'
import { Link } from '../common/link'

interface HistoryItem {
  id: string
  objective: 'ap' | 'lap' | 'both'
  total_ap: number
  total_lap: number
  created_at: string
}

interface TooltipPayload {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <Box
        bg="rgba(18, 28, 48, 0.95)"
        border="1px solid var(--gold-dim)"
        borderRadius="md"
        p={3}
        boxShadow="0 4px 12px rgba(0,0,0,0.4)"
        backdropFilter="blur(4px)"
      >
        <Text color="var(--gold-dim)" fontSize="xs" mb={1}>{label}</Text>
        {payload.map((entry) => (
          <Text key={entry.name} color={entry.color} fontWeight="bold" fontSize="sm">
            {entry.name}: {entry.value.toLocaleString()}
          </Text>
        ))}
      </Box>
    )
  }
  return null
}

type ChartTab = 'ap' | 'lap'

const CHART_CONFIG: Record<ChartTab, { label: string; dataKey: string; color: string; gradId: string }> = {
  ap:  { label: '消費AP推移',  dataKey: '消費AP',  color: '#9a7224', gradId: 'gradDashAP' },
  lap: { label: '周回数推移',  dataKey: '周回数',  color: '#4a6888', gradId: 'gradDashLap' },
}

export const HistoryGraph: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common'])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [chartTab, setChartTab] = useState<ChartTab>('ap')
  const [isMounted, setIsMounted] = useState(false)
  const chartHeight = useBreakpointValue({ base: 180, md: 220 })

  useEffect(() => {
    setIsMounted(true)
    fetch('/api/farming/history')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setHistory(data) })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const chartData = useMemo(() => [...history]
    .reverse()
    .filter(h => h.total_ap > 0)
    .map(h => ({
      date: new Date(h.created_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
      消費AP: Math.round(h.total_ap),
      周回数: Math.round(h.total_lap),
    })), [history])

  const cfg = CHART_CONFIG[chartTab]

  if (loading) {
    return (
      <Box className="u-fgo-card" p={8} display="flex" justifyContent="center">
        <Spinner color="var(--gold)" />
      </Box>
    )
  }

  if (chartData.length < 2) return null

  return (
    <VStack align="stretch" spacing={6}>
      <HStack justify="space-between" align="center">
        <div className="u-section-header" style={{ marginBottom: 0, flex: 1 }}>
          <h2 className="u-section-header-title">
            <Box as={FaChartLine} display="inline-block" mr={2} mb={1} />
            {t('計算履歴の推移')}
          </h2>
          <div className="u-section-header-line" />
        </div>
        <HStack spacing={2}>
          {(['ap', 'lap'] as ChartTab[]).map(tab => (
            <Button
              key={tab}
              size="xs"
              variant={chartTab === tab ? 'solid' : 'outline'}
              colorScheme={tab === 'ap' ? 'yellow' : 'blue'}
              onClick={() => setChartTab(tab)}
              fontSize="10px"
              px={3}
            >
              {CHART_CONFIG[tab].label}
            </Button>
          ))}
          <Link href="/farming/history">
             <Button size="xs" variant="ghost" color="var(--gold-dim)" fontSize="10px">
               {t('common:すべて見る')}
             </Button>
          </Link>
        </HStack>
      </HStack>

      <Box className="u-fgo-card" p={4} bg="var(--panel2)" borderRadius="xl">
        {isMounted && chartHeight && (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id={cfg.gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={cfg.color} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,104,136,0.12)" vertical={false} />
              <XAxis
                dataKey="date"
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
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Box>
    </VStack>
  )
}
