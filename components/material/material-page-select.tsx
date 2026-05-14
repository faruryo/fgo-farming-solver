 
'use client'

import { Select } from '@chakra-ui/react'
import { useRouter } from 'next/navigation'
import React, { FormEventHandler, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { classNames } from '../../lib/class-names'

export const PageSelect = ({
  currentClassName,
}: {
  currentClassName?: string
}) => {
  const router = useRouter()
  const { t, i18n } = useTranslation('material')
  const locale = (i18n.language || 'ja') as 'ja' | 'en'
  
  const onChange: FormEventHandler<HTMLSelectElement> = useCallback(
    (event) => {
      const { value } = event.currentTarget
      if (value === "") {
        router.push('/material')
      } else {
        router.push(`/material/${value}`)
      }
    },
    [router]
  )
  
  const localClassNames = classNames[locale]
  const placeholder =
    currentClassName == null ? t('個別設定') : localClassNames[currentClassName as keyof typeof localClassNames]

  return (
    <>
      <Select placeholder={placeholder} onChange={onChange}>
        {currentClassName != null && <option value="">{t('全体設定')}</option>}
        {Object.entries(localClassNames)
          .filter(([className]) => className != currentClassName)
          .map(([className, localClassName]) => (
            <option key={className} value={className}>
              {localClassName}
            </option>
          ))}
      </Select>
    </>
  )
}
