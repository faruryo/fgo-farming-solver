'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Item } from '../../interfaces/fgodrop'
import { Localized } from '../../lib/get-local-items'
import { ItemCategoryFieldset } from './item-category-fieldset'

export const ItemFieldset = ({
  itemGroups,
  inputItems,
  handleChange,
}: {
  itemGroups: [string, [string, Localized<Item>[]][]][]
  inputItems: { [key: string]: string }
  handleChange: React.FormEventHandler
}) => {
  const { t } = useTranslation(['common', 'farming'])

  return (
    <fieldset className="w-full">
      <legend className="c-settings-section-label mb-4 flex">
        {t('farming:集めたいアイテムの数')}
      </legend>
      <Accordion
        defaultValue={itemGroups.length > 0 ? [itemGroups[0][0]] : undefined}
      >
        {itemGroups.map(([largeCategory, itemGroup]) => (
          <AccordionItem key={largeCategory} value={largeCategory} className="border-b border-border/40 py-1">
            <AccordionTrigger className="text-base font-semibold py-3 hover:no-underline text-foreground">
              {largeCategory}
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2 pb-4">
                {itemGroup.map(([category, items]) => (
                  <ItemCategoryFieldset
                    key={category}
                    category={category}
                    items={items}
                    inputValues={inputItems}
                    handleChange={handleChange}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </fieldset>
  )
}
