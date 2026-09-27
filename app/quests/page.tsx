'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/common/page-header'
import { QuestEfficiencyList } from '../../components/quests/QuestEfficiencyList'

export default function QuestsPage() {
  const { t } = useTranslation('quests')

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-6">
          <PageHeader backLabel={t('ダッシュボードへ戻る')} en="QUEST EFFICIENCY" title={t('クエスト効率')} />

          <QuestEfficiencyList />
        </div>
      </div>
    </div>
  )
}
