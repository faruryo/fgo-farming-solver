'use client'

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
import React from 'react'
import { useTranslation } from 'react-i18next'

export const ResetAlertDialog = ({
  isOpen,
  onClose,
  onReset,
}: {
  isOpen: boolean
  onClose: () => void
  onReset: () => void
}) => {
  const { t } = useTranslation('farming')
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('入力内容のリセット')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('本当にリセットしますか？')}
            <br />
            {t('you-can-use-export')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>
            {t('キャンセル')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onReset()
              onClose()
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('リセット')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
