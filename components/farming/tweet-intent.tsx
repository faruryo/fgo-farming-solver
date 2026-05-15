'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { FaXTwitter } from 'react-icons/fa6'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'

export const TweetIntent = ({ text }: { text: string }) => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const asPath = `${pathname}${searchParams?.toString() ? '?' + searchParams.toString() : ''}`
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const url = siteUrl ? `${siteUrl}${asPath}` : ''
  const hashtags = 'FGO周回ソルバー'

  const params = new URLSearchParams()
  params.append('text', text)
  if (url) params.append('url', url)
  params.append('hashtags', hashtags)

  const intentUrl = `https://x.com/intent/tweet?${params.toString()}`
  const { t } = useTranslation('farming')

  return (
    <div className="my-4">
      <Button
        variant="secondary"
        render={<a href={intentUrl} target="_blank" rel="noopener noreferrer" />}
      >
        <FaXTwitter className="mr-2 h-4 w-4" />
        {t('結果をツイートする')}
      </Button>
    </div>
  )
}
