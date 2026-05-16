'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import React, { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DropRate, Item, Quest } from '../../interfaces/api'
import { groupBy } from '../../utils/group-by'
import { ExpandChevronIcon } from '../common/expand-chevron'
import { QuestIdentity } from '../common/QuestIdentity'
import { useSpotIcons } from '../../hooks/use-spot-icons'
import { QuestItemTable } from './quest-item-table'

export const QuestTable = ({
  items,
  quests,
  dropRates,
}: {
  items: Item[]
  quests: Quest[]
  dropRates: DropRate[]
}) => {
  const itemIndexes = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item])),
    [items]
  )
  const questGroups = useMemo(
    () => groupBy(quests, ({ area }) => area),
    [quests]
  )
  const questToDrops = useMemo(
    () => groupBy(dropRates, ({ quest_id }) => quest_id),
    [dropRates]
  )
  const spotIcons = useSpotIcons(quests)

  const [isOpen, setIsOpen] = useState(
    Object.fromEntries(
      Object.entries(questGroups)
        .flatMap(([area, quests]) => quests.map(({ id }, i) => `${area}-${id}-${i}`))
        .map((key) => [key, false])
    )
  )
  const onToggle: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    const { value } = event.currentTarget
    setIsOpen((isOpen) => ({ ...isOpen, [value]: !isOpen[value] }))
  }
  const { t } = useTranslation('farming')

  return (
    <Table className="whitespace-nowrap">
      <TableHeader>
        <TableRow>
          <TableHead colSpan={2}>{t('クエスト')}</TableHead>
          <TableHead className="text-right">
            <Tooltip>
              <TooltipTrigger render={<span style={{ cursor: 'help' }} />}>
                {t('周回数')}
              </TooltipTrigger>
              <TooltipContent>{t('tooltip-lap')}</TooltipContent>
            </Tooltip>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.entries(questGroups).map(([area, questGroup]) => (
          <Fragment key={area}>
            <TableRow>
              <TableHead colSpan={3}>{area}</TableHead>
            </TableRow>
            {questGroup.map(({ name, id, ap, lap }, i) => {
              const rowKey = `${area}-${id}-${i}`
              return (
                <Fragment key={rowKey}>
                  <TableRow>
                    <TableCell className="px-2 py-1">
                      <Button
                        aria-label="toggle collapse"
                        variant="ghost"
                        size="icon"
                        value={rowKey}
                        onClick={onToggle}
                      >
                        <ExpandChevronIcon expanded={isOpen[rowKey]} />
                      </Button>
                    </TableCell>
                    <TableCell className="px-3 py-2">
                      <QuestIdentity
                        area={area}
                        name={name}
                        ap={ap}
                        spotIcon={spotIcons[id]}
                      />
                    </TableCell>
                    <TableCell className="text-right px-3 py-2">{lap}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="py-0 px-0">
                      <div className={isOpen[rowKey] ? '' : 'hidden'}>
                        <QuestItemTable
                          dropRates={questToDrops[id]}
                          itemIndexes={itemIndexes}
                          lap={lap}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                </Fragment>
              )
            })}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  )
}
