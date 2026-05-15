'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import React, { FormEventHandler } from 'react'
import { useTranslation } from 'react-i18next'
import { Item } from '../../interfaces/atlas-academy'
import { ResultTable } from './result-table'

export const ResultAccordion = ({
  itemGroup,
  amounts,
  possession,
  deficiencies,
  onChange,
  onFocus,
}: {
  itemGroup: [string, [string, Item[]][]][]
  amounts: { [id: string]: number }
  possession: Record<string, number | undefined>
  deficiencies: { [id: string]: number }
  onChange: FormEventHandler
  onFocus: FormEventHandler
}) => {
  const { t } = useTranslation('common')
  const defaultCategory = itemGroup.find(([category]) => category === '強化素材')?.[0]

  return (
    <Accordion defaultValue={defaultCategory ? [defaultCategory] : undefined}>
      {itemGroup.map(([category, subItemGroup]) => (
        <AccordionItem key={category} value={category}>
          <AccordionTrigger>{t(category)}</AccordionTrigger>
          <AccordionContent className="px-0">
            <ResultTable
              amounts={amounts}
              deficiencies={deficiencies}
              itemGroup={subItemGroup}
              onChange={onChange}
              onFocus={onFocus}
              possession={possession}
            />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
