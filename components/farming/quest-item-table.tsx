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
import { ItemIdentity } from '../common/ItemIdentity'

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
              <div className="flex items-center gap-2">
                <ItemIdentity
                  icon={itemIndexes[item_id]?.icon}
                  name={itemIndexes[item_id]?.name ?? item_id}
                  size={20}
                />
                <span className="text-sm">{itemIndexes[item_id]?.name ?? item_id}</span>
              </div>
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
