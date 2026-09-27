'use client'

import React, { useState, useSyncExternalStore } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { Item, Quest } from '../../interfaces/fgodrop'
import { Result } from '../../interfaces/api'
import { formatDate } from '../../lib/format-date'
import { toast } from 'sonner'

const emptySubscribe = () => () => {}
const useIsMounted = () => {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

type LocalResult = Omit<Result, 'items' | 'quests'> & {
  items: (Item & { count: number })[]
  quests: (Quest & { lap: number })[]
}

type CommonProps = {
  createdAt?: string
  isOwner?: boolean
  isPublic?: boolean
  resultId?: string
}

export type PageProps =
  | (CommonProps & {
      apResult: LocalResult
      lapResult: LocalResult
      legacyResult?: undefined
      /** 目標B(ストック込み)の AP最小結果。batch_id ペアのときのみ設定。 */
      stockApResult?: LocalResult
      /** 目標B(ストック込み)の 周回数最小結果。batch_id ペアのときのみ設定。 */
      stockLapResult?: LocalResult
    })
  | (CommonProps & {
      legacyResult: LocalResult
      apResult?: undefined
      lapResult?: undefined
      stockApResult?: undefined
      stockLapResult?: undefined
    })

const ResultPanel = ({
  result,
  progressPanel,
  hideStockBadge,
  isPublic,
}: {
  result: LocalResult
  progressPanel?: React.ReactNode
  // バッチペアの外側タブ([必要分|+ストック])配下では「ストック込み」がタブで明示されるため
  // パネル内バッジは重複。抑制する。
  hideStockBadge?: boolean
  isPublic?: boolean
}) => {
  const { t } = useTranslation(['farming', 'common'])
  const yen = Math.round(result.total_ap / 144 / 168 * 10000)
  const text = useFarmingResult(
    result.items,
    result.params.items,
    result.quests,
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
      {result.params?.stockIncluded === true && !hideStockBadge && (
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
          <QuestTable items={result.items} quests={result.quests} dropRates={result.drop_rates} />
        </div>
      </div>

      {isPublic !== false && (
        <div className="flex justify-center">
          <TweetIntent text={text} />
        </div>
      )}

      <div className="c-card p-6">
        <div className="c-settings-section-label mb-4 flex">
          {t('アイテム獲得数')}
        </div>
        <ResultAccordion items={result.items as any} params={result.params} />
      </div>
    </div>
  )
}

type ApLapTabsProps = {
  ap: LocalResult
  lap: LocalResult
  apYenVal: number
  lapYenVal: number
  hideStockBadge?: boolean
  isPublic?: boolean
}

// AP/LAP 内部タブ(消費AP最小/周回数最小の切り替え)。Page の外で定義してコンポーネント再生成を防ぐ。
const ApLapTabs = ({ ap, lap, apYenVal, lapYenVal, hideStockBadge, isPublic }: ApLapTabsProps) => {
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
          hideStockBadge={hideStockBadge}
          isPublic={isPublic}
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
          hideStockBadge={hideStockBadge}
          isPublic={isPublic}
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

const ResultVisibilityControl = ({
  isPublic,
  onVisibilityChange,
  isUpdating,
}: {
  isPublic: boolean
  onVisibilityChange: (next: boolean) => void
  isUpdating: boolean
}) => {
  const { t } = useTranslation(['farming', 'common'])
  return (
    <div className="flex items-center gap-2 py-1 px-2.5 rounded border border-border bg-card/60 text-xs">
      <span className="font-medium text-muted-foreground">
        {t('farming-result-visibility-setting-label', '公開設定')}:
      </span>
      <Badge variant={isPublic ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
        {isPublic
          ? t('farming-result-status-public', '公開中')
          : t('farming-result-status-private', '非公開')}
      </Badge>
      <Switch
        checked={isPublic}
        disabled={isUpdating}
        onCheckedChange={onVisibilityChange}
        size="sm"
        className="gold-switch ml-1"
        aria-label={t('farming-result-visibility-toggle-aria', '公開・非公開の切り替え')}
      />
    </div>
  )
}

const ResultHeader = ({
  formattedDate,
  isOwner,
  isPublic,
  onVisibilityChange,
  isUpdating,
}: {
  formattedDate: string
  isOwner?: boolean
  isPublic: boolean
  onVisibilityChange: (next: boolean) => void
  isUpdating: boolean
}) => {
  const { t } = useTranslation(['farming', 'common'])
  return (
    <div className="c-page-header flex flex-wrap items-center justify-between gap-3">
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
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {isOwner && (
          <ResultVisibilityControl
            isPublic={isPublic}
            onVisibilityChange={onVisibilityChange}
            isUpdating={isUpdating}
          />
        )}
        <Link href="/farming/history" className="c-back-btn">{t('計算履歴')}</Link>
      </div>
    </div>
  )
}

const LegacyResultView = ({
  result,
  isPublic,
}: {
  result: LocalResult
  isPublic: boolean
}) => {
  const { t } = useTranslation(['farming', 'common'])
  return (
    <ResultPanel
      result={result}
      isPublic={isPublic}
      progressPanel={
        <ResultStatsBar
          totalLap={result.total_lap}
          totalAp={result.total_ap}
          yen={Math.round(result.total_ap / 144 / 168 * 10000)}
          tooltips={{ lap: t('tooltip-total-lap'), ap: t('tooltip-total-ap'), cost: t('tooltip-cost') }}
        />
      }
    />
  )
}

const BatchResultView = ({
  apResult,
  lapResult,
  stockApResult,
  stockLapResult,
  isPublic,
}: {
  apResult: LocalResult
  lapResult: LocalResult
  stockApResult?: LocalResult
  stockLapResult?: LocalResult
  isPublic: boolean
}) => {
  const apYen = Math.round((apResult.total_ap / 144 / 168) * 10000)
  const lapYen = Math.round((lapResult.total_ap / 144 / 168) * 10000)
  const stockApYen = stockApResult ? Math.round((stockApResult.total_ap / 144 / 168) * 10000) : 0
  const stockLapYen = stockLapResult ? Math.round((stockLapResult.total_ap / 144 / 168) * 10000) : 0

  if (stockApResult && stockLapResult) {
    return (
      <Tabs defaultValue="required">
        <TabsList className="mb-6">
          <TabsTrigger value="required">必要分</TabsTrigger>
          <TabsTrigger value="stock">+ストック</TabsTrigger>
        </TabsList>
        <TabsContent value="required">
          <ApLapTabs ap={apResult} lap={lapResult} apYenVal={apYen} lapYenVal={lapYen} hideStockBadge isPublic={isPublic} />
        </TabsContent>
        <TabsContent value="stock">
          <ApLapTabs ap={stockApResult} lap={stockLapResult} apYenVal={stockApYen} lapYenVal={stockLapYen} hideStockBadge isPublic={isPublic} />
        </TabsContent>
      </Tabs>
    )
  }

  return <ApLapTabs ap={apResult} lap={lapResult} apYenVal={apYen} lapYenVal={lapYen} isPublic={isPublic} />
}

const useResultVisibility = (resultId?: string, initialPublic = true) => {
  const { t } = useTranslation(['farming', 'common'])
  const [isPublicState, setIsPublicState] = useState(initialPublic)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleVisibilityChange = async (nextPublic: boolean) => {
    if (!resultId) return
    setIsUpdating(true)
    setIsPublicState(nextPublic)
    try {
      const res = await fetch(`/api/farming/results/${resultId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: nextPublic }),
      })
      if (!res.ok) {
        throw new Error('Failed to update')
      }
    } catch (e) {
      console.error(e)
      setIsPublicState(!nextPublic)
      toast.error(t('farming-result-visibility-update-error', '公開設定の更新に失敗しました'))
    } finally {
      setIsUpdating(false)
    }
  }

  return { isPublic: isPublicState, isUpdating, handleVisibilityChange }
}

export const Page = ({
  apResult,
  lapResult,
  legacyResult,
  createdAt,
  stockApResult,
  stockLapResult,
  isOwner,
  isPublic,
  resultId,
}: PageProps) => {
  const { t } = useTranslation(['farming', 'common'])
  const isMounted = useIsMounted()
  const formattedDate = isMounted ? formatDate(createdAt) : ''
  const {
    isPublic: isPublicState,
    isUpdating,
    handleVisibilityChange,
  } = useResultVisibility(resultId, isPublic !== false)

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <ResultHeader
          formattedDate={formattedDate}
          isOwner={isOwner}
          isPublic={isPublicState}
          onVisibilityChange={handleVisibilityChange}
          isUpdating={isUpdating}
        />

        {legacyResult ? (
          <LegacyResultView result={legacyResult} isPublic={isPublicState} />
        ) : (
          <BatchResultView
            apResult={apResult}
            lapResult={lapResult}
            stockApResult={stockApResult}
            stockLapResult={stockLapResult}
            isPublic={isPublicState}
          />
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
