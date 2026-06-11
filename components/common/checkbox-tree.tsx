'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import React, { FormEventHandler } from 'react'
import { NodeState } from '../../hooks/use-checkbox-tree'
import { ExpandChevronIcon } from './expand-chevron'

export type Node = {
  label: string
  value: string
  children?: Node[]
  /**
   * 配下（リーフは自身）の「新着」件数。> 0 のときラベル横に NEW バッジを表示する。
   * リーフは `NEW`、ブランチは折りたたみ時の手がかりとして `NEW {count}`。
   * 未設定なら従来表示（material ページ等の他利用箇所に影響しない）。
   */
  newCount?: number
}

type CheckboxTreeProps = {
  tree: Node[]
  checked: NodeState
  onCheck: FormEventHandler<HTMLInputElement>
  expanded: { [value: string]: boolean }
  onExpand: FormEventHandler<HTMLButtonElement>
  debug?: boolean
}

const NewBadge = ({ count, leaf }: { count: number; leaf: boolean }) => (
  <Badge
    variant="outline"
    className="border-[var(--gold)] text-[var(--gold)]"
  >
    {leaf ? 'NEW' : `NEW ${count}`}
  </Badge>
)

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
      {tree.map(({ value, label, children, newCount }) =>
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
            {(newCount ?? 0) > 0 && <NewBadge count={newCount as number} leaf />}
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
              {(newCount ?? 0) > 0 && (
                <NewBadge count={newCount as number} leaf={false} />
              )}
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
