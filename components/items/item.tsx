'use client'

import { useRouter } from 'next/navigation'
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
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

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

        <div className="flex flex-col gap-8">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/items">{t('アイテム一覧')}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  <span style={{ color: 'var(--text3)' }}>{title}</span>
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="c-card" style={{ padding: '24px' }}>
            <form>
              <div className="flex flex-wrap justify-center gap-8">
                <DropRateStyleRadio
                  dropRateStyle={dropRateStyle}
                  setDropRateStyle={setDropRateStyle}
                />
              </div>
            </form>
          </div>

          <div className="c-card" style={{ padding: '0', overflow: 'hidden' }}>
            <div className="c-global-header" style={{ cursor: 'default', background: 'var(--panel)' }}>
              <div className="c-global-header-title">{t('DROP DATA')}</div>
              <div className="c-global-header-line"></div>
            </div>
            <div className="whitespace-nowrap overflow-x-auto">
              <DropTable
                itemIndexes={itemIndexes}
                quests={selectedQuests}
                dropGroups={dropGroups}
                dropRateStyle={dropRateStyle}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
