'use client'

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { useTranslation } from 'react-i18next'
import { RecentServant } from '../../lib/master-data/types'
import { motion } from 'framer-motion'
import { Link } from '../common/link'

interface RecentServantSectionProps {
  servants: RecentServant[]
}

export const RecentServantSection: React.FC<RecentServantSectionProps> = ({ servants }) => {
  const { t } = useTranslation(['dashboard', 'common'])

  if (servants.length === 0) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="u-section-header">
        <h2 className="u-section-header-title">{t('最近追加されたサーヴァント')}</h2>
        <div className="u-section-header-line" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {servants.map((servant) => (
          <Link key={servant.id} href={`/material#svt-${servant.id}`}>
            <motion.div
              whileHover={{ y: -4 }}
              className="c-card relative overflow-hidden rounded-md p-3 h-full"
              style={{ background: 'var(--panel2)' }}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="u-face-frame w-[60px] h-[60px]">
                  <img src={servant.face} alt={servant.name} />
                </div>
                <div className="flex flex-col items-center">
                  <p className="text-xs font-bold text-center truncate w-full" style={{ color: 'var(--text)' }}>
                    {servant.name}
                  </p>
                  <div className="flex gap-0.5">
                    {Array.from({ length: servant.rarity }).map((_, i) => (
                      <span key={i} style={{ color: 'var(--gold)', fontSize: '10px' }}>★</span>
                    ))}
                  </div>
                </div>
                <Badge variant="secondary" className="text-[9px] rounded-full px-2">
                  {new Date(servant.releasedAt * 1000).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })}
                </Badge>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  )
}
