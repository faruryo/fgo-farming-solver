import React from 'react'
import { useTranslation } from 'react-i18next'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'

const values = [
  ['ap', '消費AP'],
  ['lap', '周回数'],
]

export const ObjectiveFieldset = ({
  objective,
  setObjective,
}: {
  objective: string
  setObjective: (objective: string) => void
}) => {
  const { t } = useTranslation('farming')

  return (
    <fieldset>
      <legend className="c-settings-section-label mb-4 flex">{t('最小化')}</legend>
      <RadioGroup name="objective" value={objective} onValueChange={setObjective}>
        <div className="flex items-center gap-4">
          {values.map(([value, description]) => (
            <div key={value} className="flex items-center gap-2">
              <RadioGroupItem value={value} id={`objective-${value}`} />
              <Label htmlFor={`objective-${value}`}>{t(description)}</Label>
            </div>
          ))}
        </div>
      </RadioGroup>
    </fieldset>
  )
}
