'use client'

import { useState } from 'react'
import Image from 'next/image'
import { getItemIconUrl } from '../../lib/get-item-icon-url'

// ── Tracking toast (消費 / 返還) ──────────────────────────────────────────

export type TrackingToastItem = {
  itemId: string
  name: string
  icon: string | undefined
  amount: number
}

export type TrackingToastProps = {
  title: string
  direction: 'consume' | 'return'
  items: TrackingToastItem[]
  onClose?: () => void
}

export const TrackingToast = ({ title, direction, items, onClose }: TrackingToastProps) => {
  const directionLabel = direction === 'consume' ? '消費' : '返還'
  const directionColor = direction === 'consume' ? 'var(--red)' : '#60c890'

  return (
    <div style={cardStyle}>
      <ToastHeader onClose={onClose}>
        <span style={{ color: directionColor, marginRight: 6 }}>{directionLabel}</span>
        {title}
      </ToastHeader>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it) => (
          <ItemRow key={it.itemId} icon={it.icon} name={it.name}>
            <span style={{ fontWeight: 600, minWidth: 40, textAlign: 'right' }}>×{it.amount}</span>
          </ItemRow>
        ))}
      </div>
    </div>
  )
}

// ── Blocked toast (材料不足 + 所持数入力) ─────────────────────────────────

export type BlockedToastItem = {
  itemId: string
  name: string
  icon: string | undefined
  owned: number
  required: number
}

export type BlockedToastProps = {
  title: string
  items: BlockedToastItem[]
  onConfirm: (newValues: Record<string, number>) => void
  onClose: () => void
}

export const BlockedToast = ({ title, items, onConfirm, onClose }: BlockedToastProps) => {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((it) => [it.itemId, String(it.owned)]))
  )
  const [confirmed, setConfirmed] = useState(false)

  const handleConfirm = () => {
    const newValues = Object.fromEntries(
      items.map((it) => [it.itemId, Math.max(0, Number(values[it.itemId]) || 0)])
    )
    onConfirm(newValues)
    setConfirmed(true)
    setTimeout(onClose, 800)
  }

  return (
    <div style={cardStyle}>
      <ToastHeader onClose={onClose}>
        <span style={{ color: 'var(--red)', marginRight: 6 }}>材料不足</span>
        {title}
      </ToastHeader>

      {confirmed ? (
        <div style={{ color: '#60c890', fontSize: 12, paddingTop: 4 }}>
          ✓ 更新しました。もう一度クリックしてください。
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {items.map((it) => (
              <ItemRow key={it.itemId} icon={it.icon} name={it.name}>
                <span style={{ fontSize: 11, color: 'var(--muted-foreground, #888)', whiteSpace: 'nowrap' }}>
                  必要 {it.required}
                </span>
                <input
                  type="number"
                  min={0}
                  value={values[it.itemId]}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [it.itemId]: e.target.value }))
                  }
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                  placeholder="所持数"
                  style={inputStyle}
                />
              </ItemRow>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={handleConfirm} style={primaryBtnStyle}>
              所持数を更新する
            </button>
            <button type="button" onClick={onClose} style={secondaryBtnStyle}>
              キャンセル
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: 'var(--card, #1a1a1a)',
  color: 'var(--foreground, #fff)',
  borderRadius: 8,
  border: '1px solid var(--border, #333)',
  padding: '10px 12px',
  minWidth: 280,
  maxWidth: 360,
  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  fontSize: 13,
}

const inputStyle: React.CSSProperties = {
  width: 72,
  padding: '2px 6px',
  borderRadius: 4,
  border: '1px solid var(--border, #444)',
  background: 'var(--background, #0a0a0a)',
  color: 'inherit',
  fontSize: 12,
  flexShrink: 0,
}

const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  padding: '5px 10px',
  borderRadius: 5,
  border: '1px solid var(--border, #555)',
  background: 'var(--primary, #4a6fa5)',
  color: 'var(--primary-foreground, #fff)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderRadius: 5,
  border: '1px solid var(--border, #555)',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 12,
}

const ToastHeader = ({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose?: () => void
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 8,
      fontWeight: 600,
      fontSize: 12,
      letterSpacing: '0.02em',
    }}
  >
    <div style={{ flex: 1 }}>{children}</div>
    {onClose && (
      <button
        type="button"
        onClick={onClose}
        aria-label="閉じる"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--muted-foreground, #888)',
          cursor: 'pointer',
          padding: 0,
          fontSize: 14,
          lineHeight: 1,
          marginLeft: 8,
        }}
      >
        ✕
      </button>
    )}
  </div>
)

const ItemRow = ({
  icon,
  name,
  children,
}: {
  icon: string | undefined
  name: string
  children: React.ReactNode
}) => {
  const iconUrl = icon ? getItemIconUrl(icon) : ''
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {iconUrl ? (
        <Image
          src={iconUrl}
          alt={name}
          width={24}
          height={24}
          style={{ objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        <div style={{ width: 24, height: 24, flexShrink: 0 }} />
      )}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
      {children}
    </div>
  )
}
