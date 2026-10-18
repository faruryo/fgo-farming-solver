'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../common/page-header'

interface Props {
  eventId?: number
}

export const EventDataMissing: React.FC<Props> = ({ eventId }) => {
  const { t } = useTranslation('events')

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-6">
          <PageHeader backLabel={t('イベント一覧へ戻る')} backHref="/events" en="EVENT PLANNER" title={t('ロト計画')} />

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
