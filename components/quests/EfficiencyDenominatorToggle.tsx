'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type { EfficiencyDenominator } from '../../lib/quest-efficiency'

const toggleItemClass =
  'h-7 px-3 rounded-none! text-[10px] font-semibold tracking-wide text-[color:var(--text3)] transition-colors hover:text-[color:var(--gold)] hover:bg-[color:var(--accent)] data-[pressed]:bg-[color:var(--gold)] data-[pressed]:text-white aria-pressed:bg-[color:var(--gold)] aria-pressed:text-white'
const toggleGroupClass =
  'rounded-md bg-[color:var(--bg2)] shadow-[inset_0_0_0_1px_var(--gold-dim)] overflow-hidden'

export const EfficiencyDenominatorToggle: React.FC<{
  value: EfficiencyDenominator
  onChange: (value: EfficiencyDenominator) => void
  className?: string
}> = ({ value, onChange, className }) => {
  const { t } = useTranslation('quests')
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(values: string[]) => {
        const v = values[0]
        if (v === 'ap' || v === 'turn') onChange(v)
      }}
      size="sm"
      spacing={0}
      aria-label={t('効率の分母', '効率の分母')}
      className={[toggleGroupClass, className].filter(Boolean).join(' ')}
    >
      <ToggleGroupItem value="ap" className={toggleItemClass}>
        {t('AP効率', 'AP効率')}
      </ToggleGroupItem>
      <ToggleGroupItem value="turn" className={toggleItemClass}>
        {t('周回効率', '周回効率')}
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
