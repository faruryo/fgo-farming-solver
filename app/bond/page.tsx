'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { BondTracker } from '../../components/bond'
import { PageHeader } from '../../components/common/page-header'

export default function BondPage() {
  const { t } = useTranslation('bond')

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-6">
          <PageHeader backLabel={t('back-to-dashboard', 'ダッシュボードへ戻る')} en="BOND TRACKER" title={t('title', '絆トラッカー')} />

          <BondTracker />
        </div>
      </div>
    </div>
  )
}
