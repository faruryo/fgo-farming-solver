'use client'

import React, { useEffect, useState } from 'react'
import {
  Box,
  Container,
  Heading,
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
import { useTranslation } from 'react-i18next'
import { Link } from '../../../components/common/link'
import { motion } from 'framer-motion'
import { FaExternalLinkAlt, FaHistory, FaChartLine } from 'react-icons/fa'

type HistoryItem = {
  id: string
  objective: string
  target_items: string
  total_ap: number
  total_lap: number
  created_at: string
}

export default function HistoryPage() {
  const { t } = useTranslation(['farming', 'common'])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/farming/history')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setHistory(data)
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  // Filter out failed results (ap=0) and use integers for display
  const apTrend = history.length > 0
    ? [...history].reverse().filter(h => h.total_ap > 0).map(h => Math.round(h.total_ap))
    : []
  const maxAp = apTrend.length > 0 ? Math.max(...apTrend) : 1
  const minAp = apTrend.length > 0 ? Math.min(...apTrend) : 0
  const apRange = maxAp - minAp || 1

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
              <Heading as="h1" className="c-page-title" display="flex" alignItems="center">
                <Box as={FaHistory} mr={3} size="24px" color="var(--gold)" />
                {t('common:計算履歴')}
              </Heading>
            </VStack>
          </HStack>

          {history.length > 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Box className="c-card" p={6}>
                <HStack mb={4}>
                  <Box as={FaChartLine} color="var(--gold)" />
                  <Text fontWeight="bold" color="var(--gold)">{t('AP推移')}</Text>
                </HStack>
                <Box h="150px" w="100%" position="relative">
                  <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">
                    {/* Fill area under the line */}
                    <polygon
                      fill="var(--gold)"
                      fillOpacity={0.15}
                      points={[
                        ...apTrend.map((ap, i) => {
                          const x = apTrend.length === 1 ? 50 : i * 100 / (apTrend.length - 1)
                          const y = 100 - ((ap - minAp) / apRange * 90 + 5)
                          return `${x},${y}`
                        }),
                        `${apTrend.length === 1 ? 50 : 100},100`,
                        '0,100',
                      ].join(' ')}
                    />
                    <polyline
                      fill="none"
                      stroke="var(--gold)"
                      strokeWidth="1.5"
                      points={apTrend.map((ap, i) => {
                        const x = apTrend.length === 1 ? 50 : i * 100 / (apTrend.length - 1)
                        const y = 100 - ((ap - minAp) / apRange * 90 + 5)
                        return `${x},${y}`
                      }).join(' ')}
                      strokeLinejoin="round"
                    />
                    {apTrend.map((ap, i) => {
                      const x = apTrend.length === 1 ? 50 : i * 100 / (apTrend.length - 1)
                      const y = 100 - ((ap - minAp) / apRange * 90 + 5)
                      return (
                        <circle key={i} cx={x} cy={y} r="1.5"
                          fill="var(--bg)" stroke="var(--gold)" strokeWidth="1" />
                      )
                    })}
                  </svg>
                  <HStack justify="space-between" mt={2} fontSize="10px" color="var(--gold-dim)">
                    <Text>{new Date(history[history.length - 1].created_at).toLocaleDateString()}</Text>
                    <Text>{new Date(history[0].created_at).toLocaleDateString()}</Text>
                  </HStack>
                </Box>
              </Box>
            </motion.div>
          )}

          <Box className="c-card" overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th color="var(--gold-dim)">{t('日時')}</Th>
                  <Th color="var(--gold-dim)">{t('目的')}</Th>
                  <Th color="var(--gold-dim)" isNumeric>{t('合計AP')}</Th>
                  <Th color="var(--gold-dim)" isNumeric>{t('合計周回数')}</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <Tbody>
                {history.map((item) => (
                  <Tr key={item.id} _hover={{ bg: 'rgba(154,114,36,0.05)' }}>
                    <Td fontSize="sm" color="var(--text)">
                      {new Date(item.created_at).toLocaleString()}
                    </Td>
                    <Td>
                      <Badge colorScheme={item.objective === 'ap' ? 'blue' : 'orange'} variant="outline" fontSize="10px">
                        {item.objective === 'ap' ? 'AP MIN' : 'LAP MIN'}
                      </Badge>
                    </Td>
                    <Td isNumeric fontWeight="bold" color="var(--gold)">
                      {Math.round(item.total_ap).toLocaleString()}
                    </Td>
                    <Td isNumeric color="var(--text2)">
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
