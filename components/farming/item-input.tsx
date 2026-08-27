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
    <div id={`item-${id}`} className="w-full">
      <div className="flex items-center justify-between gap-2.5 w-full py-1">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon ? (
            <Image
              src={getItemIconUrl(icon)}
              alt={name}
              width={28}
              height={28}
              className="flex-shrink-0"
              style={{ objectFit: 'contain' }}
            />
          ) : (
            <div className="w-7 h-7 flex-shrink-0" />
          )}
          <label
            htmlFor={`item-input-${id}`}
            className="truncate cursor-pointer text-left font-medium text-xs sm:text-sm text-[color:var(--text2)]"
            title={name}
          >
            {name}
          </label>
        </div>
        <Input
          id={`item-input-${id}`}
          type="number"
          inputMode="numeric"
          name={id}
          value={inputValues[id]}
          min={0}
          step={1}
          onChange={handleChange}
          className="w-20 flex-shrink-0 text-right h-8 text-sm"
        />
      </div>
    </div>
  )
}
