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
    <>
      <VStack spacing="8">
        <Title>{t('計算結果')}</Title>

        <Heading size="lg">{t('クエスト周回数')}</Heading>

        <Center w="sm">
          <QuestTable items={items as any} quests={quests as any} dropRates={drop_rates as any} />
        </Center>

        <VStack>
          <Heading as="h3" size="md">
            {t('合計')}
          </Heading>
          <ResultStat totalLap={total_lap} totalAp={total_ap} />
        </VStack>

        <TweetIntent text={text} />

        <Heading size="lg">{t('アイテム獲得数')}</Heading>

        <Container maxW="container.xl">
          <ResultAccordion items={items as any} params={params as any} />
        </Container>
      </VStack>
    </>
  )
}
