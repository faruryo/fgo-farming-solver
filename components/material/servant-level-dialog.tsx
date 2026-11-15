'use client'

import { useId, useRef, useState, type RefObject, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ServantLevel, ServantLevelEdit } from '../../lib/servant-levels'
import { readField, type LevelField } from '../../lib/servant-roster-review'

type Fields = Record<LevelField, string>

type Props = {
  open: boolean
  /** 直しているサーヴァント（閉じ終わるまで残す） */
  servant: { id: number; name: string } | null
  /** そのサーヴァントの今の保存値 */
  level: ServantLevel | undefined
  onOpenChange: (open: boolean) => void
  onOpenChangeComplete?: (open: boolean) => void
  /** 閉じたときにフォーカスを戻す要素 */
  finalFocus?: () => HTMLElement | null
  /** 欄のとおりに置き換える（値が今の保存値と同じときは呼ばない） */
  onSave: (servantId: number, edit: ServantLevelEdit) => void
}

const fieldsOf = (level: ServantLevel | undefined): Fields => ({
  lv: level?.lv === undefined ? '' : String(level.lv),
  npLv: level?.npLv === undefined ? '' : String(level.npLv),
})

const valueOf = (field: LevelField, raw: string): number | null => {
  const read = readField(field, raw)
  return read.kind === 'value' ? read.value : null
}

/** ラベルつきの数字の欄（範囲に無い値は aria-invalid で示す） */
const LevelInput = ({
  id,
  label,
  value,
  invalid,
  inputRef,
  onChange,
}: {
  id: string
  label: string
  value: string
  invalid: boolean
  inputRef?: RefObject<HTMLInputElement | null>
  onChange: (raw: string) => void
}) => (
  <div className="flex flex-col gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Input
      id={id}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={e => onChange(e.target.value)}
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
  const setField = (field: LevelField, raw: string) =>
    setFields(prev => (field === 'lv' ? { ...prev, lv: raw } : { ...prev, npLv: raw }))
  const lvInvalid = readField('lv', fields.lv).kind === 'invalid'
  const npLvInvalid = readField('npLv', fields.npLv).kind === 'invalid'
  const edit: ServantLevelEdit = { lv: valueOf('lv', fields.lv), npLv: valueOf('npLv', fields.npLv) }
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

  return (
    <Dialog open={open} onOpenChange={next => onOpenChange(next)} onOpenChangeComplete={onOpenChangeComplete}>
      <DialogContent showCloseButton={false} initialFocus={lvInputRef} finalFocus={finalFocus} className="sm:max-w-xs">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{servant?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <LevelInput
              id={`${id}-lv`}
              label={t('servant-level-dialog-lv', 'Lv')}
              value={fields.lv}
              invalid={lvInvalid}
              inputRef={lvInputRef}
              onChange={raw => setField('lv', raw)}
            />
            <LevelInput
              id={`${id}-npLv`}
              label={t('servant-level-dialog-np-lv', '宝具Lv')}
              value={fields.npLv}
              invalid={npLvInvalid}
              onChange={raw => setField('npLv', raw)}
            />
          </div>
          <DialogDescription>{t('servant-level-dialog-note', '空にして保存すると消えます')}</DialogDescription>
          <DialogFooter>
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
