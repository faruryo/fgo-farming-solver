import React from 'react'
import { DropRateStyle } from './item'

export const DropTdContent = ({
  dropRate,
  dropRateStyle,
  ap,
  samples,
  isTarget = false,
}: {
  dropRate?: number
  dropRateStyle: DropRateStyle
  ap: number
  samples?: number
  isTarget?: boolean
}) => {
  if (dropRate == null) {
    return <span className="text-muted-foreground">—</span>
  }
  const value = dropRateStyle == 'rate' ? dropRate * 100 : ap / dropRate
  const suffix = dropRateStyle === 'rate' ? '%' : ''
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

  const color = isTarget ? 'var(--navy)' : 'var(--text3)'
  const fontSize = isTarget ? '15px' : '13px'

  return (
    <span className="whitespace-nowrap">
      <span
        className="font-medium tabular-nums"
        style={{ color, fontSize, fontWeight: isTarget ? 700 : 500 }}
      >
        {value.toFixed(1)}{suffix}
      </span>
      {diffStr && (
        <span className="text-xs ml-0.5" style={{ color: 'var(--text3)' }}>
          {diffStr}
        </span>
      )}
    </span>
  )
}
