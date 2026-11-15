'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useTranslation } from 'react-i18next'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/page-header'

const isChunkLoadError = (error: Error) =>
  error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')

export default function GlobalError({
  error,
}: Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>) {
  const { t } = useTranslation('common')

  useEffect(() => {
    // ChunkLoadError happens when the browser has cached old JS chunk references
    // after a new deployment. Hard reload to get the latest chunks.
    if (isChunkLoadError(error)) {
      window.location.reload()
    } else {
      console.error(error)
    }
  }, [error])

  if (isChunkLoadError(error)) return null

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <PageHeader en="ERROR" title={t('error-page-title', '問題が発生しました')} />
        <div className="c-card mx-auto mt-8 flex max-w-[600px] flex-col gap-6 p-8">
          <p className="text-sm" style={{ color: 'var(--text2)' }}>
            {t(
              'error-page-description',
              'このページを表示できませんでした。再読み込みしても直らないときは、トップページから開き直してください。',
            )}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {/* 保存データが原因のエラーは reset() で描画し直しても同じ所で落ちるので、ページごと読み直す */}
            <Button className="h-11 sm:flex-1" onClick={() => window.location.reload()}>
              {t('error-page-reload', '再読み込み')}
            </Button>
            <Link href="/" className={cn(buttonVariants({ variant: 'outline' }), 'h-11 sm:flex-1')}>
              {t('error-page-top', 'トップページへ戻る')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
