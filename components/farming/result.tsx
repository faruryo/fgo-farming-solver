'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useFarmingResult } from '../../hooks/use-farming-result'
import { Link } from '../common/link'
import { QuestTable } from './quest-table'
import { TweetIntent } from './tweet-intent'
import { ResultAccordion } from './result-accordion'
import { HistoryGraph } from '../dashboard/HistoryGraph'
import { ResultStatsBar } from './ResultStatsBar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { Item, Quest } from '../../interfaces/fgodrop'
import { Result } from '../../interfaces/api'
import { formatDate } from '../../lib/format-date'

type LocalResult = Omit<Result, 'items' | 'quests'> & {
  items: (Item & { count: number })[]
  quests: (Quest & { lap: number })[]
}

export type PageProps =
  | { apResult: LocalResult; lapResult: LocalResult; legacyResult?: undefined; createdAt?: string }
  | { legacyResult: LocalResult; apResult?: undefined; lapResult?: undefined; createdAt?: string }

const ResultPanel = ({
  result,
  progressPanel,
}: {
  result: LocalResult
  progressPanel?: React.ReactNode
}) => {
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
      {progressPanel}

      <div className="c-card p-6 overflow-x-auto">
        <div className="c-settings-section-label mb-4 flex">
          {t('クエスト周回数')}
        </div>
        <div className="flex items-center justify-center">
          <QuestTable items={result.items as any} quests={result.quests as any} dropRates={result.drop_rates as any} />
        </div>
      </div>

      <div className="flex justify-center">
        <TweetIntent text={text} />
      </div>

      <div className="c-card p-6">
        <div className="c-settings-section-label mb-4 flex">
          {t('アイテム獲得数')}
        </div>
        <ResultAccordion items={result.items as any} params={result.params as any} />
      </div>
    </div>
  )
}

export const Page = ({ apResult, lapResult, legacyResult, createdAt }: PageProps) => {
  const { t } = useTranslation(['farming', 'common'])
  const formattedDate = formatDate(createdAt)

  if (legacyResult) {
    return (
      <div className="c-page">
        <div className="c-page-inner">
          <div className="c-page-header">
            <div>
              <div className="c-page-en">RESULT</div>
              <h1 className="c-page-title">
                {t('計算結果')}
                {formattedDate && (
                  <span className="text-xs font-normal text-muted-foreground ml-3" style={{ opacity: 0.8 }}>
                    (計算日時: {formattedDate})
                  </span>
                )}
              </h1>
            </div>
            <div className="c-result-actions">
              <Link href="/farming/history" className="c-back-btn">{t('計算履歴')}</Link>
            </div>
          </div>
          <ResultPanel
            result={legacyResult}
            progressPanel={
              <ResultStatsBar
                totalLap={legacyResult.total_lap}
                totalAp={legacyResult.total_ap}
                yen={Math.round(legacyResult.total_ap / 144 / 168 * 10000)}
                tooltips={{ lap: t('tooltip-total-lap'), ap: t('tooltip-total-ap'), cost: t('tooltip-cost') }}
              />
            }
          />
          <div className="mt-12">
            <HistoryGraph />
          </div>
          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <Link href="/farming" className="c-back-btn">{t('戻って条件を調整する')}</Link>
          </div>
        </div>
      </div>
    )
  }

  const apYen = Math.round(apResult!.total_ap / 144 / 168 * 10000)
  const lapYen = Math.round(lapResult!.total_ap / 144 / 168 * 10000)

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">RESULT</div>
            <h1 className="c-page-title">
              {t('計算結果')}
              {formattedDate && (
                <span className="text-xs font-normal text-muted-foreground ml-3" style={{ opacity: 0.8 }}>
                  (計算日時: {formattedDate})
                </span>
              )}
            </h1>
          </div>
          <Link href="/farming/history" className="c-back-btn">{t('計算履歴')}</Link>
        </div>

        <Tabs defaultValue="ap">
          <TabsList className="mb-6">
            <TabsTrigger value="ap">消費AP 最小</TabsTrigger>
            <TabsTrigger value="lap">周回数 最小</TabsTrigger>
          </TabsList>
          <TabsContent value="ap">
            <ResultPanel
              result={apResult!}
              progressPanel={
                <ResultStatsBar
                  totalLap={apResult!.total_lap}
                  totalAp={apResult!.total_ap}
                  yen={apYen}
                  tooltips={{ lap: t('tooltip-total-lap'), ap: t('tooltip-total-ap'), cost: t('tooltip-cost') }}
                />
              }
            />
          </TabsContent>
          <TabsContent value="lap">
            <ResultPanel
              result={lapResult!}
              progressPanel={
                <ResultStatsBar
                  totalLap={lapResult!.total_lap}
                  totalAp={lapResult!.total_ap}
                  yen={lapYen}
                  tooltips={{ lap: t('tooltip-total-lap'), ap: t('tooltip-total-ap'), cost: t('tooltip-cost') }}
                />
              }
            />
          </TabsContent>
        </Tabs>

        <div className="mt-12">
          <HistoryGraph />
        </div>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link href="/farming" className="c-back-btn">{t('戻って条件を調整する')}</Link>
        </div>
      </div>
    </div>
  )
}
