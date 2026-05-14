import React, { useState, useEffect } from 'react'
import {
  Box,
  VStack,
  HStack,
  Spinner,
  Button,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { FaChartLine } from 'react-icons/fa'
import { Link } from '../common/link'
import { FarmingHistoryChart, HistoryItem } from '../farming/FarmingHistoryChart'

export const HistoryGraph: React.FC = () => {
  const { t } = useTranslation(['dashboard', 'common'])
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
      <Box className="u-fgo-card" p={8} display="flex" justifyContent="center">
        <Spinner color="var(--gold)" />
      </Box>
    )
  }

  if (history.length < 2) return null

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
          <Link href="/farming/history">
             <Button size="xs" variant="ghost" color="var(--gold-dim)" fontSize="10px">
               {t('common:すべて見る')}
             </Button>
          </Link>
        </HStack>
      </HStack>

      <FarmingHistoryChart history={history} />
    </VStack>
  )
}
