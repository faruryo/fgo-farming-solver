'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'

/** 品目の「欲しい」と「いらない」の切り替え。今の設定を選んだ状態で示す。 */
export const ItemWantToggle: React.FC<{
  name: string
  wanted: boolean
  onChange: (wanted: boolean) => void
}> = ({ name, wanted, onChange }) => {
  const { t } = useTranslation('common')
  const option = (value: boolean, label: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={wanted === value}
      onClick={() => onChange(value)}
      // 見た目は文字に合わせて 24px、押せる範囲は疑似要素で上下に広げて 44px を保つ。
      className="relative h-6 min-w-11 px-2 text-[11px] font-medium whitespace-nowrap first:rounded-l-[calc(var(--radius-md)_-_1px)] last:rounded-r-[calc(var(--radius-md)_-_1px)] before:absolute before:inset-x-0 before:-inset-y-2.5"
      style={
        wanted === value
          ? { background: 'var(--gold)', color: 'var(--bg)' }
          : { background: 'transparent', color: 'var(--text2)' }
      }
    >
      {label}
    </button>
  )
  return (
    <span
      role="radiogroup"
      aria-label={t('item-want-label', '{{name}} は欲しいか', { name })}
      // overflow-hidden を付けると、ボタンの押せる範囲（疑似要素）が切られる。角はボタン側で丸める。
      className="inline-flex flex-shrink-0 rounded-md"
      style={{ border: '1px solid var(--border)' }}
    >
      {option(true, t('item-want-wanted', '欲しい'))}
      {option(false, t('item-want-unwanted', 'いらない'))}
    </span>
  )
}
