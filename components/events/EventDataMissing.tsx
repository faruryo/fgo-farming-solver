'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { FaChevronLeft } from 'react-icons/fa'
import { Link } from '../common/link'

interface Props {
  eventId?: number
}

export const EventDataMissing: React.FC<Props> = ({ eventId }) => {
  const { t } = useTranslation('events')

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-6">
          <div className="c-page-header">
            <div className="flex flex-col gap-2">
              <Link
                href="/events"
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
                <FaChevronLeft size={11} /> {t('イベント一覧へ戻る')}
              </Link>
              <div className="flex flex-col">
                <div className="c-page-en">EVENT PLANNER</div>
                <h1 className="c-page-title">{t('ロト計画')}</h1>
              </div>
            </div>
          </div>

          <div
            className="rounded-lg p-8 text-center"
            style={{ background: 'var(--panel2)', border: '1px solid var(--border)' }}
          >
            <div className="text-4xl mb-4">📦</div>
            <p className="font-semibold mb-2" style={{ color: 'var(--text1)' }}>
              {t('データ未取得')}
            </p>
            <p className="text-sm" style={{ color: 'var(--text3)' }}>
              {eventId
                ? t('このイベントのデータはまだ取り込まれていません', { eventId })
                : t('イベントが見つかりません')}
            </p>
            <p className="text-xs mt-3" style={{ color: 'var(--text3)' }}>
              {t('データ未取得の説明')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
