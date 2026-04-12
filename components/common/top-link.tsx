/* eslint-disable */
import { Link } from './link'
import React from 'react'
import { Center } from '@chakra-ui/react'

export const TopLink = () => {
  const locale = 'ja' as string
  const label = locale == 'en' ? 'Return to Top Page' : 'トップページに戻る'
  return (
    <Center>
      <Link
        href="/"
        aria-label={locale == 'en' ? 'Farming Solver' : '周回ソルバー'}
      >
        {label}
      </Link>
    </Center>
  )
}
