'use client'

import {
  Box,
  SimpleGrid,
  Skeleton,
  VStack,
  Text,
  Heading,
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
  const { t } = useTranslation(['dashboard', 'common'])
  const { data: dashboardMeta, isLoading } = useDashboardMeta()

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <VStack align="stretch" spacing={10}>
          
          {/* Header */}
          <MotionBox 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="c-page-header"
          >
            <VStack align="start" spacing={0}>
              <div className="c-page-en">MASTER TERMINAL</div>
              <h1 className="c-page-title">{t('FGO周回ダッシュボード')}</h1>
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
              <VStack align="stretch" spacing={12}>
                {/* Top Section: Wizard & Progress */}
                <MotionBox variants={item}>
                  <SimpleGrid columns={[1, 1, 1, 2]} spacing={8} alignItems="start">
                    <VStack align="stretch" spacing={8}>
                       <FarmingWizard />
                       <EventSection events={dashboardMeta?.events || []} />
                    </VStack>
                    <VStack align="stretch" spacing={8}>
                      <ProgressSection />
                      <RecommendedQuest />
                    </VStack>
                  </SimpleGrid>
                </MotionBox>

                {/* History Graph Section */}
                <MotionBox variants={item}>
                  <HistoryGraph />
                </MotionBox>

                {/* Gacha Section */}
                <MotionBox variants={item}>
                  <GachaSection gachas={dashboardMeta?.gachas || []} />
                </MotionBox>

                {/* Recent Servants Section */}
                <MotionBox variants={item}>
                  <RecentServantSection servants={dashboardMeta?.recentServants || []} />
                </MotionBox>

                {/* Navigation Links (Quick Access) */}
                <MotionBox variants={item}>
                  <VStack align="stretch" spacing={6}>
                    <div className="u-section-header">
                      <h2 className="u-section-header-title">{t('クイックアクセス')}</h2>
                      <div className="u-section-header-line" />
                    </div>
                    <SimpleGrid columns={[1, 1, 2, 3]} spacing={6}>
                      <Link href="/material" className="c-card" display="block" p={6} _hover={{ textDecoration: 'none', transform: 'translateY(-2px)' }} transition="all 0.2s">
                        <VStack align="start" spacing={2}>
                          <div className="c-page-en" style={{ fontSize: '10px', color: 'var(--gold)' }}>MATERIAL</div>
                          <Heading size="md" color="var(--navy)">{t('common:必要素材計算')}</Heading>
                          <Text fontSize="sm" color="var(--text2)">{t('common:material-calculator-description')}</Text>
                        </VStack>
                      </Link>

                      <Link href="/farming/history" className="c-card" display="block" p={6} _hover={{ textDecoration: 'none', transform: 'translateY(-2px)' }} transition="all 0.2s">
                        <VStack align="start" spacing={2}>
                          <div className="c-page-en" style={{ fontSize: '10px', color: 'var(--gold)' }}>HISTORY</div>
                          <Heading size="md" color="var(--navy)">{t('common:計算履歴')}</Heading>
                          <Text fontSize="sm" color="var(--text2)">{t('common:計算履歴・進捗確認')}</Text>
                        </VStack>
                      </Link>

                      <Link href="/servants" className="c-card" display="block" p={6} _hover={{ textDecoration: 'none', transform: 'translateY(-2px)' }} transition="all 0.2s">
                        <VStack align="start" spacing={2}>
                          <div className="c-page-en" style={{ fontSize: '10px', color: 'var(--gold)' }}>SERVANTS</div>
                          <Heading size="md" color="var(--navy)">{t('common:サーヴァント一覧')}</Heading>
                          <Text fontSize="sm" color="var(--text2)">{t('common:servant-list-description')}</Text>
                        </VStack>
                      </Link>
                    </SimpleGrid>
                  </VStack>
                </MotionBox>
              </VStack>
            </motion.div>
          )}
        </VStack>
      </div>
    </div>
  )
}
