import React from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Item, Params } from '../../interfaces/api'
import { Localized } from '../../lib/get-local-items'
import { groupBy } from '../../utils/group-by'
import { ItemTable } from './item-table'

export const ResultAccordion = ({
  items,
  params,
}: {
  items: Localized<Item>[]
  params: Params
}) => {
  const itemGroups = Object.entries(
    groupBy(items, ({ largeCategory }) => largeCategory)
  ).map(([largeCategory, items]): [string, [string, Localized<Item>[]][]] => [
    largeCategory,
    Object.entries(groupBy(items, ({ category }) => category)),
  ])

  return (
    <Accordion>
      {itemGroups.map(([largeCategory, itemGroups]) => (
        <AccordionItem className="item-details" key={largeCategory} value={largeCategory}>
          <AccordionTrigger>{largeCategory}</AccordionTrigger>
          <AccordionContent>
            <ItemTable itemGroups={itemGroups} itemToQuery={params.items} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
