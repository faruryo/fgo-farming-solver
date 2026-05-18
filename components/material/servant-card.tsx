'use client'

import { memo, useCallback, useRef } from 'react'
import Image from 'next/image'
import NextLink from 'next/link'
import { NiceServant } from '../../interfaces/atlas-academy'
import { ServantState } from '../../hooks/create-chaldea-state'
import { TargetKey } from '../../interfaces/atlas-academy'
import { getClassInfo } from '../../constants/classes'
import { ServantStars } from '../common/ServantStars'

type Props = {
  servant: NiceServant
  state: ServantState
  globalState: ServantState
  setState: (update: (prev: ServantState) => ServantState) => void
  onWillStartChange?: (
    target: TargetKey,
    idx: number,
    prevStart: number,
    newStart: number
  ) => boolean
  onStartChange?: (
    target: TargetKey,
    idx: number,
    prevStart: number,
    newStart: number
  ) => void
}

const LONG_PRESS_MS = 500

const TARGET_MIN: Record<TargetKey, number> = {
  ascension: 0,
  skill: 1,
  appendSkill: 0,
}
const TARGET_MAX: Record<TargetKey, number> = {
  ascension: 4,
  skill: 10,
  appendSkill: 10,
}

const updateRangeStart = (
  s: ServantState,
  targetKey: TargetKey,
  idx: number,
  val: number
): ServantState => {
  const ranges = [...s.targets[targetKey].ranges]
  const defaultStart = targetKey === 'appendSkill' ? 0 : 1
  while (ranges.length <= idx) {
    ranges.push({ start: defaultStart, end: 10 })
  }
  ranges[idx] = { ...ranges[idx], start: val }
  return {
    ...s,
    targets: {
      ...s.targets,
      [targetKey]: {
        ...s.targets[targetKey],
        ranges,
      },
    },
  }
}

const ServantCardComponent = ({
  servant,
  state,
  globalState,
  setState,
  onWillStartChange,
  onStartChange,
}: Props) => {
  const cls = getClassInfo(servant.className)
  const cc = cls.color

  const owned = !state.disabled
  const ascCur = state.targets.ascension.ranges[0]?.start ?? 0
  const skillCur = state.targets.skill.ranges.map(r => r.start)
  const appendCur = Array.from({ length: 5 }, (_, i) => state.targets.appendSkill.ranges[i]?.start ?? 0)

  const gtAsc    = globalState.targets.ascension.ranges[0]?.end ?? 4
  const gtSkill  = globalState.targets.skill.ranges[0]?.end ?? 10
  const gtAppend = globalState.targets.appendSkill.ranges[0]?.end ?? 10

  const ascDone    = owned && ascCur >= gtAsc
  const skillDone  = owned && skillCur.every(v => v >= gtSkill)
  const appendDone = owned && appendCur.every(v => v >= gtAppend)

  const tierClass = appendDone && skillDone && ascDone
    ? 'tier-full'
    : skillDone && ascDone
    ? 'tier-skill'
    : ascDone
    ? 'tier-asc'
    : ''

  const toggleOwned = useCallback(
    () => setState(s => ({ ...s, disabled: !s.disabled })),
    [setState]
  )

  const applyStart = useCallback(
    (target: TargetKey, idx: number, prev: number, next: number) => {
      const min = TARGET_MIN[target]
      const max = TARGET_MAX[target]
      const clamped = Math.max(min, Math.min(max, next))
      if (clamped === prev) return
      if (onWillStartChange && !onWillStartChange(target, idx, prev, clamped)) return
      setState(s => updateRangeStart(s, target, idx, clamped))
      onStartChange?.(target, idx, prev, clamped)
    },
    [setState, onWillStartChange, onStartChange]
  )

  // Long-press / contextmenu helpers
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressFired = useRef(false)

  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handlePointerDown = (
    target: TargetKey,
    idx: number,
    cur: number
  ) => {
    longPressFired.current = false
    clearLongPress()
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      applyStart(target, idx, cur, cur - 1)
    }, LONG_PRESS_MS)
  }

  const handlePointerEndOrLeave = () => {
    clearLongPress()
  }

  const handleContextMenu = (
    e: React.MouseEvent,
    target: TargetKey,
    idx: number,
    cur: number
  ) => {
    e.preventDefault()
    clearLongPress()
    longPressFired.current = true
    applyStart(target, idx, cur, cur - 1)
  }

  const handlePipClick = (val: number) => {
    if (longPressFired.current) {
      longPressFired.current = false
      return
    }
    // Cycle: clicking same lit pip → -1, else → set to val
    if (ascCur === val) {
      applyStart('ascension', 0, ascCur, val - 1)
    } else {
      applyStart('ascension', 0, ascCur, val)
    }
  }

  const handleChipClick = (
    key: 'skill' | 'appendSkill',
    idx: number,
    cur: number,
    max: number
  ) => {
    if (longPressFired.current) {
      longPressFired.current = false
      return
    }
    const min = key === 'appendSkill' ? 0 : 1
    const next = cur >= max ? min : cur + 1
    applyStart(key, idx, cur, next)
  }

  const face = servant.extraAssets.faces.ascension?.[1] || Object.values(servant.extraAssets.faces.ascension || {})[0]

  return (
    <div id={`svt-${servant.id}`} className={`c-servant-card${state.disabled ? ' unowned' : ''}${tierClass ? ` ${tierClass}` : ''}`}>
      <div className="c-card-bar">
        <div className={`c-bar-seg${ascDone ? ' done-asc' : ''}`} />
        <div className={`c-bar-seg${skillDone ? ' done-skill' : ''}`} />
        <div className={`c-bar-seg${appendDone ? ' done-append' : ''}`} />
      </div>

      <NextLink
        href={`/servants/${servant.id}`}
        className="c-servant-portrait"
        style={{ background: `linear-gradient(150deg,${cc}22 0%,${cc}08 100%)`, textDecoration: 'none' }}
      >
        {face ? (
          <Image
            src={face}
            alt={servant.name}
            width={72}
            height={72}
            className="c-servant-face-img"
          />
        ) : (
          <div className="c-portrait-hex" style={{ color: cc }} />
        )}
        <div className="c-portrait-class" style={{ color: cc }}>
          {cls.abbr}
        </div>
        <div className="c-portrait-stars"><ServantStars rarity={servant.rarity} /></div>
      </NextLink>

      <div className="c-servant-body">
        <div className="c-servant-name">{servant.name}</div>
        <div className="c-servant-class-tag" style={{ color: cc }}>{cls.label}</div>
      </div>

      {owned && (
        <div className="c-summary-compact active">
          <div className="c-sum-group">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className={`c-sum-pip${ascCur >= i ? ' lit' : ''}`}
                onPointerDown={() => handlePointerDown('ascension', 0, ascCur)}
                onPointerUp={handlePointerEndOrLeave}
                onPointerLeave={handlePointerEndOrLeave}
                onPointerCancel={handlePointerEndOrLeave}
                onContextMenu={(e) => handleContextMenu(e, 'ascension', 0, ascCur)}
                onClick={() => handlePipClick(i)}
              />
            ))}
          </div>
          <div className="c-sum-div" />
          <div className="c-sum-group">
            {skillCur.map((v, i) => (
              <div
                key={i}
                className={`c-sum-card sk${v >= gtSkill ? ' done' : ''}`}
                onPointerDown={() => handlePointerDown('skill', i, v)}
                onPointerUp={handlePointerEndOrLeave}
                onPointerLeave={handlePointerEndOrLeave}
                onPointerCancel={handlePointerEndOrLeave}
                onContextMenu={(e) => handleContextMenu(e, 'skill', i, v)}
                onClick={() => handleChipClick('skill', i, v, 10)}
              >
                {v}
              </div>
            ))}
          </div>
          <div className="c-sum-div" />
          <div className="c-sum-group">
            {appendCur.map((v, i) => (
              <div
                key={i}
                className={`c-sum-card ap${v >= gtAppend ? ' done' : ''}`}
                onPointerDown={() => handlePointerDown('appendSkill', i, v)}
                onPointerUp={handlePointerEndOrLeave}
                onPointerLeave={handlePointerEndOrLeave}
                onPointerCancel={handlePointerEndOrLeave}
                onContextMenu={(e) => handleContextMenu(e, 'appendSkill', i, v)}
                onClick={() => handleChipClick('appendSkill', i, v, 10)}
              >
                {v}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="c-servant-controls">
        <button
          className={`c-owned-btn${owned ? ' on' : ''}`}
          onClick={toggleOwned}
        >
          {owned ? '✓ 所持' : '未所持'}
        </button>
      </div>
    </div>
  )
}

export const ServantCard = memo(ServantCardComponent)
