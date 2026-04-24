/* eslint-disable */
'use client'

import { useRouter } from 'next/navigation'
import React from 'react'
import {
  Center,
  Container,
  Heading,
  Text,
  VStack,
} from '@chakra-ui/react'
import { useTranslation } from 'react-i18next'
import { useFarmingResult } from '../../hooks/use-farming-result'
import { Title } from '../common/title'
import { Link } from '../common/link'
import { QuestTable } from './quest-table'
import { TweetIntent } from './tweet-intent'
import { ResultStat } from './result-stat'
import { ResultAccordion } from './result-accordion'
import { Item, Quest, DropRate } from '../../interfaces/fgodrop'

export type ResultProps = {
  params: { items: string }
  quests: (Quest & { lap: number })[]
  items: (Item & { count: number })[]
  drop_rates: DropRate[]
  total_ap: number
  total_lap: number
}

export const Page = ({
  params,
  quests,
  items,
  drop_rates,
  total_ap,
  total_lap,
}: ResultProps) => {
  const router = useRouter()
  const { t } = useTranslation(['farming', 'common'])
  // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
  const text = useFarmingResult(items as any, params.items as any, quests as any)

  if (!quests || quests.length == 0) {
    return (
      <>
        <Title>{t('結果が見つかりませんでした')}</Title>
        <Text>
          {t(
            '新しく追加された素材のためドロップ率のデータがない場合などがあります。'
          )}
        </Text>
        <Text>
          <Link href="/">{t('トップに戻る', { ns: 'common' })}</Link>
        </Text>
      </>
    )
  }

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">RESULT</div>
            <h1 className="c-page-title">{t('計算結果')}</h1>
          </div>
          <div className="c-stats">
            <div className="c-stat">
              <div className="c-stat-num">{total_lap}</div>
              <div className="c-stat-label">LAP</div>
            </div>
            <div className="c-stat">
              <div className="c-stat-num">{total_ap}</div>
              <div className="c-stat-label">AP</div>
            </div>
          </div>
        </div>

        <VStack spacing={12} align="stretch">
          <div className="c-card" style={{ padding: '24px', overflowX: 'auto' }}>
            <div className="c-settings-section-label" style={{ marginBottom: '16px', display: 'flex' }}>
              {t('クエスト周回数')}
            </div>
            <Center>
              <QuestTable items={items as any} quests={quests as any} dropRates={drop_rates as any} />
            </Center>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <TweetIntent text={text} />
          </div>

          <div className="c-card" style={{ padding: '24px' }}>
            <div className="c-settings-section-label" style={{ marginBottom: '16px', display: 'flex' }}>
              {t('アイテム獲得数')}
            </div>
            <ResultAccordion items={items as any} params={params as any} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <Link href="/farming" className="c-back-btn">
              {t('戻って条件を調整する')}
            </Link>
          </div>
        </VStack>
      </div>
    </div>
  )
}
