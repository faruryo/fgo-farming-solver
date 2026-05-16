'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { DropRate, Item, Quest } from '../../interfaces/fgodrop'
import { Localized } from '../../lib/get-local-items'
import { useSpotIcons } from '../../hooks/use-spot-icons'
import { QuestIdentity } from '../common/QuestIdentity'
import { ItemIdentity } from '../common/ItemIdentity'
import { DropTdContent } from './drop-td'

type DropRateStyle = 'ap' | 'rate'

export const DropTable = ({
  itemIndexes,
  quests,
  dropGroups,
  dropRateStyle,
}: {
  itemIndexes: { [id: string]: Localized<Item> }
  quests: Quest[]
  dropGroups: { [key: string]: DropRate[] }
  dropRateStyle: DropRateStyle
}) => {
  const { t } = useTranslation('items')
  const spotIcons = useSpotIcons(quests)
  const maxDropCount = Object.values(dropGroups).reduce(
    (acc, cur) => (cur.length > acc ? cur.length : acc),
    0
  )

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[200px]">{t('クエスト')}</TableHead>
          <TableHead colSpan={maxDropCount}>
            {t('ドロップ')} ({dropRateStyle == 'rate' ? '%' : 'AP/個'})
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {quests.map((quest) => (
          <TableRow key={quest.id}>
            <TableCell className="py-2">
              <QuestIdentity
                area={quest.area}
                name={quest.name}
                ap={quest.ap}
                spotIcon={spotIcons[quest.id]}
              />
            </TableCell>
            {dropGroups[quest.id].map((row) => {
              const item = itemIndexes[row.item_id]
              return (
                <TableCell key={row.item_id} className="px-3 py-2 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <ItemIdentity
                      icon={item?.icon}
                      name={item?.name ?? row.item_id}
                      size={24}
                    />
                    <DropTdContent
                      dropRate={row.drop_rate}
                      dropRateStyle={dropRateStyle}
                      ap={quest.ap}
                      samples={undefined}
                    />
                  </div>
                </TableCell>
              )
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
