'use client'

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import React, { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { DropRateStyle } from './item'

export const DropRateStyleRadio = ({
  dropRateStyle,
  setDropRateStyle,
}: {
  dropRateStyle: DropRateStyle
  setDropRateStyle: Dispatch<SetStateAction<DropRateStyle>>
}) => {
  const { t } = useTranslation('items')
  return (
    <fieldset>
      <legend className="text-sm mb-2">{t('表示形式')}</legend>
      <RadioGroup
        value={dropRateStyle}
        onValueChange={(value) => setDropRateStyle(value as DropRateStyle)}
        className="flex gap-8"
      >
        <div className="flex items-center gap-2">
          <RadioGroupItem id="drop-style-ap" value="ap" />
          <label htmlFor="drop-style-ap" className="text-sm cursor-pointer">{t('AP効率')}</label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem id="drop-style-rate" value="rate" />
          <label htmlFor="drop-style-rate" className="text-sm cursor-pointer">{t('ドロップ率')}</label>
        </div>
      </RadioGroup>
    </fieldset>
  )
}
