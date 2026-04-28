'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { Item } from '../../interfaces/atlas-academy'
import { groupBy } from '../../utils/group-by'

export type MaterialResultProps = {
  items: Item[]
  locale?: string
}

// priority floor で largeCategory を決定（get-items.ts と同じロジック）
const LARGE_SECTIONS = [
  { floor: 1, label: 'スキル石',  color: '#5566aa' },  // 輝石/魔石/秘石
  { floor: 2, label: '強化素材',  color: '#7a5c34' },  // 汎用強化素材
  { floor: 3, label: 'モニュピ', color: '#9a7224' },  // ピース/モニュメント
]
const bgColor = (bg: string) =>
  bg === 'bronze' ? '#b06030' : bg === 'silver' ? '#6878a8' : '#9a7224'

type MatCardProps = {
  item: Item
  required: number
  owned: number | undefined
  deficiency: number
  rarityColor: string
  onChange: (id: string, val: number) => void
}

import { getItemIconUrl } from '../../lib/get-item-icon-url'

const MatCard = ({ item, required, owned, deficiency, rarityColor, onChange }: MatCardProps) => {
  const [editing, setEditing] = useState(false)
  const isShort = deficiency > 0

  return (
    <div
      className={`c-mat-card${isShort ? ' short' : ''}`}
      style={{ '--rarity-color': rarityColor } as React.CSSProperties}
    >
      <div className="c-mat-icon-area">
        {item.icon ? (
          <Image
            src={getItemIconUrl(item.icon)}
            alt={item.name}
            width={48}
            height={48}
            className="c-mat-icon"
          />
        ) : (
          <div className="c-mat-icon-placeholder" />
        )}
        {isShort && <div className="c-mat-short-badge">−{deficiency}</div>}
      </div>
      <div className="c-mat-name">{item.name}</div>
      <div className="c-mat-counts">
        <div className="c-mat-count-row">
          <span className="c-mat-count-label">必要</span>
          <span className="c-mat-count-val required">{required}</span>
        </div>
        <div className="c-mat-count-row">
          <span className="c-mat-count-label">所持</span>
          {editing ? (
            <input
              className="c-mat-count-input"
              type="number"
              defaultValue={owned ?? 0}
              min={0}
              autoFocus
              onBlur={e => { onChange(item.id.toString(), Number(e.target.value)); setEditing(false) }}
              onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
            />
          ) : (
            <span
              className={`c-mat-count-val owned${isShort ? ' insufficient' : ''}`}
              tabIndex={0}
              onClick={() => setEditing(true)}
              onFocus={() => setEditing(true)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true) } }}
            >
              {owned ?? 0}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export const Result = ({ items = [] }: MaterialResultProps) => {
  const searchParams = useSearchParams()
  const query = Object.fromEntries(searchParams?.entries() ?? [])
  const initialAmounts = Object.fromEntries(
    Object.entries(query).map(([k, v]) => [k, parseInt(typeof v === 'string' ? v : '0') || 0])
  )
  const [amounts] = useLocalStorage<Record<string, number>>('material/result', initialAmounts)

  const requiredItems = useMemo(
    () => items.filter(item => item.id.toString() in amounts),
    [amounts, items]
  )

  const [possession, setPossession] = useLocalStorage<Record<string, number | undefined>>(
    'posession',
    Object.fromEntries(requiredItems.map(item => [item.id.toString(), 0]))
  )

  const [shortOnly, setShortOnly] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const deficiencies = useMemo(
    () => Object.fromEntries(
      requiredItems.map(item => [
        item.id.toString(),
        Math.max(0, (amounts[item.id.toString()] ?? 0) - (possession[item.id.toString()] ?? 0)),
      ])
    ),
    [amounts, possession, requiredItems]
  )

  const onChange = useCallback((id: string, val: number) => {
    setPossession(prev => ({ ...prev, [id]: val }))
  }, [setPossession])

  const displayedItems = shortOnly
    ? requiredItems.filter(item => deficiencies[item.id.toString()] > 0)
    : requiredItems

  const itemsByFloor = useMemo(
    () => groupBy(
      [...displayedItems].sort((a, b) => a.priority - b.priority),
      item => String(Math.floor(item.priority / 100))
    ) as Partial<Record<string, Item[]>>,
    [displayedItems]
  )

  const totalShort = requiredItems.filter(item => deficiencies[item.id.toString()] > 0).length
  const totalMet   = requiredItems.filter(item => (amounts[item.id.toString()] ?? 0) > 0 && deficiencies[item.id.toString()] === 0).length

  if (!mounted) return null

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">REQUIRED MATERIALS</div>
            <h1 className="c-page-title">アイテム必要数</h1>
          </div>
          <div className="c-result-actions">
            {totalShort > 0 && (
              <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600, letterSpacing: '0.02em' }}>
                不足 {totalShort}種
              </span>
            )}
            {totalShort === 0 && totalMet > 0 && (
              <span style={{ fontSize: 12, color: '#60c890', fontWeight: 600 }}>
                充足 {totalMet}種
              </span>
            )}
            <button
              className={`c-filter-toggle${shortOnly ? ' active' : ''}`}
              onClick={() => setShortOnly(v => !v)}
            >
              {shortOnly ? '全て表示' : '不足のみ表示'}
            </button>
            <Link href="/material" className="c-back-btn">← 設定に戻る</Link>
          </div>
        </div>

        {displayedItems.length === 0 ? (
          <div className="c-empty">
            <div className="c-empty-icon">◎</div>
            <div className="c-empty-msg">
              {shortOnly ? '不足素材はありません' : 'サーヴァントを所持済みに設定してください'}
            </div>
          </div>
        ) : (
          <>
          {LARGE_SECTIONS.map(({ floor, label, color }) => {
            const sectionItems = itemsByFloor[String(floor)] ?? []
            if (sectionItems.length === 0) return null
            return (
              <div key={floor} className="c-mat-section">
                <div className="c-mat-section-title" style={{ color }}>
                  <span className="c-mat-section-line" style={{ background: color }} />
                  {label}
                  <span className="c-mat-section-line" style={{ background: color }} />
                </div>
                <div className="c-mat-grid">
                  {sectionItems.map((item: Item) => (
                    <MatCard
                      key={item.id}
                      item={item}
                      required={amounts[item.id.toString()] ?? 0}
                      owned={possession[item.id.toString()]}
                      deficiency={deficiencies[item.id.toString()] ?? 0}
                      rarityColor={bgColor(item.background)}
                      onChange={onChange}
                    />
                  ))}
                </div>
              </div>
            )
          })}
          </>
        )}
      </div>
    </div>
  )
}
