'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslation } from 'react-i18next'

const postedHandoffs = new Set<string>()

const nextPath = (value: unknown): string => {
  if (typeof value !== 'object' || value === null || !('next' in value))
    return '/'
  const next = value.next
  if (
    typeof next !== 'string' ||
    !next.startsWith('/') ||
    next.startsWith('//')
  )
    return '/'
  return next
}

const replaceFailed = (): void => {
  window.location.replace('/auth/preview-complete?error=1')
}

const postHandoff = (handoff: string): void => {
  void fetch('/api/auth/preview/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handoff }),
  })
    .then(async (res) => {
      if (!res.ok) {
        replaceFailed()
        return
      }
      window.location.replace(nextPath(await res.json()))
    })
    .catch(() => {
      replaceFailed()
    })
}

export const PreviewAuthComplete = () => {
  const { t } = useTranslation('common')
  const failed = useSearchParams().get('error') === '1'

  useEffect(() => {
    if (failed) return
    const handoff = new URLSearchParams(
      window.location.hash.replace(/^#/u, ''),
    ).get('handoff')
    if (!handoff) {
      replaceFailed()
      return
    }
    if (postedHandoffs.has(handoff)) return
    postedHandoffs.add(handoff)
    postHandoff(handoff)
  }, [failed])

  return (
    <p className="p-6 text-sm">
      {failed
        ? t('preview-auth-failed', 'プレビューへのログインに失敗しました')
        : t('preview-auth-completing', 'ログインを完了しています')}
    </p>
  )
}
