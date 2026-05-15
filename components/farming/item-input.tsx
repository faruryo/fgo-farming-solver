import { Input } from '@/components/ui/input'
import React from 'react'
import Image from 'next/image'
import { getItemIconUrl } from '../../lib/get-item-icon-url'

export const ItemInput = ({
  id,
  name,
  icon,
  inputValues,
  handleChange,
}: {
  id: string
  name: string
  icon?: string
  inputValues: { [key: string]: string }
  handleChange: React.FormEventHandler
}) => {
  if (!(id in inputValues)) inputValues[id] = ''
  return (
    <div id={`item-${id}`}>
      <div className="flex items-center justify-end gap-3">
        {icon && (
          <Image
            src={getItemIconUrl(icon)}
            alt={name}
            width={28}
            height={28}
            style={{ objectFit: 'contain' }}
          />
        )}
        <label
          htmlFor={`item-input-${id}`}
          className="text-right cursor-pointer"
          style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text2)', margin: 0 }}
        >
          {name}
        </label>
        <Input
          id={`item-input-${id}`}
          type="number"
          inputMode="numeric"
          name={id}
          value={inputValues[id]}
          min={0}
          step={1}
          onChange={handleChange}
          className="w-20"
        />
      </div>
    </div>
  )
}
