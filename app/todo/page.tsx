'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/common/page-header'
import { TodoPage } from '../../components/todo'

export default function TodoRoutePage() {
  const { t } = useTranslation('todo')

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="flex flex-col gap-6">
          <PageHeader backLabel={t('ダッシュボードへ戻る')} en="TODO MANAGEMENT" title={t('TODO管理')} />

          <TodoPage />
        </div>
      </div>
    </div>
  )
}
