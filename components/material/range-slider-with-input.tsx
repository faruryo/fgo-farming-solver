import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import React from 'react'

export const RangeSliderWithInput = ({
  min,
  max,
  step,
  disabled,
  name,
  value,
  setValue,
}: {
  min: number
  max: number
  step: number
  disabled?: boolean
  name?: string
  value: number[]
  setValue: (value: number[]) => void
}) => (
  <div className="flex items-center gap-4">
    <Input
      type="number"
      min={min}
      max={max}
      step={step}
      name={name}
      value={value[0]}
      onChange={(e) => setValue([e.currentTarget.valueAsNumber, value[1]])}
      disabled={disabled}
      className="w-[100px]"
    />
    <Slider
      min={min}
      max={max}
      value={value}
      onValueChange={(v) => setValue(Array.isArray(v) ? [...v] : [v as number])}
      disabled={disabled}
      className="flex-1"
    />
    <Input
      type="number"
      min={min}
      max={max}
      step={step}
      name={name}
      value={value[1]}
      disabled={disabled}
      onChange={(e) => setValue([value[0], e.currentTarget.valueAsNumber])}
      className="w-[100px]"
    />
  </div>
)
