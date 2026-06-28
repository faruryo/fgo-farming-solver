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
import { Badge } from '@/components/ui/badge'
import { Item, Quest } from '../../interfaces/fgodrop'
import { Result } from '../../interfaces/api'
import { formatDate } from '../../lib/format-date'

type LocalResult = Omit<Result, 'items' | 'quests'> & {
  items: (Item & { count: number })[]
  quests: (Quest & { lap: number })[]
}

export type PageProps =
  | {
      apResult: LocalResult
      lapResult: LocalResult
      legacyResult?: undefined
      createdAt?: string
      /** 目標B(ストック込み)の AP最小結果。batch_id ペアのときのみ設定。 */
      stockApResult?: LocalResult
      /** 目標B(ストック込み)の 周回数最小結果。batch_id ペアのときのみ設定。 */
      stockLapResult?: LocalResult
    }
  | { legacyResult: LocalResult; apResult?: undefined; lapResult?: undefined; createdAt?: string; stockApResult?: undefined; stockLapResult?: undefined }

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
      {result.params?.stockIncluded === true && (
        <div>
          <Badge variant="outline" className="text-[10px]">
            {t('ストック込み')}
          </Badge>
        </div>
      )}

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

type ApLapTabsProps = {
  ap: LocalResult
  lap: LocalResult
  apYenVal: number
  lapYenVal: number
}

// AP/LAP 内部タブ(消費AP最小/周回数最小の切り替え)。Page の外で定義してコンポーネント再生成を防ぐ。
const ApLapTabs = ({ ap, lap, apYenVal, lapYenVal }: ApLapTabsProps) => {
  const { t } = useTranslation(['farming', 'common'])
  return (
    <Tabs defaultValue="ap">
      <TabsList className="mb-6">
        <TabsTrigger value="ap">消費AP 最小</TabsTrigger>
        <TabsTrigger value="lap">周回数 最小</TabsTrigger>
      </TabsList>
      <TabsContent value="ap">
        <ResultPanel
          result={ap}
          progressPanel={
            <ResultStatsBar
              totalLap={ap.total_lap}
              totalAp={ap.total_ap}
              yen={apYenVal}
              tooltips={{ lap: t('tooltip-total-lap'), ap: t('tooltip-total-ap'), cost: t('tooltip-cost') }}
            />
          }
        />
      </TabsContent>
      <TabsContent value="lap">
        <ResultPanel
          result={lap}
          progressPanel={
            <ResultStatsBar
              totalLap={lap.total_lap}
              totalAp={lap.total_ap}
              yen={lapYenVal}
              tooltips={{ lap: t('tooltip-total-lap'), ap: t('tooltip-total-ap'), cost: t('tooltip-cost') }}
            />
          }
        />
      </TabsContent>
    </Tabs>
  )
}

export const Page = ({ apResult, lapResult, legacyResult, createdAt, stockApResult, stockLapResult }: PageProps) => {
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
            <Link href="/farming/manual" className="c-back-btn">{t('戻って条件を調整する')}</Link>
          </div>
        </div>
      </div>
    )
  }

  const apYen = Math.round(apResult!.total_ap / 144 / 168 * 10000)
  const lapYen = Math.round(lapResult!.total_ap / 144 / 168 * 10000)
  const stockApYen = stockApResult ? Math.round(stockApResult.total_ap / 144 / 168 * 10000) : 0
  const stockLapYen = stockLapResult ? Math.round(stockLapResult.total_ap / 144 / 168 * 10000) : 0

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

        {stockApResult && stockLapResult ? (
          // バッチペア: 必要分 / +ストック の外側タブ
          <Tabs defaultValue="required">
            <TabsList className="mb-6">
              <TabsTrigger value="required">必要分</TabsTrigger>
              <TabsTrigger value="stock">
                +ストック
                <Badge variant="outline" className="ml-1.5 text-[9px] px-1" style={{ color: 'var(--gold)', borderColor: 'var(--gold-dim)' }}>
                  ストック込み
                </Badge>
              </TabsTrigger>
            </TabsList>
            <TabsContent value="required">
              <ApLapTabs ap={apResult!} lap={lapResult!} apYenVal={apYen} lapYenVal={lapYen} />
            </TabsContent>
            <TabsContent value="stock">
              <ApLapTabs ap={stockApResult} lap={stockLapResult} apYenVal={stockApYen} lapYenVal={stockLapYen} />
            </TabsContent>
          </Tabs>
        ) : (
          <ApLapTabs ap={apResult!} lap={lapResult!} apYenVal={apYen} lapYenVal={lapYen} />
        )}

        <div className="mt-12">
          <HistoryGraph />
        </div>

        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <Link href="/farming/manual" className="c-back-btn">{t('戻って条件を調整する')}</Link>
        </div>
      </div>
    </div>
  )
}
