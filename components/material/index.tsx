'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { NiceServant, Item, TargetKey } from '../../interfaces/atlas-academy'
import { MaterialsForServants } from '../../lib/get-materials'
import { useChaldeaState } from '../../hooks/use-chaldea-state'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { createServantState, ServantState } from '../../hooks/create-chaldea-state'
import { sumMaterials } from '../../lib/sum-materials'
import { diffMaterialsForStartChange } from '../../lib/diff-materials'
import { showTrackingToast, showBlockedToast } from '../../lib/tracking-toast'
import Image from 'next/image'
import { CLASS_LIST, ClassId } from '../../constants/classes'
import { ClassName } from '../../interfaces/atlas-academy'
import { getClassIconUrl } from '../../lib/get-class-icon-url'
import { ServantCard } from './servant-card'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type MaterialIndexProps = {
  servants: NiceServant[]
  materials: MaterialsForServants
  items: Item[]
  locale?: string
}

const DEFAULT_SERVANT_STATE = createServantState()

const hasNonZeroPossession = (p: Record<string, number | undefined>): boolean =>
  Object.values(p).some(v => typeof v === 'number' && v > 0)

export const Index = ({
  servants = [],
  materials = {},
  items = [],
}: MaterialIndexProps) => {
  const router = useRouter()
  const ids = useMemo(() => servants.map(s => s.id.toString()), [servants])
  const [chaldeaState, setChaldeaState] = useChaldeaState(ids)

  const [selClass, setSelClass] = useState<ClassId>('all')
  const [selRarities, setSelRarities] = useState<number[]>([])
  const [servantFilter, setServantFilter] = useState<'all' | 'hide-unowned' | 'only-unowned' | 'hide-done' | 'only-done'>('all')
  type ServantSortMode = 'collectionNo' | 'new' | 'rarity-desc' | 'rarity-asc'
  const [sortMode, setSortMode] = useState<ServantSortMode>('collectionNo')
  const [showGlobal, setShowGlobal] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Tracking mode + possession sharing
  const [trackingMode, setTrackingMode] = useLocalStorage<boolean>(
    'material/tracking-mode',
    false
  )
  const [trackingDismissed, setTrackingDismissed] = useLocalStorage<boolean>(
    'material/tracking-suggest-dismissed',
    false
  )
  const [possession, setPossession] = useLocalStorage<Record<string, number | undefined>>(
    'posession',
    {}
  )

  // Keep a ref so applyStartChange always sees the latest possession synchronously
  const possessionRef = useRef(possession)
  useEffect(() => {
    possessionRef.current = possession
  }, [possession])

  // Detect whether possession has ever been non-zero (drives suggestion banner)
  const [hasPossessionInput, setHasPossessionInput] = useState(false)
  useEffect(() => {
    if (!hasPossessionInput && hasNonZeroPossession(possession)) {
      setHasPossessionInput(true)
    }
  }, [possession, hasPossessionInput])

  const itemsById = useMemo(() => {
    const map: Record<string, Item> = {}
    items.forEach(it => { map[it.id.toString()] = it })
    return map
  }, [items])

  const servantsById = useMemo(() => {
    const map: Record<string, NiceServant> = {}
    servants.forEach(s => { map[s.id.toString()] = s })
    return map
  }, [servants])

  const [currentHash, setCurrentHash] = useState('')
  const processedHash = useRef('')
  useEffect(() => {
    const handleHashChange = () => setCurrentHash(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    setCurrentHash(window.location.hash)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])


  const gtAsc    = chaldeaState.all?.targets.ascension.ranges[0]?.end ?? 4
  const gtSkill  = chaldeaState.all?.targets.skill.ranges[0]?.end ?? 10
  const gtAppend = chaldeaState.all?.targets.appendSkill.ranges[0]?.end ?? 10

  // Apply a global target field to all servants immediately on change
  const applyGlobal = useCallback((field: 'asc' | 'skill' | 'append', value: number) => {
    setChaldeaState(prev =>
      Object.fromEntries(
        Object.entries(prev).map(([id, s]) => [id, {
          ...s,
          targets: {
            ascension:   { ...s.targets.ascension,   ranges: s.targets.ascension.ranges.map(r => ({ ...r, end: field === 'asc'    ? value : r.end })) },
            skill:       { ...s.targets.skill,       ranges: s.targets.skill.ranges.map(r =>       ({ ...r, end: field === 'skill'  ? value : r.end })) },
            appendSkill: { ...s.targets.appendSkill, ranges: Array.from({ length: 5 }, (_, i) => ({
              start: s.targets.appendSkill.ranges[i]?.start ?? 0,
              end:   field === 'append' ? value : (s.targets.appendSkill.ranges[i]?.end ?? 10),
            }))},
          },
        }])
      )
    )
  }, [setChaldeaState])

  // Pre-check: returns false and shows blocked toast when tracking mode ON and items insufficient.
  const checkStartChange = useCallback(
    (
      servantId: string,
      target: TargetKey,
      idx: number,
      prevStart: number,
      newStart: number
    ): boolean => {
      if (!trackingMode) return true
      if (servantId === 'all') return true
      if (newStart <= prevStart) return true  // returns are always allowed

      const servantMats = materials[servantId]
      if (!servantMats) return true

      const delta = diffMaterialsForStartChange(servantMats, target, prevStart, newStart)
      if (!delta || delta.direction !== 'consume') return true

      const poss = possessionRef.current
      const shortageItems = delta.items
        .filter(({ itemId, amount }) => (poss[itemId] ?? 0) < amount)
        .map(({ itemId, amount }) => ({
          itemId,
          owned: poss[itemId] ?? 0,
          required: amount,
          name: itemsById[itemId]?.name ?? itemId,
          icon: itemsById[itemId]?.icon,
        }))

      if (shortageItems.length === 0) return true

      const servant = servantsById[servantId]
      showBlockedToast({
        servantName: servant?.name ?? servantId,
        target,
        idx,
        prevStart,
        newStart,
        shortageItems,
        onSetPossession: (newValues) =>
          setPossession((prev) => ({ ...prev, ...newValues })),
      })
      return false
    },
    [trackingMode, materials, servantsById, itemsById, setPossession]
  )

  // Apply possession after a confirmed (unblocked) start change.
  const applyStartChange = useCallback(
    (
      servantId: string,
      target: TargetKey,
      idx: number,
      prevStart: number,
      newStart: number
    ) => {
      if (!trackingMode) return
      if (servantId === 'all') return
      if (prevStart === newStart) return

      const servantMats = materials[servantId]
      if (!servantMats) return

      const delta = diffMaterialsForStartChange(servantMats, target, prevStart, newStart)
      if (!delta) return

      setPossession(prev => {
        const next: Record<string, number | undefined> = { ...prev }
        delta.items.forEach(({ itemId, amount }) => {
          const cur = next[itemId] ?? 0
          next[itemId] = delta.direction === 'consume' ? cur - amount : cur + amount
        })
        return next
      })

      const servant = servantsById[servantId]
      if (!servant) return

      showTrackingToast({
        servantId,
        servantName: servant.name,
        servantMaterials: servantMats,
        target,
        idx,
        prevStart,
        newStart,
        itemsById,
      })
    },
    [trackingMode, materials, setPossession, servantsById, itemsById]
  )

  const { ownedCount, doneCount } = useMemo(() => {
    let owned = 0, done = 0
    servants.forEach(s => {
      const st = chaldeaState[s.id]
      if (!st || st.disabled) return
      owned++
      const appends = Array.from({ length: 5 }, (_, i) => st.targets.appendSkill.ranges[i]?.start ?? 0)
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
        // beastEresh starts with 'beast'; unBeastOlgaMarie contains 'Beast'
        if (targetClass.toLowerCase().includes('beast')) targetClass = 'beast'
        if (selClass !== targetClass) return false
      }
      if (selRarities.length > 0 && !selRarities.includes(Number(s.rarity))) return false
      const st = chaldeaState[s.id]
      const unowned = st?.disabled ?? true
      if (servantFilter === 'hide-unowned' && unowned) return false
      if (servantFilter === 'only-unowned' && !unowned) return false
      if (servantFilter === 'hide-done' || servantFilter === 'only-done') {
        const appends = Array.from({ length: 5 }, (_, i) => st?.targets.appendSkill.ranges[i]?.start ?? 0)
        const done = !unowned &&
          (st?.targets.ascension.ranges[0]?.start ?? 0) >= gtAsc &&
          (st?.targets.skill.ranges.every(r => r.start >= gtSkill) ?? false) &&
          appends.every(v => v >= gtAppend)
        if (servantFilter === 'hide-done' && done) return false
        if (servantFilter === 'only-done' && !done) return false
      }
      return true
    }),
    [servants, selClass, selRarities, servantFilter, chaldeaState, gtAsc, gtSkill, gtAppend]
  )

  const sorted = useMemo(() => {
    if (sortMode === 'new') {
      return [...filtered].sort((a, b) => b.collectionNo - a.collectionNo)
    }
    if (sortMode === 'rarity-desc') {
      return [...filtered].sort((a, b) =>
        b.rarity !== a.rarity ? b.rarity - a.rarity : a.collectionNo - b.collectionNo
      )
    }
    if (sortMode === 'rarity-asc') {
      return [...filtered].sort((a, b) =>
        a.rarity !== b.rarity ? a.rarity - b.rarity : a.collectionNo - b.collectionNo
      )
    }
    return filtered
  }, [filtered, sortMode])

  // Handle automatic scroll and filter reset based on URL hash
  useEffect(() => {
    if (!mounted) return

    // Reset processed hash if the hash cleared or changed to non-servant hash
    if (!currentHash.startsWith('#svt-')) {
      processedHash.current = ''
      return
    }

    // Skip if we already highlighted this specific hash to avoid redundant triggers
    // during servant state updates (which change 'sorted' array)
    if (currentHash === processedHash.current) return

    const svtId = parseInt(currentHash.replace('#svt-', ''))
    if (isNaN(svtId)) return

    // Ensure the servant is visible by resetting filters if necessary
    const isVisible = sorted.some(s => s.id === svtId)
    if (!isVisible) {
      const targetExists = servants.some(s => s.id === svtId)
      if (targetExists) {
        setSelClass('all')
        setSelRarities([])
        setServantFilter('all')
        setSortMode('collectionNo')
        return // Effect will re-run after state update
      }
    }

    // Scroll after a short delay to ensure DOM is ready
    const timer = setTimeout(() => {
      const elementId = currentHash.substring(1)
      const el = document.getElementById(elementId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.classList.add('u-highlight')
        processedHash.current = currentHash // Mark as processed
        setTimeout(() => el.classList.remove('u-highlight'), 5000)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [mounted, servants, sorted, currentHash])

  const handleSetServantState = useCallback(
    (id: string) => (update: (prev: ServantState) => ServantState) => {
      setChaldeaState(prev => ({ ...prev, [id]: update(prev[id]) }))
    },
    [setChaldeaState]
  )

  const handleWillStartChange = useCallback(
    (id: string) =>
      (target: TargetKey, idx: number, prev: number, next: number): boolean =>
        checkStartChange(id, target, idx, prev, next),
    [checkStartChange]
  )

  const handleOnStartChange = useCallback(
    (id: string) =>
      (target: TargetKey, idx: number, prev: number, next: number) =>
        applyStartChange(id, target, idx, prev, next),
    [applyStartChange]
  )

  const handleCalc = () => {
    const result = sumMaterials(chaldeaState, materials)
    localStorage.setItem('material/result', JSON.stringify(result))
    router.push('/material/result')
  }

  const globalState = chaldeaState.all ?? DEFAULT_SERVANT_STATE

  const showSuggestionBanner =
    mounted &&
    !trackingMode &&
    !trackingDismissed &&
    hasPossessionInput

  if (!mounted) return <div className="c-page" />

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
            {trackingMode && (
              <span
                style={{
                  color: 'var(--red)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  marginRight: 8,
                }}
                title="育成記録モード ON"
              >
                ● REC
              </span>
            )}
            <span className="c-global-note">再臨 {gtAsc} ／ スキル {gtSkill} ／ アペンド {gtAppend}</span>
            <span className={`c-global-chevron${showGlobal ? ' open' : ''}`}>▼</span>
          </div>
          {showGlobal && (
            <div className="c-global-body">
              <span className="c-global-label">霊基再臨 目標</span>
              <div className="c-global-row">
                <select
                  className="c-global-dd"
                  value={gtAsc}
                  onChange={e => applyGlobal('asc', Number(e.target.value))}
                >
                  {[0, 1, 2, 3, 4].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <span className="c-global-note">段階</span>
              </div>
              <span className="c-global-label">スキル 目標</span>
              <div className="c-global-row">
                <select
                  className="c-global-dd"
                  value={gtSkill}
                  onChange={e => applyGlobal('skill', Number(e.target.value))}
                >
                  {Array.from({ length: 10 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
                </select>
                <span className="c-global-note">全スキル共通</span>
              </div>
              <span className="c-global-label">アペンド 目標</span>
              <div className="c-global-row">
                <select
                  className="c-global-dd"
                  value={gtAppend}
                  onChange={e => applyGlobal('append', Number(e.target.value))}
                >
                  {Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}</option>)}
                </select>
                <span className="c-global-note">全アペンド共通</span>
              </div>
              <span className="c-global-label">育成記録モード</span>
              <div className="c-global-row" style={{ alignItems: 'center', gap: 10 }}>
                <Switch
                  checked={trackingMode}
                  onCheckedChange={(v) => {
                    setTrackingMode(v)
                    if (v) setTrackingDismissed(true)
                  }}
                  aria-label="育成記録モード"
                />
                <span className="c-global-note">
                  {trackingMode ? 'ON: 現在値変更で所持数を増減します' : 'OFF: 現在値変更は所持数に影響しません'}
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={<button type="button" aria-label="ヘルプ" />}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: '1px solid var(--border, #555)',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'help',
                      fontSize: 11,
                      lineHeight: 1,
                    }}
                  >
                    ?
                  </TooltipTrigger>
                  <TooltipContent>
                    <div style={{ maxWidth: 240, fontSize: 11, lineHeight: 1.5 }}>
                      タップ:+1 ／ 長押し:-1<br />
                      ON 時、現在値を変更すると所持数を自動で増減します。
                    </div>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          )}
        </div>

        {/* Tracking mode suggestion banner */}
        {showSuggestionBanner && (
          <div
            style={{
              border: '1px solid var(--border, #444)',
              borderRadius: 8,
              padding: '10px 12px',
              margin: '8px 0',
              background: 'var(--card, #1a1a1a)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: 1, fontSize: 13 }}>
              セットアップが進んでいるようです。今後の現在値変更で所持数を自動で増減する「育成記録モード」をオンにしますか？
            </div>
            <button
              type="button"
              onClick={() => {
                setTrackingMode(true)
                setTrackingDismissed(true)
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border, #555)',
                background: 'var(--primary, #4a6fa5)',
                color: 'var(--primary-foreground, #fff)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              ON にする
            </button>
            <button
              type="button"
              onClick={() => setTrackingDismissed(true)}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid var(--border, #555)',
                background: 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              今はやめておく
            </button>
          </div>
        )}

        {/* Filter bar */}
        <div className="c-filter-bar">
          <div className="c-filter-group" style={{ flexWrap: 'wrap', gap: 8 }}>
            {CLASS_LIST.map(cls => {
              const iconUrl = cls.id !== 'all' ? getClassIconUrl(cls.id as ClassName, 5) : ''
              const isActive = selClass === cls.id
              return (
                <button
                  key={cls.id}
                  className={`c-class-tab${isActive ? ' active' : ''}`}
                  style={isActive ? { borderColor: cls.color } : {}}
                  onClick={() => setSelClass(cls.id)}
                  title={cls.label}
                >
                  {iconUrl ? (
                    <Image
                      src={iconUrl}
                      alt={cls.label}
                      width={24}
                      height={24}
                      style={{ objectFit: 'contain', opacity: isActive ? 1 : 0.55 }}
                    />
                  ) : (
                    <span className="c-tab-abbr" style={isActive ? { color: cls.color } : {}}>{cls.abbr}</span>
                  )}
                  <span className="c-tab-label">{cls.label}</span>
                </button>
              )
            })}
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
            <select
              className={`c-filter-select${sortMode !== 'collectionNo' ? ' active' : ''}`}
              value={sortMode}
              onChange={e => setSortMode(e.target.value as ServantSortMode)}
            >
              <option value="collectionNo">図鑑No.順</option>
              <option value="new">新しい順</option>
              <option value="rarity-desc">レアリティ↓</option>
              <option value="rarity-asc">レアリティ↑</option>
            </select>
            <select
              className={`c-filter-select${servantFilter !== 'all' ? ' active' : ''}`}
              value={servantFilter}
              onChange={e => setServantFilter(e.target.value as typeof servantFilter)}
            >
              <option value="all">全表示</option>
              <option value="hide-unowned">未所持を隠す</option>
              <option value="only-unowned">未所持のみ</option>
              <option value="hide-done">育成完了を隠す</option>
              <option value="only-done">育成完了のみ</option>
            </select>
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
            {sorted.map(s => (
              <ServantCard
                key={s.id}
                servant={s}
                state={chaldeaState[s.id] ?? DEFAULT_SERVANT_STATE}
                globalState={globalState}
                setState={handleSetServantState(s.id.toString())}
                onWillStartChange={handleWillStartChange(s.id.toString())}
                onStartChange={handleOnStartChange(s.id.toString())}
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
