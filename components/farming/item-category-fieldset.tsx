import React from 'react'
import { ItemInput } from './item-input'

export const ItemCategoryFieldset = ({
  category,
  items,
  inputValues,
  handleChange,
}: {
  category: string
  items: { name: string; id: string; icon?: string }[]
  inputValues: { [key: string]: string }
  handleChange: React.FormEventHandler
}) => {
  return (
    <fieldset>
      <div className="flex flex-col gap-3">
        <legend
          className="w-full text-xs font-semibold tracking-widest pb-2 border-b"
          style={{ color: 'var(--gold)', borderColor: 'var(--gold-dim)' }}
        >
          {category}
        </legend>
        <div className="flex flex-col items-end gap-2">
          {items.map(({ id, name, icon }) => (
            <ItemInput
              key={id}
              id={id}
              name={name}
              icon={icon}
              inputValues={inputValues}
              handleChange={handleChange}
            />
          ))}
        </div>
      </div>
    </fieldset>
  )
}
