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
import { Item } from '../../interfaces/api'
import { Localized } from '../../lib/get-local-items'
import { ItemLink } from '../common/item-link'

export const ItemTable = ({
  itemGroups,
  itemToQuery,
}: {
  itemGroups: [string, Localized<Item>[]][]
  itemToQuery: { [key: string]: number }
}) => {
  const { t } = useTranslation('farming')
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      {itemGroups.map(([category, items]) => (
        <div key={category} className="flex flex-col items-start gap-2">
          <h2 className="text-base font-semibold">{category}</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">{t('アイテム')}</TableHead>
                <TableHead className="px-2 text-right">{t('獲得数')}</TableHead>
                <TableHead className="px-4 text-right">{t('必要数')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="px-4">
                    <ItemLink id={item.id} name={item.name} icon={item.icon} />
                  </TableCell>
                  <TableCell className="px-2 text-right">{item.count}</TableCell>
                  <TableCell className="px-4 text-right">
                    {itemToQuery[item.id] || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  )
}
