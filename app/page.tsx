'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Package } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDashboardMeta } from '../hooks/use-dashboard-meta'
import { useDrops } from '../hooks/use-drops'
import { PossessionModal } from '../components/common/PossessionModal'
import { EventSection } from '../components/dashboard/EventSection'
import { CampaignSection } from '../components/dashboard/CampaignSection'
import { GachaSection } from '../components/dashboard/GachaSection'
import { RecentServantSection } from '../components/dashboard/RecentServantSection'
import { ProgressSection } from '../components/dashboard/ProgressSection'
import { RecommendedQuest } from '../components/dashboard/RecommendedQuest'
import { FarmingWizard } from '../components/dashboard/FarmingWizard'
import { HistoryGraph } from '../components/dashboard/HistoryGraph'
import { NearGoalSection } from '../components/dashboard/NearGoalSection'
import { TodoWidget } from '../components/todo/TodoWidget'
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
  const { items: dropItems, isLoading: dropsLoading } = useDrops()
  const [possessionModalOpen, setPossessionModalOpen] = useState(false)

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
                  href="/farming/manual"
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
                <button
                  type="button"
                  onClick={() => setPossessionModalOpen(true)}
                  disabled={dropsLoading}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    background: 'var(--panel2)',
                    color: 'var(--text1)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: '1px solid var(--border)',
                    cursor: dropsLoading ? 'not-allowed' : 'pointer',
                    opacity: dropsLoading ? 0.6 : 1,
                    letterSpacing: '0.02em',
                  }}
                  title={t('possession-inventory', '所持アイテム')}
                >
                  <Package className="w-3.5 h-3.5" style={{ color: 'var(--gold)' }} />
                  {t('possession-inventory', '所持アイテム')}
                </button>
                <div
                  className="flex gap-3 ml-1 pl-2"
                  style={{ borderLeft: '1px solid var(--border)' }}
                >
                  <Link href="/material/result#advisor" style={{ fontSize: '12px', color: 'var(--text3)', textDecoration: 'none', fontWeight: 500 }}>
                    配布アドバイザー
                  </Link>
                  <Link href="/quests" style={{ fontSize: '12px', color: 'var(--text3)', textDecoration: 'none', fontWeight: 500 }}>
                    クエスト効率
                  </Link>
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

          <TodoWidget />

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Skeleton className="h-[300px] rounded-lg" />
              <Skeleton className="h-[300px] rounded-lg" />
            </div>
          ) : (
            <motion.div variants={container} initial="hidden" animate="show">
              <div className="flex flex-col gap-10">
                {/* Top Section: Event + Campaign (side-by-side on xl) */}
                <motion.div variants={item}>
                  <FarmingWizard />
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start mt-8">
                    <EventSection events={dashboardMeta?.events || []} />
                    <CampaignSection events={dashboardMeta?.events || []} />
                  </div>
                </motion.div>

                {/* Near Goal + Recommended Quest */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <NearGoalSection onOpenPossession={() => setPossessionModalOpen(true)} />
                  <RecommendedQuest />
                </div>

                {/* History Graph */}
                <motion.div variants={item}>
                  <HistoryGraph />
                </motion.div>

                {/* Progress (moved below history graph for better visual balance) */}
                <motion.div variants={item}>
                  <ProgressSection />
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

      <PossessionModal
        items={dropItems}
        open={possessionModalOpen}
        onOpenChange={setPossessionModalOpen}
      />
    </div>
  )
}
