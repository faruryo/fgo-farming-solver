'use client'

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
import type { PendingShrink } from '../../hooks/use-cloud-sync'

type ShrinkGuardDialogProps = {
  pending: PendingShrink | null
  onRestore: () => void
  onForceSave: () => void
  onDismiss: () => void
}

/**
 * クラウドにあるデータの大半を消してしまう保存を止めたときに、何が減るのかを見せて
 * 選ばせる。中止するだけではローカルは空同然のままで画面が直らないため、取り返しの
 * つく「クラウドから復元」を既定に置く。
 */
export const ShrinkGuardDialog = ({
  pending,
  onRestore,
  onForceSave,
  onDismiss,
}: ShrinkGuardDialogProps) => {
  const { t } = useTranslation('common')
  const router = useRouter()

  // クラウド側が読めなかったときは件数を出せない。数字を 0 と偽らず不明と書く。
  const summarize = (scale: PendingShrink['cloud']) =>
    scale == null
      ? t('shrink-guard-unknown', '読み取れません')
      : `${t('shrink-guard-servants', 'サーヴァント')} ${scale.servants} / ${t('shrink-guard-possessions', '所持素材の種類')} ${scale.possessions}`

  return (
    <AlertDialog
      open={pending != null}
      onOpenChange={(next) => {
        if (!next) onDismiss()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('shrink-guard-title', 'クラウドのデータが大きく減ります')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'shrink-guard-description',
              'いま保存すると、クラウドに保存されているデータの多くが失われます。この端末のデータが消えている可能性があるため、保存を中断しました。',
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {pending && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border p-2">
              <div className="mb-1 font-medium">
                {t('shrink-guard-next', '保存しようとした内容')}
              </div>
              <div>{summarize(pending.next)}</div>
            </div>
            <div className="rounded border p-2">
              <div className="mb-1 font-medium">
                {t('shrink-guard-cloud', 'クラウド')}
              </div>
              <div>{summarize(pending.cloud)}</div>
            </div>
            {pending.missingKeys.length > 0 && (
              <div className="col-span-2 rounded border p-2">
                {t('shrink-guard-missing-keys', '保存内容から消えている項目')}{' '}
                {pending.missingKeys.length}
              </div>
            )}
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogAction onClick={onRestore}>
            {t('shrink-guard-restore', 'クラウドから復元')}
          </AlertDialogAction>
          <AlertDialogCancel
            onClick={() => {
              onDismiss()
              router.push('/cloud')
            }}
          >
            {t('shrink-guard-compare', '見比べる')}
          </AlertDialogCancel>
          <AlertDialogCancel variant="destructive" onClick={onForceSave}>
            {t('shrink-guard-force', 'このまま保存する')}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
