'use client'

import React from 'react'
import { BiWindows } from 'react-icons/bi'
import { MdDevices, MdDownload, MdImportExport } from 'react-icons/md'
import { useTranslation } from 'react-i18next'
import { Link } from '../common/link'
import { useSearchParams } from 'next/navigation'

export const ImportExport = () => {
  const { t } = useTranslation('farming')
  const searchParams = useSearchParams()
  const locale = 'ja' as string
  const url = `/farming?${searchParams?.toString() ?? ''}`

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-2">
        <MdImportExport />
        <h1 className="text-2xl font-semibold my-8">{t('入力内容のインポート・エクスポート')}</h1>
      </div>
      <p>{t('フォームの入力内容を他のデバイスやブラウザとやり取りできます。')}</p>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MdDevices />
          {t('他のデバイスへのエクスポート')}
        </h2>
        <p>{t('export-device-description')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BiWindows />
          {t('他のブラウザへのエクスポート')}
        </h2>
        <p>{t('export-browser-description')}</p>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MdDownload />
          {t('入力内容のインポート')}
        </h2>
        <p>
          {locale == 'en' && 'Return to the form from '}
          <Link href={url}>
            {locale == 'en' ? 'here.' : 'こちら'}
          </Link>
          {locale != 'en' && 'から入力フォームへ戻ってください。'}
        </p>
      </div>
    </div>
  )
}
