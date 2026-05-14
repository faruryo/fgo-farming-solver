"use client";

import React, { useEffect, useState } from 'react'
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
import { useTranslation } from 'react-i18next'
import { Link } from '../../../components/common/link'
import { motion } from 'framer-motion'
import { FaExternalLinkAlt, FaHistory } from 'react-icons/fa'
import { FarmingHistoryChart, HistoryItem } from '../../../components/farming/FarmingHistoryChart'

const OBJECTIVE_BADGE: Record<string, string> = {
  ap:   'AP MIN',
  lap:  'LAP MIN',
  both: 'AP+LAP',
}

export default function HistoryPage() {
  const { t } = useTranslation(['farming', 'common', 'dashboard'])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/farming/history')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setHistory(data) })
      .catch(err => console.error(err))
      .finally(() => setLoading(false))
  }, [])

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

          {history.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              <Box className="c-card" p={6}>
                <FarmingHistoryChart history={history} />
              </Box>
            </motion.div>
          )}

          <Box className="c-card" overflowX="auto">
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th color="var(--gold-dim)">{t('日時')}</Th>
                  <Th color="var(--gold-dim)">{t('目的')}</Th>
                  <Th color="var(--gold)" isNumeric>合計消費AP</Th>
                  <Th color="var(--gold)" isNumeric>合計周回数</Th>
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
                    <Td isNumeric color="var(--text2)">
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
