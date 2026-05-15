import { TableCell } from '@/components/ui/table'
import React from 'react'
import { DropRateStyle } from './item'

export const DropTd = ({
  dropRate,
  dropRateStyle,
  ap,
  samples,
}: {
  dropRate?: number
  dropRateStyle: DropRateStyle
  ap: number
  samples?: number
}) => {
  if (dropRate == null) {
    return (
      <>
        <TableCell className="pr-0 text-right">-</TableCell>
        <TableCell></TableCell>
      </>
    )
  }
  const value = dropRateStyle == 'rate' ? dropRate * 100 : ap / dropRate
  const diffStr =
    samples != null
      ? (() => {
          const sd = Math.sqrt(dropRate / samples)
          const diff =
            dropRateStyle == 'rate'
              ? sd * 2 * 100
              : (ap * 2 * sd) / (dropRate * dropRate - 4 * sd * sd)
          return `±${diff.toFixed(1)}`
        })()
      : null
  return (
    <>
      <TableCell className="pr-0 text-right">{value.toFixed(1)}</TableCell>
      <TableCell className="pl-0 text-right text-xs" style={{ color: 'var(--text3)' }}>
        {diffStr}
      </TableCell>
    </>
  )
}
