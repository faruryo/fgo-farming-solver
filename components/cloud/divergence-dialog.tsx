'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import type { Stats } from './parts/stats-logic'

// 「あとで」の抑止はモジュールスコープのメモリに置く。sessionStorage はリロードを
// またいで残るため、未解決のまま同期が止まっていることに気づけなくなる。画面遷移
// (SPA)では出し直さず、リロードすれば再提示する。
let dismissedInThisLoad = false

type DivergenceDialogProps = {
  open: boolean
  localStats: Stats | null
  cloudStats: Stats | null
  onRestore: () => void
}

const summarize = (stats: Stats | null, fallback: string) =>
  stats == null
    ? fallback
    : `サーヴァント ${stats.ownedCount} 騎 / 素材 ${stats.bronze + stats.silver + stats.gold} 個`

/**
 * この端末で編集したデータと、クラウドに保存されているデータが別々の歴史を持つとき
 * (＝一度も同期していない端末での編集) に、どちらを使うかを選ばせる。
 * 取り返しのつくクラウド復元だけをこの場で実行し、クラウドを上書きする操作は
 * 件数を見比べられる /cloud へ誘導する。
 */
export const DivergenceDialog = ({
  open,
  localStats,
  cloudStats,
  onRestore,
}: DivergenceDialogProps) => {
  const { t } = useTranslation('common')
  const router = useRouter()
  const [dismissed, setDismissed] = useState(dismissedInThisLoad)

  const dismiss = () => {
    dismissedInThisLoad = true
    setDismissed(true)
  }

  return (
    <AlertDialog open={open && !dismissed} onOpenChange={(next) => !next && dismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('divergence-title', 'この端末とクラウドのデータが分かれています')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'divergence-description',
              'この端末はまだ一度もクラウドと同期していません。どちらのデータを使うか選んでください。'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border p-2">
            <div className="mb-1 font-medium">{t('divergence-local', 'この端末')}</div>
            <div>{summarize(localStats, t('divergence-empty', 'データなし'))}</div>
          </div>
          <div className="rounded border p-2">
            <div className="mb-1 font-medium">{t('divergence-cloud', 'クラウド')}</div>
            <div>{summarize(cloudStats, t('divergence-empty', 'データなし'))}</div>
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => {
              dismiss()
              onRestore()
            }}
          >
            {t('divergence-restore', 'クラウドから復元')}
          </AlertDialogAction>
          <AlertDialogCancel
            onClick={() => {
              dismiss()
              router.push('/cloud')
            }}
          >
            {t('divergence-compare', '見比べる')}
          </AlertDialogCancel>
          <AlertDialogCancel onClick={dismiss}>
            {t('divergence-later', 'あとで')}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
