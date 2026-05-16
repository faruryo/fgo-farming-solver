'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import React, { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { DropRate, Item, Quest } from '../../interfaces/fgodrop'
import { Localized } from '../../lib/get-local-items'
import { useSpotIcons } from '../../hooks/use-spot-icons'
import { QuestIdentity } from '../common/QuestIdentity'
import { ItemIdentity } from '../common/ItemIdentity'
import { DropTd } from './drop-td'

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
  const colSpan = maxDropCount * 2

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-[200px]">{t('クエスト')}</TableHead>
          <TableHead colSpan={colSpan}>
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
            {dropGroups[quest.id].map((row) => (
              <Fragment key={row.item_id}>
                <TableCell className="px-2 py-2">
                  <ItemIdentity
                    icon={itemIndexes[row.item_id]?.icon}
                    name={itemIndexes[row.item_id]?.name ?? row.item_id}
                    size={28}
                  />
                </TableCell>
                <DropTd
                  dropRate={row.drop_rate}
                  dropRateStyle={dropRateStyle}
                  ap={quest.ap}
                  samples={undefined}
                />
              </Fragment>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
