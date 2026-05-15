'use client'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import React, { FormEventHandler } from 'react'
import { NodeState } from '../../hooks/use-checkbox-tree'
import { ExpandChevronIcon } from './expand-chevron'

export type Node = { label: string; value: string; children?: Node[] }

type CheckboxTreeProps = {
  tree: Node[]
  checked: NodeState
  onCheck: FormEventHandler<HTMLInputElement>
  expanded: { [value: string]: boolean }
  onExpand: FormEventHandler<HTMLButtonElement>
  debug?: boolean
}

export const CheckboxTree = ({
  tree,
  checked,
  onCheck,
  expanded,
  onExpand,
}: CheckboxTreeProps) => {
  const handleCheck = (value: string, isChecked: boolean) => {
    onCheck({
      currentTarget: { value, checked: isChecked },
    } as unknown as React.FormEvent<HTMLInputElement>)
  }

  const handleExpand = (value: string) => {
    onExpand({
      currentTarget: { value },
    } as unknown as React.FormEvent<HTMLButtonElement>)
  }

  return (
    <div className="flex flex-col items-start gap-1 my-1">
      {tree.map(({ value, label, children }) =>
        children == null ? (
          <div key={value} className="pl-12 flex items-center gap-2">
            <Checkbox
              id={`checkbox-${value}`}
              value={value}
              checked={checked[value] === true}
              indeterminate={checked[value] === 'intermediate'}
              onCheckedChange={(isChecked) => handleCheck(value, !!isChecked)}
            />
            <label htmlFor={`checkbox-${value}`} className="text-sm cursor-pointer">
              {label}
            </label>
          </div>
        ) : (
          <div key={value} className="pl-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleExpand(value)}
                aria-label="Expand"
              >
                <ExpandChevronIcon expanded={expanded[value]} />
              </Button>
              <Checkbox
                id={`checkbox-${value}`}
                value={value}
                checked={checked[value] === true}
                indeterminate={checked[value] === 'intermediate'}
                onCheckedChange={(isChecked) => handleCheck(value, !!isChecked)}
              />
              <label htmlFor={`checkbox-${value}`} className="text-sm cursor-pointer">
                {label}
              </label>
            </div>
            {expanded[value] && (
              <CheckboxTree
                tree={children}
                checked={checked}
                onCheck={onCheck}
                expanded={expanded}
                onExpand={onExpand}
              />
            )}
          </div>
        )
      )}
    </div>
  )
}
