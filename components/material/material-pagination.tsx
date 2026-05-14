 
'use client'

import { Link } from '../common/link'
import { HStack, Stack, Box, Text } from '@chakra-ui/react'
import { ChevronLeftIcon, ChevronRightIcon } from '@chakra-ui/icons'
import React from 'react'
import { PageSelect } from './material-page-select'
import { classNames } from '../../lib/class-names'
import { useTranslation } from 'react-i18next'

export const Pagination = ({
  currentClassName,
}: {
  currentClassName?: string
}) => {
  const { i18n } = useTranslation()
  const locale = (i18n.language || 'ja') as 'ja' | 'en'
  const localClassNames = classNames[locale]
  const keys = Object.keys(localClassNames)
  const currentIndex = keys.indexOf(currentClassName || '')
  const prevClassName =
    currentIndex < 1 ? keys.slice(-1)[0] : keys[currentIndex - 1]
  const nextClassName = keys[currentIndex + 1] ?? keys[0]
  
  return (
    <Stack
      as="nav"
      aria-label="pagination"
      direction={['column', 'row']}
      align="center"
      justify="space-between"
    >
      <Link href={'/material/' + prevClassName}>
        <HStack>
          <ChevronLeftIcon />
          <Text pr={5}>{localClassNames[prevClassName as keyof typeof localClassNames]}</Text>
        </HStack>
      </Link>

      <Box>
        <PageSelect currentClassName={currentClassName} />
      </Box>

      <Link href={'/material/' + nextClassName}>
        <HStack>
          <Text pl={5}>{localClassNames[nextClassName as keyof typeof localClassNames]}</Text>
          <ChevronRightIcon />
        </HStack>
      </Link>
    </Stack>
  )
}
