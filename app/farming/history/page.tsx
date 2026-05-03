'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Container,
  Text,
  VStack,
  HStack,
  Spinner,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  IconButton,
  Tooltip,
} from '@chakra-ui/react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { Link } from '../../../components/common/link'
import { motion } from 'framer-motion'
import { FaExternalLinkAlt, FaHistory } from 'react-icons/fa'

type HistoryItem = {
  id: string
  objective: string
  target_items: string
  total_ap: number
  total_lap: number
  created_at: string
}

type TooltipPayloadEntry = { name: string; value: number; color: string }

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(18,28,48,0.97)',
      border: '1px solid rgba(154,114,36,0.4)',
      borderRadius: 4,
      padding: '8px 12px',
      fontSize: 12,
    }}>
      <div style={{ color: 'rgba(200,180,140,0.7)', marginBottom: 4 }}>{label}</div>
      {payload.map(entry => (
        <div key={entry.name} style={{ color: entry.color, fontWeight: 600 }}>
          {entry.name}: {entry.value.toLocaleString()}
        </div>
      ))}
    </div>
  )
}

const OBJECTIVE_BADGE: Record<string, string> = {
  ap:   'AP MIN',
  lap:  'LAP MIN',
  both: 'AP+LAP',
}

type ChartTab = 'ap' | 'lap'

const CHART_CONFIG: Record<ChartTab, { label: string; dataKey: string; color: string; gradId: string }> = {
  ap:  { label: '消費AP推移',  dataKey: '消費AP',  color: '#9a7224', gradId: 'gradHistAP' },
  lap: { label: '周回数推移',  dataKey: '周回数',  color: '#4a6888', gradId: 'gradHistLap' },
}

export default function HistoryPage() {
  const { t } = useTranslation(['farming', 'common'])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [chartTab, setChartTab] = useState<ChartTab>('ap')
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 0)
    fetch('/api/farming/history')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setHistory(data) })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
    return () => clearTimeout(timer)
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
      <Container maxW="container.lg" py={20}>
        <VStack spacing={8}>
          <Spinner size="xl" color="var(--gold)" />
          <Text color="var(--gold-dim)">Loading history...</Text>
        </VStack>
      </Container>
    )
  }

  return (
    <Box className="c-page">
      <Container maxW="container.lg" className="c-page-inner">
        <VStack align="stretch" spacing={8}>
          <HStack justify="space-between">
            <VStack align="start" spacing={0}>
              <Text className="c-page-en" letterSpacing="0.2em">FARMING HISTORY</Text>
              <Text as="h1" className="c-page-title" display="flex" alignItems="center">
                <Box as={FaHistory} mr={3} color="var(--gold)" />
                {t('common:計算履歴')}
              </Text>
            </VStack>
          </HStack>

          {chartData.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <Box className="c-card" p={6}>
                <HStack spacing={2} mb={4}>
                  {(['ap', 'lap'] as ChartTab[]).map(tab => (
                    <button
                      key={tab}
                      className={`c-filter-toggle${chartTab === tab ? ' active' : ''}`}
                      onClick={() => setChartTab(tab)}
                      style={{ fontSize: 11, padding: '4px 12px' }}
                    >
                      {CHART_CONFIG[tab].label}
                    </button>
                  ))}
                </HStack>

                {isMounted && (
                  <ResponsiveContainer width="100%" height={180} minHeight={0}>
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id={cfg.gradId} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={cfg.color} stopOpacity={0.35} />
                          <stop offset="95%" stopColor={cfg.color} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(74,104,136,0.18)" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: 'rgba(200,218,240,0.45)', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: `${cfg.color}b0`, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        width={36}
                      />
                      <RechartsTooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey={cfg.dataKey}
                        stroke={cfg.color}
                        strokeWidth={2}
                        fill={`url(#${cfg.gradId})`}
                        dot={{ r: 3, fill: '#121c30', stroke: cfg.color, strokeWidth: 1.5 }}
                        activeDot={{ r: 5, fill: cfg.color }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </motion.div>
          )}

          <Box className="c-card" overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th color="var(--gold-dim)">{t('日時')}</Th>
                  <Th color="var(--gold-dim)">{t('目的')}</Th>
                  <Th color={chartTab === 'ap' ? 'var(--gold)' : 'var(--gold-dim)'} isNumeric>合計消費AP</Th>
                  <Th color={chartTab === 'lap' ? 'var(--gold)' : 'var(--gold-dim)'} isNumeric>合計周回数</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {history.map(item => (
                  <Tr key={item.id} _hover={{ bg: 'rgba(154,114,36,0.05)' }}>
                    <Td fontSize="sm" color="var(--text)">
                      {new Date(item.created_at).toLocaleString()}
                    </Td>
                    <Td>
                      <Badge
                        colorScheme={item.objective === 'ap' ? 'orange' : item.objective === 'lap' ? 'blue' : 'purple'}
                        variant="outline"
                        fontSize="10px"
                      >
                        {OBJECTIVE_BADGE[item.objective] ?? item.objective}
                      </Badge>
                    </Td>
                    <Td isNumeric fontWeight={chartTab === 'ap' ? 'bold' : 'normal'} color={chartTab === 'ap' ? 'var(--gold)' : 'var(--text2)'}>
                      {Math.round(item.total_ap).toLocaleString()}
                    </Td>
                    <Td isNumeric fontWeight={chartTab === 'lap' ? 'bold' : 'normal'} color={chartTab === 'lap' ? 'var(--gold)' : 'var(--text2)'}>
                      {Math.round(item.total_lap).toLocaleString()}
                    </Td>
                    <Td>
                      <Tooltip label={t('結果を見る')}>
                        <IconButton
                          as={Link}
                          href={`/farming/results/${item.id}`}
                          aria-label="View result"
                          icon={<FaExternalLinkAlt />}
                          size="sm"
                          variant="ghost"
                          color="var(--gold-dim)"
                          _hover={{ color: 'var(--gold)', bg: 'transparent' }}
                        />
                      </Tooltip>
                    </Td>
                  </Tr>
                ))}
                {history.length === 0 && (
                  <Tr>
                    <Td colSpan={5} textAlign="center" py={10} color="var(--gold-dim)">
                      {t('履歴がありません')}
                    </Td>
                  </Tr>
                )}
              </Tbody>
            </Table>
          </Box>

          <Box textAlign="center">
            <Link href="/farming" className="c-back-btn">
              {t('計算機に戻る')}
            </Link>
          </Box>
        </VStack>
      </Container>
    </Box>
  )
}
