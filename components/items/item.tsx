/* eslint-disable */
/* eslint-disable */
'use client'

import { useRouter } from 'next/navigation'
import {
  Box,
  Breadcrumb,
  BreadcrumbItem,
  Center,
  Skeleton,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react'
import React from 'react'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { Item as FgoItem, Quest as FgoQuest, DropRate as DropRateRow } from '../../interfaces/fgodrop'
import { Localized } from '../../lib/get-local-items'
import { groupBy } from '../../utils/group-by'
import { orderBy } from '../../utils/order-by'
import { Title } from '../common/title'
import { BreadcrumbLink } from '../common/breadcrumb-link'
import { DropRateStyleRadio } from './drop-rate-style-radio'
import { DropTable } from './drop-table'
import { useTranslation } from 'react-i18next'

export type DropRateStyle = 'ap' | 'rate'

export type ItemProps = {
  id: string
  items: Localized<FgoItem>[]
  quests: FgoQuest[]
  dropRates: DropRateRow[]
}

export const Page = ({ id, items, quests, dropRates }: ItemProps) => {
  const [dropRateStyle, setDropRateStyle] = useLocalStorage<DropRateStyle>(
    'dropRateStyle',
    'ap'
  )
  const { t } = useTranslation('items')

  const sortedDropRates = [...dropRates].sort(
    orderBy(
      ({ item_id }) => (item_id == id ? -Infinity : parseInt(item_id, 36)),
      'asc'
    )
  )

  const dropGroups = groupBy(sortedDropRates, ({ quest_id }) => quest_id)

  const getDropRate = (quest_id: string) => {
    const dropRate = dropGroups[quest_id]?.find((row) => row.item_id == id)
    return dropRate == null ? -1 : dropRate.drop_rate
  }

  const filteredQuests = quests.filter(({ id }) => getDropRate(id) != -1)
  const selectedQuests =
    dropRateStyle == 'rate'
      ? [...filteredQuests].sort(orderBy(({ id }) => getDropRate(id), 'desc'))
      : [...filteredQuests].sort(
          orderBy(({ id, ap }) => ap / getDropRate(id), 'asc')
        )

  const itemIndexes: Record<string, Localized<FgoItem>> = Object.fromEntries(
    items.map((item) => [item.id, item])
  )
  const currentItem = itemIndexes[id]
  const title = t('title', { name: currentItem?.name ?? '' })

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">ITEM DETAIL</div>
            <h1 className="c-page-title">{title}</h1>
          </div>
        </div>

        <VStack align="stretch" spacing={8}>
          <Breadcrumb>
            <BreadcrumbItem>
              <BreadcrumbLink href="/items">{t('アイテム一覧')}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbItem isCurrentPage>
              <Text color="var(--text3)">{title}</Text>
            </BreadcrumbItem>
          </Breadcrumb>

          <div className="c-card" style={{ padding: '24px' }}>
            <form>
              <Wrap justify="center" spacing={8}>
                <WrapItem>
                  <DropRateStyleRadio
                    dropRateStyle={dropRateStyle}
                    setDropRateStyle={setDropRateStyle}
                  />
                </WrapItem>
              </Wrap>
            </form>
          </div>

          <div className="c-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div className="c-global-header" style={{ cursor: 'default', background: 'var(--panel)' }}>
              <div className="c-global-header-title">{t('DROP DATA')}</div>
              <div className="c-global-header-line"></div>
            </div>
            <Box whiteSpace="nowrap" overflowX="auto">
              <DropTable
                itemIndexes={itemIndexes}
                quests={selectedQuests}
                dropGroups={dropGroups}
                dropRateStyle={dropRateStyle}
              />
            </Box>
          </div>
        </VStack>
      </div>
    </div>
  )
}
