import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DropRate, Item } from '../../interfaces/api'
import { ItemLink } from '../common/item-link'

export const QuestItemTable = ({
  dropRates,
  itemIndexes,
  lap,
}: {
  dropRates: DropRate[]
  itemIndexes: { [id: string]: Item & { icon?: string } }
  lap: number
}) => {
  const { t } = useTranslation('farming')
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('アイテム')}</TableHead>
          <TableHead className="text-right">{t('獲得数')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {dropRates.map(({ item_id, drop_rate }) => (
          <TableRow key={item_id}>
            <TableCell>
              <ItemLink
                id={item_id}
                name={itemIndexes[item_id]?.name}
                icon={itemIndexes[item_id]?.icon}
              />
            </TableCell>
            <TableCell className="text-right">
              {Math.round(
                (typeof drop_rate == 'string'
                  ? parseFloat(drop_rate)
                  : drop_rate) * lap
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
