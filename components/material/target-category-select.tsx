 
import { CheckboxGroup, Checkbox } from '@chakra-ui/react'
import { FormControl, FormLabel } from '@chakra-ui/react'
import { HStack } from '@chakra-ui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'

export const TargetCategorySelect = ({
  categories,
  targetCategories,
  setTargetCategories,
}: {
  categories: string[]
  targetCategories: string[]
  setTargetCategories: (targetCategories: string[]) => void
}) => {
  const onChange = (a: (string | number)[]) => {
    setTargetCategories(a.map((v) => v.toString()))
  }
  const { t } = useTranslation(['common', 'material'])

  return (
    <FormControl as="fieldset">
      <FormLabel as="legend">{t('material:周回数を求める対象')}</FormLabel>
      <CheckboxGroup value={targetCategories} onChange={onChange}>
        <HStack spacing={4}>
          {categories.map((category) => (
            <Checkbox key={category} value={category}>
              {t(category)}
            </Checkbox>
          ))}
        </HStack>
      </CheckboxGroup>
    </FormControl>
  )
}
