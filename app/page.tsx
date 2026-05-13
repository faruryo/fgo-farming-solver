'use client'

import {
  Box,
  SimpleGrid,
  Skeleton,
  VStack,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useDashboardMeta } from '../hooks/use-dashboard-meta'
import { EventSection } from '../components/dashboard/EventSection'
import { GachaSection } from '../components/dashboard/GachaSection'
import { RecentServantSection } from '../components/dashboard/RecentServantSection'
import { ProgressSection } from '../components/dashboard/ProgressSection'
import { RecommendedQuest } from '../components/dashboard/RecommendedQuest'
import { FarmingWizard } from '../components/dashboard/FarmingWizard'
import { HistoryGraph } from '../components/dashboard/HistoryGraph'
import { NearGoalSection } from '../components/dashboard/NearGoalSection'
import { Link } from '../components/common/link'

const MotionBox = motion.create(Box)

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
}

export default function HomePage() {
  const { t } = useTranslation(['dashboard'])
  const { data: dashboardMeta, isLoading } = useDashboardMeta()

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <VStack align="stretch" spacing={6}>
          
          {/* Header */}
          <MotionBox
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="c-page-header"
          >
            <VStack align="start" spacing={2}>
              <VStack align="start" spacing={0}>
                <div className="c-page-en">MASTER TERMINAL</div>
                <h1 className="c-page-title">{t('FGO周回ダッシュボード')}</h1>
              </VStack>
              <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
                <Link
                  href="/material"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 14px',
                    background: 'var(--gold)',
                    color: '#1a1a2e',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 700,
                    textDecoration: 'none',
                    letterSpacing: '0.02em',
                  }}
                >
                  素材計算 →
                </Link>
                <Link
                  href="/farming"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '6px 14px',
                    background: 'var(--panel2)',
                    color: 'var(--text1)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    letterSpacing: '0.02em',
                  }}
                >
                  周回ソルバー →
                </Link>
                <Box
                  display="flex"
                  gap={3}
                  ml={1}
                  pl={2}
                  borderLeft="1px solid"
                  borderLeftColor="var(--border)"
                >
                  <Link
                    href="/farming/history"
                    style={{
                      fontSize: '12px',
                      color: 'var(--text3)',
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    計算履歴
                  </Link>
                  <Link
                    href="/servants"
                    style={{
                      fontSize: '12px',
                      color: 'var(--text3)',
                      textDecoration: 'none',
                      fontWeight: 500,
                    }}
                  >
                    サーヴァント
                  </Link>
                </Box>
              </Box>
            </VStack>
          </MotionBox>

          {isLoading ? (
            <SimpleGrid columns={[1, 1, 2]} spacing={8}>
              <Skeleton height="300px" borderRadius="lg" />
              <Skeleton height="300px" borderRadius="lg" />
            </SimpleGrid>
          ) : (
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
            >
              <VStack align="stretch" spacing={10}>
                {/* Top Section: Event & Progress (balanced 2-col) */}
                <MotionBox variants={item}>
                  <SimpleGrid columns={[1, 1, 1, 2]} spacing={8} alignItems="start">
                    <VStack align="stretch" spacing={8}>
                      <FarmingWizard />
                      <EventSection events={dashboardMeta?.events || []} />
                    </VStack>
                    <ProgressSection />
                  </SimpleGrid>
                </MotionBox>

                {/* Near Goal + Recommended Quest: PCでは横並び */}
                <SimpleGrid columns={[1, 1, 2]} spacing={6} alignItems="start">
                  <NearGoalSection />
                  <RecommendedQuest />
                </SimpleGrid>

                {/* History Graph Section */}
                <MotionBox variants={item}>
                  <HistoryGraph />
                </MotionBox>

                {/* Recent Servants Section */}
                <MotionBox variants={item}>
                  <RecentServantSection servants={dashboardMeta?.recentServants || []} />
                </MotionBox>

                {/* Gacha Section */}
                <MotionBox variants={item}>
                  <GachaSection gachas={dashboardMeta?.gachas || []} />
                </MotionBox>
              </VStack>
            </motion.div>
          )}
        </VStack>
      </div>
    </div>
  )
}
