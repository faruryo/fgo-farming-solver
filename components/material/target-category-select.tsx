import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import React from 'react'
import { useTranslation } from 'react-i18next'

export const TargetCategorySelect = ({
  categories,
  targetCategories,
  setTargetCategories,
}: {
  categories: string[]
  targetCategories: string[]
  setTargetCategories: (targetCategories: string[]) => void
}) => {
  const { t } = useTranslation(['common', 'material'])

  const handleChange = (category: string, checked: boolean) => {
    if (checked) {
      setTargetCategories([...targetCategories, category])
    } else {
      setTargetCategories(targetCategories.filter((c) => c !== category))
    }
  }

  return (
    <fieldset>
      <legend className="text-sm font-medium mb-2">{t('material:周回数を求める対象')}</legend>
      <div className="flex items-center gap-4">
        {categories.map((category) => (
          <div key={category} className="flex items-center gap-2">
            <Checkbox
              id={`cat-${category}`}
              checked={targetCategories.includes(category)}
              onCheckedChange={(checked) => handleChange(category, checked === true)}
            />
            <Label htmlFor={`cat-${category}`}>{t(category)}</Label>
          </div>
        ))}
      </div>
    </fieldset>
  )
}
