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
    <fieldset>
      <legend className="c-settings-section-label mb-4 flex">
        {t('farming:集めたいアイテムの数')}
      </legend>
      <Accordion
        defaultValue={itemGroups.length > 0 ? [itemGroups[0][0]] : undefined}
      >
        {itemGroups.map(([largeCategory, itemGroup]) => (
          <AccordionItem key={largeCategory} value={largeCategory}>
            <AccordionTrigger>{largeCategory}</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-wrap items-start justify-start gap-6">
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
