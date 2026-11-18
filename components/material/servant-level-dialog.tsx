'use client'

import { useId, useRef, useState, type RefObject, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { NumberField } from '@/components/ui/number-field'
import { Label } from '@/components/ui/label'
import type { ServantLevel, ServantLevelEdit } from '../../lib/servant-levels'
import { levelFieldRange, levelFieldValue, readLevelField, type LevelField } from '../../lib/servant-roster-review'

type Fields = Record<LevelField, number | null>

type Props = {
  open: boolean
  /** 直しているサーヴァント（閉じ終わるまで残す） */
  servant: { id: number; name: string } | null
  /** そのサーヴァントの今の保存値 */
  level: ServantLevel | undefined
  onOpenChange: (open: boolean) => void
  onOpenChangeComplete?: (open: boolean) => void
  /** 閉じたときにフォーカスを戻す要素（false を返すとフォーカスを動かさない） */
  finalFocus?: () => HTMLElement | null | false
  /** 欄のとおりに置き換える（値が今の保存値と同じときは呼ばない） */
  onSave: (servantId: number, edit: ServantLevelEdit) => void
  /** 未所持に戻す（欄の書きかけは保存しない） */
  onMarkUnowned?: (servantId: number) => void
}

const fieldsOf = (level: ServantLevel | undefined): Fields => ({
  lv: level?.lv ?? null,
  npLv: level?.npLv ?? null,
})

/** ラベルつきの数字の欄（範囲に無い値は aria-invalid で示す） */
const LevelInput = ({
  field,
  id,
  label,
  value,
  invalid,
  inputRef,
  onChange,
}: {
  field: LevelField
  id: string
  label: string
  value: number | null
  invalid: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  onChange: (value: number | null) => void
}) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    <NumberField
      id={id}
      ref={inputRef}
      {...levelFieldRange(field)}
      value={value}
      onValueChange={next => onChange(next)}
      aria-invalid={invalid || undefined}
      className="tabular-nums"
    />
  </div>
)

/** 欄の入力。開いた時点の保存値で始め、開いている間に保存値が変わっても書き換えない */
const useLevelFields = (open: boolean, level: ServantLevel | undefined) => {
  const [fields, setFields] = useState<Fields>(() => fieldsOf(level))
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setFields(fieldsOf(level))
  }
  const setField = (field: LevelField, value: number | null) =>
    setFields(prev => (field === 'lv' ? { ...prev, lv: value } : { ...prev, npLv: value }))
  const lvInvalid = readLevelField('lv', fields.lv).kind === 'invalid'
  const npLvInvalid = readLevelField('npLv', fields.npLv).kind === 'invalid'
  const edit: ServantLevelEdit = { lv: levelFieldValue('lv', fields.lv), npLv: levelFieldValue('npLv', fields.npLv) }
  return { fields, setField, lvInvalid, npLvInvalid, edit }
}

/**
 * 1騎の Lv・宝具Lv を手で入れる小窓。欄の入力はこの部品の中に持ち、開いたときの保存値で始める
 * （開いている間に同期で保存値が変わっても、打っている欄は書き換えない）。
 */
export const ServantLevelDialog = ({
  open,
  servant,
  level,
  onOpenChange,
  onOpenChangeComplete,
  finalFocus,
  onSave,
  onMarkUnowned,
}: Props) => {
  const { t } = useTranslation('material')
  const lvInputRef = useRef<HTMLInputElement>(null)
  const id = useId()
  const { fields, setField, lvInvalid, npLvInvalid, edit } = useLevelFields(open, level)

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!servant || lvInvalid || npLvInvalid) return
    if (edit.lv !== (level?.lv ?? null) || edit.npLv !== (level?.npLv ?? null)) onSave(servant.id, edit)
    onOpenChange(false)
  }

  const handleMarkUnowned = () => {
    if (!servant) return
    onMarkUnowned?.(servant.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={next => onOpenChange(next)} onOpenChangeComplete={onOpenChangeComplete}>
      <DialogContent showCloseButton={false} initialFocus={lvInputRef} finalFocus={finalFocus} className="sm:max-w-xs">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{servant?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <LevelInput
              field="lv"
              id={`${id}-lv`}
              label={t('servant-level-dialog-lv', 'Lv')}
              value={fields.lv}
              invalid={lvInvalid}
              inputRef={lvInputRef}
              onChange={value => setField('lv', value)}
            />
            <LevelInput
              field="npLv"
              id={`${id}-npLv`}
              label={t('servant-level-dialog-np-lv', '宝具Lv')}
              value={fields.npLv}
              invalid={npLvInvalid}
              onChange={value => setField('npLv', value)}
            />
          </div>
          <DialogDescription>{t('servant-level-dialog-note', '空にして保存すると消えます')}</DialogDescription>
          <DialogFooter>
            {/* 所持の操作なので、値を決める「保存」「キャンセル」から離して左端に置く */}
            <Button type="button" variant="ghost" className="sm:mr-auto" onClick={handleMarkUnowned}>
              {t('servant-level-dialog-mark-unowned', '未所持に戻す')}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('servant-level-dialog-cancel', 'キャンセル')}
            </Button>
            <Button type="submit" disabled={lvInvalid || npLvInvalid}>
              {t('servant-level-dialog-save', '保存')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
