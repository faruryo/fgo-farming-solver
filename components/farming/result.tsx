'use client'

import React, { useState } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslation } from 'react-i18next'
import { useFarmingResult } from '../../hooks/use-farming-result'
import { Link } from '../common/link'
import { QuestTable } from './quest-table'
import { TweetIntent } from './tweet-intent'
import { ResultAccordion } from './result-accordion'
import { Item, Quest, DropRate } from '../../interfaces/fgodrop'
import { Result } from '../../interfaces/api'

type LocalResult = Omit<Result, 'items' | 'quests'> & {
  items: (Item & { count: number })[]
  quests: (Quest & { lap: number })[]
}

export type PageProps =
  | { apResult: LocalResult; lapResult: LocalResult; legacyResult?: undefined }
  | { legacyResult: LocalResult; apResult?: undefined; lapResult?: undefined }

const ResultPanel = ({ result }: { result: LocalResult }) => {
  const { t } = useTranslation(['farming', 'common'])
  const yen = Math.round(result.total_ap / 144 / 168 * 10000)
  const text = useFarmingResult(
    result.items as any,
    result.params.items as any,
    result.quests as any,
    result.total_lap,
    result.total_ap,
    yen
  )

  if (!result.quests || result.quests.length === 0) {
    return (
      <>
        <h1 className="text-2xl font-semibold my-8">{t('結果が見つかりませんでした')}</h1>
        <p>{t('新しく追加された素材のためドロップ率のデータがない場合などがあります。')}</p>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-12">
      <div className="c-stats" style={{ justifyContent: 'flex-start', gap: 24, paddingBottom: 8 }}>
        <Tooltip>
          <TooltipTrigger render={<div className="c-stat" style={{ cursor: 'help' }} />}>
            <div className="c-stat-num">{result.total_lap}</div>
            <div className="c-stat-label">周回数</div>
          </TooltipTrigger>
          <TooltipContent>{t('tooltip-total-lap')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<div className="c-stat" style={{ cursor: 'help' }} />}>
            <div className="c-stat-num">{result.total_ap}</div>
            <div className="c-stat-label">消費AP</div>
          </TooltipTrigger>
          <TooltipContent>{t('tooltip-total-ap')}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<div className="c-stat" style={{ cursor: 'help' }} />}>
            <div className="c-stat-num">¥{yen.toLocaleString()}</div>
            <div className="c-stat-label">{t('費用')}</div>
          </TooltipTrigger>
          <TooltipContent>{t('tooltip-cost')}</TooltipContent>
        </Tooltip>
      </div>

      <div className="c-card" style={{ padding: '24px', overflowX: 'auto' }}>
        <div className="c-settings-section-label" style={{ marginBottom: '16px', display: 'flex' }}>
          {t('クエスト周回数')}
        </div>
        <div className="flex items-center justify-center">
          <QuestTable items={result.items as any} quests={result.quests as any} dropRates={result.drop_rates as any} />
        </div>
      </div>

      <div className="flex justify-center">
        <TweetIntent text={text} />
      </div>

      <div className="c-card" style={{ padding: '24px' }}>
        <div className="c-settings-section-label" style={{ marginBottom: '16px', display: 'flex' }}>
          {t('アイテム獲得数')}
        </div>
        <ResultAccordion items={result.items as any} params={result.params as any} />
      </div>
    </div>
  )
}

export const Page = ({ apResult, lapResult, legacyResult }: PageProps) => {
  const { t } = useTranslation(['farming', 'common'])
  const [activeTab, setActiveTab] = useState<'ap' | 'lap'>('ap')

  if (legacyResult) {
    return (
      <div className="c-page">
        <div className="c-page-inner">
          <div className="c-page-header">
            <div>
              <div className="c-page-en">RESULT</div>
              <h1 className="c-page-title">{t('計算結果')}</h1>
            </div>
            <div className="c-result-actions">
              <Link href="/farming/history" className="c-back-btn">{t('計算履歴')}</Link>
            </div>
          </div>
          <ResultPanel result={legacyResult} />
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link href="/farming" className="c-back-btn">{t('戻って条件を調整する')}</Link>
          </div>
        </div>
      </div>
    )
  }

  const current = activeTab === 'ap' ? apResult! : lapResult!

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">RESULT</div>
            <h1 className="c-page-title">{t('計算結果')}</h1>
          </div>
          <div className="c-result-actions">
            <Link href="/farming/history" className="c-back-btn">{t('計算履歴')}</Link>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button
            className={`c-filter-toggle${activeTab === 'ap' ? ' active' : ''}`}
            onClick={() => setActiveTab('ap')}
          >
            消費AP 最小
          </button>
          <button
            className={`c-filter-toggle${activeTab === 'lap' ? ' active' : ''}`}
            onClick={() => setActiveTab('lap')}
          >
            周回数 最小
          </button>
        </div>

        <ResultPanel result={current} />

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link href="/farming" className="c-back-btn">{t('戻って条件を調整する')}</Link>
        </div>
      </div>
    </div>
  )
}
