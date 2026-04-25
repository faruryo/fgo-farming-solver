'use client'

import { memo, useCallback } from 'react'
import Image from 'next/image'
import { NiceServant } from '../../interfaces/atlas-academy'
import { ServantState } from '../../hooks/create-chaldea-state'
import { TargetKey } from '../../interfaces/atlas-academy'
import { getClassInfo } from '../../constants/classes'

type Props = {
  servant: NiceServant
  state: ServantState
  globalState: ServantState
  setState: (update: (prev: ServantState) => ServantState) => void
}

const updateRangeStart = (
  s: ServantState,
  targetKey: TargetKey,
  idx: number,
  val: number
): ServantState => {
  const ranges = [...s.targets[targetKey].ranges]
  while (ranges.length <= idx) {
    ranges.push({ start: 1, end: 10 })
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

const ServantCardComponent = ({ servant, state, globalState, setState }: Props) => {
  const cls = getClassInfo(servant.className)
  const cc = cls.color

  const owned = !state.disabled
  const ascCur = state.targets.ascension.ranges[0]?.start ?? 0
  const skillCur = state.targets.skill.ranges.map(r => r.start)
  const appendCur = Array.from({ length: 5 }, (_, i) => state.targets.appendSkill.ranges[i]?.start ?? 1)

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

  const setAsc = (val: number) => setState(s => updateRangeStart(s, 'ascension', 0, val))
  const setSkill = (idx: number, val: number) => setState(s => updateRangeStart(s, 'skill', idx, val))
  const setAppend = (idx: number, val: number) => setState(s => updateRangeStart(s, 'appendSkill', idx, val))

  const handlePipClick = (val: number) => {
    // Cycle: 0 -> 1 -> 2 -> 3 -> 4 -> 0
    if (ascCur === val) {
      setAsc(val - 1)
    } else {
      setAsc(val)
    }
  }

  const handleChipClick = (key: 'skill' | 'appendSkill', idx: number, cur: number, max: number) => {
    const next = cur >= max ? 1 : cur + 1
    if (key === 'skill') setSkill(idx, next)
    else setAppend(idx, next)
  }

  const face = servant.extraAssets.faces.ascension?.[1] || Object.values(servant.extraAssets.faces.ascension || {})[0]

  return (
    <div className={`c-servant-card${state.disabled ? ' unowned' : ''}${tierClass ? ` ${tierClass}` : ''}`}>
      <div className="c-card-bar">
        <div className={`c-bar-seg${ascDone ? ' done-asc' : ''}`} />
        <div className={`c-bar-seg${skillDone ? ' done-skill' : ''}`} />
        <div className={`c-bar-seg${appendDone ? ' done-append' : ''}`} />
      </div>

      <div
        className="c-servant-portrait"
        style={{ background: `linear-gradient(150deg,${cc}22 0%,${cc}08 100%)` }}
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
        <div className="c-portrait-stars">{'★'.repeat(servant.rarity)}</div>
      </div>

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
