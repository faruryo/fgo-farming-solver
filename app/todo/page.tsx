'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { FaChevronLeft } from 'react-icons/fa'
import { Link } from '../../components/common/link'
import { TodoPage } from '../../components/todo'

export default function TodoRoutePage() {
  const { t } = useTranslation('todo')

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
                <div className="c-page-en">TODO MANAGEMENT</div>
                <h1 className="c-page-title">{t('TODO管理')}</h1>
              </div>
            </div>
          </div>

          <TodoPage />
        </div>
      </div>
    </div>
  )
}
