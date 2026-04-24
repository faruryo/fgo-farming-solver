/* eslint-disable */
import {
  FormControl,
  FormLabel,
  Radio,
  RadioGroup,
  VStack,
} from '@chakra-ui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'

const options = ['add', '1', '2']

export const DropRateSelect = ({
  dropMergeMethod,
  setDropMergeMethod,
}: {
  dropMergeMethod: string
  setDropMergeMethod: (dropMergeMethod: string) => void
}) => {
  const { t } = useTranslation('farming')
  return (
    <FormControl as="fieldset">
      <FormLabel as="legend" className="c-settings-section-label" m={0} mb={4} display="flex">{t('ドロップ率')}</FormLabel>
      <RadioGroup value={dropMergeMethod} onChange={setDropMergeMethod}>
        <VStack alignItems="start" spacing={4}>
          {options.map((value) => (
            <VStack key={value} align="start">
              <Radio value={value}>{t(value)}</Radio>
            </VStack>
          ))}
        </VStack>
      </RadioGroup>
    </FormControl>
  )
}
