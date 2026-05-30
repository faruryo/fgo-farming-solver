'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { FaChevronLeft } from 'react-icons/fa'
import { Link } from '../../components/common/link'
import { QuestEfficiencyList } from '../../components/quests/QuestEfficiencyList'

export default function QuestsPage() {
  const { t } = useTranslation('quests')

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
                <FaChevronLeft size={11} /> {t('ダッシュボードへ戻る')}
              </Link>
              <div className="flex flex-col">
                <div className="c-page-en">QUEST EFFICIENCY</div>
                <h1 className="c-page-title">{t('クエスト効率')}</h1>
              </div>
            </div>
          </div>

          <QuestEfficiencyList />
        </div>
      </div>
    </div>
  )
}
