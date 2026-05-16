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
import { ItemLink } from '../common/item-link'
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
  const maxDropCount = Object.values(dropGroups).reduce(
    (acc, cur) => (cur.length > acc ? cur.length : acc),
    0
  )
  const colSpan = maxDropCount * 2

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28 whitespace-nowrap">{t('エリア')}</TableHead>
          <TableHead className="min-w-[8rem]">{t('クエスト')}</TableHead>
          <TableHead className="w-20 text-right">{t('サンプル数')}</TableHead>
          <TableHead colSpan={colSpan}>
            {t('ドロップ')} ({dropRateStyle == 'rate' ? '%' : 'AP/個'})
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {quests.map((quest) => (
          <TableRow key={quest.id}>
            <TableCell className="whitespace-nowrap">{quest.area}</TableCell>
            <TableCell>{quest.name}</TableCell>
            <TableCell className="text-right text-muted-foreground">-</TableCell>
            {dropGroups[quest.id].map((row) => (
              <Fragment key={row.item_id}>
                <TableCell className="pl-3 pr-1">
                  <ItemLink
                    id={row.item_id}
                    name={itemIndexes[row.item_id].name}
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
