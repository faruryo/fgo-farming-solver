import { FormControl, FormLabel } from '@chakra-ui/form-control'
import { HStack, Radio, RadioGroup } from '@chakra-ui/react'
import React from 'react'

export const ObjectiveFieldset = ({
  objective,
  setObjective,
}: {
  objective: string
  setObjective: (objective: string) => void
}) => (
  <FormControl as="fieldset">
    <FormLabel as="legend">最小化</FormLabel>
    <RadioGroup name="objective" value={objective} onChange={setObjective}>
      <HStack spacing={4}>
        {[
          ['ap', '消費AP'],
          ['lap', '周回数'],
        ].map(([value, description]) => (
          <Radio key={value} value={value}>
            {description}
          </Radio>
        ))}
      </HStack>
    </RadioGroup>
  </FormControl>
)
