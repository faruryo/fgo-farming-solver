'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { FarmingPurposeSelector } from '../common/FarmingPurposeSelector'
import type { FarmingPurpose } from '../../lib/farming-purpose'

/** 不足を求めている周回目的（押すとヘッダーと同じ選択を開く）と、「素材全体の効率を見る」のときの注記。 */
export const EventPurposeIndicator: React.FC<{ purpose: FarmingPurpose }> = ({ purpose }) => {
  const { t } = useTranslation('events')
  return (
    <div data-testid="event-purpose" className="flex flex-wrap items-center gap-2">
      <FarmingPurposeSelector compact />
      {purpose === 'all' && (
        <span className="text-[11px]" style={{ color: 'var(--text3)' }}>
          {t('event-purpose-all-note', '不足は今の育成で計算')}
        </span>
      )}
    </div>
  )
}
