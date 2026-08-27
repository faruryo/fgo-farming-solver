'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useStockTarget } from '../../hooks/use-stock-target'

export interface StockIncludedToggleProps {
  /** 外部から制御する場合の値。省略時は useStockTarget() を使用 */
  checked?: boolean
  /** 外部から制御する場合の変更コールバック。省略時は useStockTarget().setStockEnabled を使用 */
  onCheckedChange?: (checked: boolean) => void
  /** 追加クラス名 */
  className?: string
  /** サイズバリエーション */
  size?: 'sm' | 'default'
}

/**
 * 余剰ストックを目標に含めるか（stockEnabled）を切り替えるトグルボタン。
 * クエスト一覧・クエスト詳細などで共通して使用可能。
 */
export const StockIncludedToggle: React.FC<StockIncludedToggleProps> = ({
  checked,
  onCheckedChange,
  className = '',
  size = 'default',
}) => {
  const { t } = useTranslation('quests')
  const { stockEnabled: internalStockEnabled, setStockEnabled: setInternalStockEnabled } = useStockTarget()

  const isChecked = checked !== undefined ? checked : internalStockEnabled
  const handleToggle = () => {
    const next = !isChecked
    if (onCheckedChange) {
      onCheckedChange(next)
    } else {
      setInternalStockEnabled(next)
    }
  }

  const title = isChecked
    ? t('stock-toggle-on-title', '余剰ストックを目標に含めています（クリックで通常モードに切替）')
    : t('stock-toggle-off-title', '余剰ストックを目標に含めません（クリックでストック込みに切替）')

  const ariaLabel = t('stock-toggle-aria-label', 'ストック込み目標切り替え')

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isChecked}
      aria-label={ariaLabel}
      title={title}
      onClick={handleToggle}
      className={`inline-flex items-center justify-center font-bold rounded-full transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 flex-shrink-0 ${
        size === 'sm'
          ? 'text-[9px] px-1.5 py-0.5'
          : 'text-[10px] px-2 py-0.5'
      } ${className}`}
      style={
        isChecked
          ? {
              background: 'var(--accent)',
              color: 'var(--gold)',
              border: '1px solid var(--gold-dim)',
            }
          : {
              background: 'var(--bg2)',
              color: 'var(--text3)',
              border: '1px solid var(--border)',
            }
      }
    >
      {t('stock-included', 'ストック込み')}
    </button>
  )
}
