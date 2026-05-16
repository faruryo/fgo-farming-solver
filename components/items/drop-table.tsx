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

const RANK_STYLES: Record<number, { color: string; fontSize: string; fontWeight: number }> = {
  1: { color: '#c09030', fontSize: '15px', fontWeight: 800 },  // gold
  2: { color: '#94a3b8', fontSize: '14px', fontWeight: 700 },  // silver
  3: { color: '#b87333', fontSize: '14px', fontWeight: 700 },  // bronze
}
const DEFAULT_RANK_STYLE = { color: 'var(--text3)', fontSize: '12px', fontWeight: 500 }

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
          <TableHead className="w-8 px-2 text-center">#</TableHead>
          <TableHead className="min-w-[200px]">{t('クエスト')}</TableHead>
          <TableHead colSpan={maxDropCount}>
            {t('ドロップ')} ({dropRateStyle == 'rate' ? '%' : 'AP/個'})
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {quests.map((quest, index) => {
          const rank = index + 1
          const rankStyle = RANK_STYLES[rank] ?? DEFAULT_RANK_STYLE
          return (
            <TableRow key={quest.id}>
              <TableCell className="w-8 px-2 text-center align-middle">
                <span style={rankStyle} className="tabular-nums leading-none">
                  {rank}
                </span>
              </TableCell>
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
          )
        })}
      </TableBody>
    </Table>
  )
}
