import { FormControl, FormLabel } from '@chakra-ui/form-control'
import { VStack } from '@chakra-ui/layout'
import { Box } from '@chakra-ui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { Item } from '../../interfaces/atlas-academy'
import { ItemInput } from './item-input'

export const ItemCategoryFieldset = ({
  category,
  items,
  inputValues,
  handleChange,
}: {
  category: string
  items: { name: string; id: string }[]
  inputValues: { [key: string]: string }
  handleChange: React.FormEventHandler
}) => {
  return (
    <Box>
      <FormControl as="fieldset">
        <VStack>
          <FormLabel as="legend">{category}</FormLabel>
          {items.map(({ id, name }) => (
            <ItemInput
              key={id}
              id={id}
              name={name}
              inputValues={inputValues}
              handleChange={handleChange}
            />
          ))}
        </VStack>
      </FormControl>
    </Box>
  )
}
