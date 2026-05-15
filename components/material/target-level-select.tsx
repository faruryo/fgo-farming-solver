import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import React, { Dispatch, FormEventHandler, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { ServantState, TargetState } from '../../hooks/create-chaldea-state'
import { TargetKey } from '../../interfaces/atlas-academy'
import { RangeSliderWithInput } from './range-slider-with-input'

const mins: { [key: string]: number } = {
  ascension: 0,
  skill: 1,
  appendSkill: 0,
}
const maxs: { [key: string]: number } = {
  ascension: 4,
  skill: 10,
  appendSkill: 10,
}

const TargetLevelSelectComponent = ({
  id,
  target,
  state: { disabled, ranges },
  handleChangeDisabled,
  setServantState,
}: {
  id: string
  target: TargetKey
  state: TargetState
  handleChangeDisabled: FormEventHandler<HTMLInputElement>
  setServantState: Dispatch<(state: ServantState) => ServantState>
}) => {
  const { t } = useTranslation('common')
  return (
    <div className="flex flex-col gap-2" key={`${id}-${target}`}>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`${id}-${target}`}
          checked={!disabled}
          onCheckedChange={(checked) => {
            const syntheticEvent = {
              currentTarget: { name: `${id}-${target}`, checked: checked === true },
            } as unknown as React.FormEvent<HTMLInputElement>
            handleChangeDisabled(syntheticEvent)
          }}
        />
        <Label htmlFor={`${id}-${target}`}>{t(target)}</Label>
      </div>
      {ranges.map(({ start, end }, index) => (
        <RangeSliderWithInput
          min={mins[target]}
          max={maxs[target]}
          step={1}
          disabled={disabled}
          name={`${id}-${target}-${index}`}
          value={[start, end]}
          setValue={(value) => {
            setServantState((state) => ({
              ...state,
              targets: {
                ...state.targets,
                [target]: {
                  ...state.targets[target],
                  ranges: state.targets[target].ranges.map((range, i) =>
                    i == index ? { start: value[0], end: value[1] } : range
                  ),
                },
              },
            }))
          }}
          key={`${id}-${target}-${index}`}
        />
      ))}
    </div>
  )
}

export const TargetLevelSelect = memo(TargetLevelSelectComponent)
