'use client'

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
import { Skeleton } from '@/components/ui/skeleton'

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
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
        <div className="flex flex-col gap-6">

          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="c-page-header"
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-col">
                <div className="c-page-en">MASTER TERMINAL</div>
                <h1 className="c-page-title">{t('FGO周回ダッシュボード')}</h1>
              </div>
              <div className="flex gap-2 flex-wrap items-center">
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
                <div
                  className="flex gap-3 ml-1 pl-2"
                  style={{ borderLeft: '1px solid var(--border)' }}
                >
                  <Link href="/farming/history" style={{ fontSize: '12px', color: 'var(--text3)', textDecoration: 'none', fontWeight: 500 }}>
                    計算履歴
                  </Link>
                  <Link href="/servants" style={{ fontSize: '12px', color: 'var(--text3)', textDecoration: 'none', fontWeight: 500 }}>
                    サーヴァント
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Skeleton className="h-[300px] rounded-lg" />
              <Skeleton className="h-[300px] rounded-lg" />
            </div>
          ) : (
            <motion.div variants={container} initial="hidden" animate="show">
              <div className="flex flex-col gap-10">
                {/* Top Section: Event & Progress */}
                <motion.div variants={item}>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
                    <div className="flex flex-col gap-8">
                      <FarmingWizard />
                      <EventSection events={dashboardMeta?.events || []} />
                    </div>
                    <ProgressSection />
                  </div>
                </motion.div>

                {/* Near Goal + Recommended Quest */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <NearGoalSection />
                  <RecommendedQuest />
                </div>

                {/* History Graph */}
                <motion.div variants={item}>
                  <HistoryGraph />
                </motion.div>

                {/* Recent Servants */}
                <motion.div variants={item}>
                  <RecentServantSection servants={dashboardMeta?.recentServants || []} />
                </motion.div>

                {/* Gacha */}
                <motion.div variants={item}>
                  <GachaSection gachas={dashboardMeta?.gachas || []} />
                </motion.div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
