import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import React, { FormEventHandler, Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { Item } from '../../interfaces/atlas-academy'
import { toApiItemId } from '../../lib/to-api-item-id'
import { ItemLink } from '../common/item-link'

const showPositive = (value?: number) =>
  value == null || value < 0 ? '' : value

export const ResultTable = ({
  itemGroup,
  amounts,
  possession,
  deficiencies,
  onChange,
  onFocus,
}: {
  itemGroup: [string, Item[]][]
  amounts: { [id: string]: number }
  possession: Record<string, number | undefined>
  deficiencies: { [id: string]: number }
  onChange: FormEventHandler
  onFocus: FormEventHandler
}) => {
  const { t } = useTranslation('material')

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="px-2 md:px-4">{t('アイテム')}</TableHead>
          <TableHead className="px-2 md:px-4 text-right">{t('必要数')}</TableHead>
          <TableHead className="px-2 md:px-4">{t('所持数')}</TableHead>
          <TableHead className="px-2 md:px-4 text-right">{t('不足数')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {itemGroup.map(([category, items]) => (
          <Fragment key={category}>
            <TableRow>
              <TableHead className="px-2 md:px-4" colSpan={4}>
                {t(category)}
              </TableHead>
            </TableRow>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="px-2 md:px-4 py-3">
                  <ItemLink name={item.name} id={toApiItemId(item, items)} />
                </TableCell>
                <TableCell className="px-2 md:px-4 py-3 text-right">
                  {amounts[item.id.toString()]}
                </TableCell>
                <TableCell className="px-2 md:px-4 py-0">
                  <Input
                    type="number"
                    name={item.id.toString()}
                    value={showPositive(possession[item.id])}
                    min={0}
                    onChange={onChange}
                    onFocus={onFocus}
                    className="w-20"
                  />
                </TableCell>
                <TableCell className="px-2 md:px-4 py-3 text-right">
                  {showPositive(deficiencies[item.id])}
                </TableCell>
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  )
}
