'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { NiceServant, Item } from '../../interfaces/atlas-academy'
import { MaterialsForServants } from '../../lib/get-materials'
import { useChaldeaState } from '../../hooks/use-chaldea-state'
import { createServantState, ServantState } from '../../hooks/create-chaldea-state'
import { sumMaterials } from '../../lib/sum-materials'
import { CLASS_LIST, ClassId } from '../../constants/classes'
import { ServantCard } from './servant-card'

export type MaterialIndexProps = {
  servants: NiceServant[]
  materials: MaterialsForServants
  items: Item[]
  locale?: string
}

const DEFAULT_SERVANT_STATE = createServantState()

export const Index = ({
  servants = [],
  materials = {},
}: MaterialIndexProps) => {
  const router = useRouter()
  const ids = useMemo(() => servants.map(s => s.id.toString()), [servants])
  const [chaldeaState, setChaldeaState] = useChaldeaState(ids)

  const [selClass, setSelClass] = useState<ClassId>('all')
  const [selRarities, setSelRarities] = useState<number[]>([])
  const [hideUnowned, setHideUnowned] = useState(false)
  const [showGlobal, setShowGlobal] = useState(false)

  const gtAsc    = chaldeaState.all?.targets.ascension.ranges[0]?.end ?? 4
  const gtSkill  = chaldeaState.all?.targets.skill.ranges[0]?.end ?? 10
  const gtAppend = chaldeaState.all?.targets.appendSkill.ranges[0]?.end ?? 10

  const [draftGt, setDraftGt] = useState({ asc: gtAsc, skill: gtSkill, append: gtAppend })

  // Sync draft when panel opens so it always reflects the current committed target
  useEffect(() => {
    if (showGlobal) setDraftGt({ asc: gtAsc, skill: gtSkill, append: gtAppend })
  }, [showGlobal, gtAsc, gtSkill, gtAppend])

  const { ownedCount, doneCount } = useMemo(() => {
    let owned = 0, done = 0
    servants.forEach(s => {
      const st = chaldeaState[s.id]
      if (!st || st.disabled) return
      owned++
      const appends = Array.from({ length: 5 }, (_, i) => st.targets.appendSkill.ranges[i]?.start ?? 1)
      if (
        (st.targets.ascension.ranges[0]?.start ?? 0) >= gtAsc &&
        st.targets.skill.ranges.every(r => r.start >= gtSkill) &&
        appends.every(v => v >= gtAppend)
      ) done++
    })
    return { ownedCount: owned, doneCount: done }
  }, [servants, chaldeaState, gtAsc, gtSkill, gtAppend])

  const toggleRarity = (r: number) =>
    setSelRarities(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])

  const filtered = useMemo(() =>
    servants.filter(s => {
      if (selClass !== 'all') {
        let targetClass = s.className as string
        if (targetClass.startsWith('beast')) targetClass = 'beast'
        // Handle shielder by grouping with one of the extra classes or treat as special
        // For now, let's keep it simple: if selClass matches targetClass
        if (selClass !== targetClass) return false
      }
      if (selRarities.length > 0 && !selRarities.includes(Number(s.rarity))) return false
      if (hideUnowned && chaldeaState[s.id]?.disabled) return false
      return true
    }),
    [servants, selClass, selRarities, hideUnowned, chaldeaState]
  )

  const applyGlobalTarget = () => {
    setChaldeaState(prev =>
      Object.fromEntries(
        Object.entries(prev).map(([id, s]) => [id, {
          ...s,
          targets: {
            ascension:   { ...s.targets.ascension,   ranges: s.targets.ascension.ranges.map(r => ({ ...r, end: draftGt.asc })) },
            skill:       { ...s.targets.skill,       ranges: s.targets.skill.ranges.map(r => ({ ...r, end: draftGt.skill })) },
            appendSkill: {
              ...s.targets.appendSkill,
              ranges: Array.from({ length: 5 }, (_, i) => ({
                start: s.targets.appendSkill.ranges[i]?.start ?? 1,
                end: draftGt.append,
              })),
            },
          },
        }])
      )
    )
    setShowGlobal(false)
  }

  const handleSetServantState = useCallback(
    (id: string) => (update: (prev: ServantState) => ServantState) => {
      setChaldeaState(prev => ({ ...prev, [id]: update(prev[id]) }))
    },
    [setChaldeaState]
  )

  const handleCalc = () => {
    const result = sumMaterials(chaldeaState, materials)
    localStorage.setItem('material/result', JSON.stringify(result))
    router.push('/material/result')
  }

  const globalState = chaldeaState.all ?? DEFAULT_SERVANT_STATE

  return (
    <div className="c-page">
      <div className="c-page-inner">
        <div className="c-page-header">
          <div>
            <div className="c-page-en">MATERIAL CALCULATOR</div>
            <h1 className="c-page-title">育成素材計算機</h1>
          </div>
          <div className="c-stats">
            <div className="c-stat">
              <div className="c-stat-num">{ownedCount}</div>
              <div className="c-stat-label">所持</div>
            </div>
            <div className="c-stat">
              <div className="c-stat-num green">{doneCount}</div>
              <div className="c-stat-label">育成完了</div>
            </div>
            <div className="c-stat">
              <div className="c-stat-num">{servants.length}</div>
              <div className="c-stat-label">総数</div>
            </div>
          </div>
        </div>

        {/* Global target panel */}
        <div className="c-global-panel">
          <div className="c-global-header" onClick={() => setShowGlobal(v => !v)}>
            <span className="c-global-header-title">COMMON TARGET — 共通目標設定</span>
            <div className="c-global-header-line" />
            <span className="c-global-note">再臨 {gtAsc} ／ スキル {gtSkill} ／ アペンド {gtAppend}</span>
            <span className={`c-global-chevron${showGlobal ? ' open' : ''}`}>▼</span>
          </div>
          {showGlobal && (
            <div className="c-global-body">
              <span className="c-global-label">霊基再臨 目標</span>
              <div className="c-global-row">
                <select
                  className="c-global-dd"
                  value={draftGt.asc}
                  onChange={e => setDraftGt(d => ({ ...d, asc: Number(e.target.value) }))}
                >
                  {[0, 1, 2, 3, 4].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <span className="c-global-note">段階</span>
              </div>
              <span className="c-global-label">スキル 目標</span>
              <div className="c-global-row">
                <select
                  className="c-global-dd"
                  value={draftGt.skill}
                  onChange={e => setDraftGt(d => ({ ...d, skill: Number(e.target.value) }))}
                >
                  {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
                <span className="c-global-note">全スキル共通</span>
              </div>
              <span className="c-global-label">アペンド 目標</span>
              <div className="c-global-row">
                <select
                  className="c-global-dd"
                  value={draftGt.append}
                  onChange={e => setDraftGt(d => ({ ...d, append: Number(e.target.value) }))}
                >
                  {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
                <span className="c-global-note">全アペンド共通</span>
              </div>
              <button className="c-global-apply-btn" onClick={applyGlobalTarget}>
                ✓ 目標を更新する
              </button>
            </div>
          )}
        </div>

        {/* Filter bar */}
        <div className="c-filter-bar">
          <div className="c-filter-group" style={{ flexWrap: 'wrap', gap: 2 }}>
            {CLASS_LIST.map(cls => (
              <button
                key={cls.id}
                className={`c-class-tab${selClass === cls.id ? ' active' : ''}`}
                style={selClass === cls.id ? { color: cls.color } : {}}
                onClick={() => setSelClass(cls.id)}
              >
                <span className="c-tab-abbr">{cls.abbr}</span>
                <span className="c-tab-label">{cls.label}</span>
              </button>
            ))}
          </div>

          <div className="c-filter-sep" />

          <div className="c-filter-group">
            {[5, 4, 3, 2, 1].map(r => (
              <button
                key={r}
                className={`c-rarity-btn${selRarities.includes(r) ? ' active' : ''}`}
                onClick={() => toggleRarity(r)}
              >
                {'★'.repeat(r)}
              </button>
            ))}
          </div>

          <div className="c-filter-right">
            <button
              className={`c-hide-toggle${hideUnowned ? ' active' : ''}`}
              onClick={() => setHideUnowned(v => !v)}
            >
              {hideUnowned ? '全て表示' : '未所持を隠す'}
            </button>
          </div>
        </div>

        {/* Servant grid */}
        {filtered.length === 0 ? (
          <div className="c-empty">
            <div className="c-empty-icon">◎</div>
            <div className="c-empty-msg">条件に一致するサーヴァントはいません</div>
          </div>
        ) : (
          <div className="c-servant-grid">
            {filtered.map(s => (
              <ServantCard
                key={s.id}
                servant={s}
                state={chaldeaState[s.id] ?? DEFAULT_SERVANT_STATE}
                globalState={globalState}
                setState={handleSetServantState(s.id.toString())}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fixed calculate footer */}
      <div className="c-calc-footer">
        <button className="c-calc-btn" onClick={handleCalc}>
          <span className="c-calc-btn-en">CALCULATE MATERIALS</span>
          <span className="c-calc-btn-jp">必要な素材を計算する</span>
        </button>
      </div>
    </div>
  )
}
