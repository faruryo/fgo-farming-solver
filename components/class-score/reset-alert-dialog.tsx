'use client'

import React from 'react'
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
} from '@/components/ui/alert-dialog'

export type ResetAlertDialogProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

export const ResetAlertDialog: React.FC<ResetAlertDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation('classScore')

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('dialog.reset.title', 'クラススコア設定のリセット')}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span>
              {t(
                'dialog.reset.description',
                '全9クラスのクラススコア目標設定をすべてリセット（未設定）にしますか？',
              )}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t(
                'dialog.reset.note',
                '※実行後も画面下のトーストから「元に戻す」ことができます。',
              )}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            {t('dialog.cancel', 'キャンセル')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('dialog.reset.confirm', 'リセットする')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
