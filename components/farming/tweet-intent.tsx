/* eslint-disable */
'use client'

import React from 'react'
import { Box, Button } from '@chakra-ui/react'
import { FaTwitter } from 'react-icons/fa'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'

export const TweetIntent = ({ text }: { text: string }) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const asPath = `${pathname}${searchParams?.toString() ? '?' + searchParams.toString() : ''}`
  const url = `https://fgo-farming-solver.vercel.app${asPath}`
  const hashtags = 'FGO周回ソルバー'
  const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    text
  )}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`
  const { t } = useTranslation('farming')

  return (
    <Box my={4}>
      <Button
        as="a"
        href={intentUrl}
        target="_blank"
        rel="noopener noreferrer"
        leftIcon={<FaTwitter />}
        colorScheme="twitter"
        variant="solid"
        p={2}
      >
        {t('結果をツイートする')}
      </Button>
    </Box>
  )
}
