import { FormControl, FormLabel, HStack, Input } from '@chakra-ui/react'
import React from 'react'
import Image from 'next/image'
import { getItemIconUrl } from '../../lib/get-item-icon-url'

export const ItemInput = ({
  id,
  name,
  icon,
  inputValues,
  handleChange,
}: {
  id: string
  name: string
  icon?: string
  inputValues: { [key: string]: string }
  handleChange: React.FormEventHandler
}) => {
  if (!(id in inputValues)) inputValues[id] = ''
  return (
    <FormControl id={`item-${id}`}>
      <HStack align="center" justify="end" spacing={3}>
        {icon && (
          <Image
            src={getItemIconUrl(icon)}
            alt={name}
            width={28}
            height={28}
            style={{ objectFit: 'contain' }}
          />
        )}
        <FormLabel textAlign="right" fontWeight="600" fontSize="13px" color="var(--text2)" m={0}>
          {name}
        </FormLabel>
        <Input
          type="number"
          inputMode="numeric"
          name={id}
          value={inputValues[id]}
          min={0}
          step={1}
          onChange={handleChange}
          w="5em"
        />
      </HStack>
    </FormControl>
  )
}
