'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { FaChevronLeft } from 'react-icons/fa'
import { BondTracker } from '../../components/bond'
import { Link } from '../../components/common/link'

export default function BondPage() {
  const { t } = useTranslation('bond')

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-6">
          <div className="c-page-header">
            <div className="flex flex-col gap-2">
              <Link
                href="/"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px',
                  color: 'var(--text3)',
                  textDecoration: 'none',
                  fontWeight: 500,
                }}
              >
                <FaChevronLeft size={11} /> {t('back-to-dashboard', 'ダッシュボードへ戻る')}
              </Link>
              <div className="flex flex-col">
                <div className="c-page-en">BOND TRACKER</div>
                <h1 className="c-page-title">{t('title', '絆トラッカー')}</h1>
              </div>
            </div>
          </div>

          <BondTracker />
        </div>
      </div>
    </div>
  )
}
