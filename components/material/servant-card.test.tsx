// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ServantCard } from './servant-card'
import { createServantState, ServantState } from '../../hooks/create-chaldea-state'
import { TargetKey } from '../../interfaces/atlas-academy'
import { makeServant } from './test-fixtures'

const servant = makeServant()

const ownedState = (): ServantState => ({
  ...createServantState(),
  disabled: false,
})

type WillStartChangeFn = (target: TargetKey, idx: number, prev: number, next: number) => boolean
type StartChangeFn = (target: TargetKey, idx: number, prev: number, next: number) => void

const renderCard = (
  state: ServantState,
  opts: {
    onWillStartChange?: WillStartChangeFn
    onStartChange?: StartChangeFn
  } = {}
) => {
  const setState = vi.fn()
  const globalState = createServantState()
  render(
    <ServantCard
      servant={servant}
      state={state}
      globalState={globalState}
      setState={(update) => setState(update(state))}
      onWillStartChange={opts.onWillStartChange}
      onStartChange={opts.onStartChange}
    />
  )
  return { setState }
}

describe('ServantCard - ascension pips', () => {
  it('clicking an unlit pip sets ascension start to that pip index and notifies onStartChange with (prev, next)', () => {
    const onStartChange = vi.fn()
    const onWillStartChange = vi.fn(() => true)
    const state = ownedState() // ascension start = 0
    const { setState } = renderCard(state, { onStartChange, onWillStartChange })

    const pips = document.querySelectorAll('.c-sum-pip')
    expect(pips).toHaveLength(4)
    fireEvent.click(pips[1]) // pip index 1 → value 2

    expect(onWillStartChange).toHaveBeenCalledWith('ascension', 0, 0, 2)
    expect(onStartChange).toHaveBeenCalledWith('ascension', 0, 0, 2)
    expect(setState).toHaveBeenCalledTimes(1)
    const next = setState.mock.calls[0][0] as ServantState
    expect(next.targets.ascension.ranges[0].start).toBe(2)
  })

  it('clicking the already-lit pip decrements ascension start by 1 (toggle-off semantics)', () => {
    const onStartChange = vi.fn()
    const state = ownedState()
    state.targets.ascension.ranges[0] = { start: 2, end: 4 }
    const { setState } = renderCard(state, { onStartChange })

    const pips = document.querySelectorAll('.c-sum-pip')
    fireEvent.click(pips[1]) // value 2 === current start → -1

    expect(onStartChange).toHaveBeenCalledWith('ascension', 0, 2, 1)
    const next = setState.mock.calls[0][0] as ServantState
    expect(next.targets.ascension.ranges[0].start).toBe(1)
  })

  it('does not go below the ascension minimum (0) via the right-click decrement', () => {
    const onStartChange = vi.fn()
    const state = ownedState() // start = 0
    renderCard(state, { onStartChange })

    const pips = document.querySelectorAll('.c-sum-pip')
    // Right-click decrement at start=0 would go to -1, clamped to 0 === prev → no-op
    fireEvent.contextMenu(pips[0])

    expect(onStartChange).not.toHaveBeenCalled()
  })

  it('blocks the state change when onWillStartChange returns false (e.g. tracking-mode shortage)', () => {
    const onStartChange = vi.fn()
    const onWillStartChange = vi.fn(() => false)
    const state = ownedState()
    const { setState } = renderCard(state, { onStartChange, onWillStartChange })

    const pips = document.querySelectorAll('.c-sum-pip')
    fireEvent.click(pips[1])

    expect(onWillStartChange).toHaveBeenCalledWith('ascension', 0, 0, 2)
    expect(setState).not.toHaveBeenCalled()
    expect(onStartChange).not.toHaveBeenCalled()
  })
})

describe('ServantCard - skill/append chips', () => {
  it('clicking a skill chip increments its start by 1, wrapping from 10 back to the minimum (1)', () => {
    const onStartChange = vi.fn()
    const state = ownedState()
    state.targets.skill.ranges[0] = { start: 10, end: 10 }
    const { setState } = renderCard(state, { onStartChange })

    const skillChips = document.querySelectorAll('.c-sum-card.sk')
    fireEvent.click(skillChips[0])

    expect(onStartChange).toHaveBeenCalledWith('skill', 0, 10, 1)
    const next = setState.mock.calls[0][0] as ServantState
    expect(next.targets.skill.ranges[0].start).toBe(1)
  })

  it('clicking an append chip increments its start by 1, wrapping from 10 back to 0', () => {
    const onStartChange = vi.fn()
    const state = ownedState()
    state.targets.appendSkill.ranges[0] = { start: 10, end: 10 }
    const { setState } = renderCard(state, { onStartChange })

    const appendChips = document.querySelectorAll('.c-sum-card.ap')
    fireEvent.click(appendChips[0])

    expect(onStartChange).toHaveBeenCalledWith('appendSkill', 0, 10, 0)
    const next = setState.mock.calls[0][0] as ServantState
    expect(next.targets.appendSkill.ranges[0].start).toBe(0)
  })
})

describe('ServantCard - long press / right click decrement', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('a long press (>=500ms) on a pip does NOT decrement; the following click applies normal click semantics (pips are exempt from long-press)', () => {
    const onStartChange = vi.fn()
    const state = ownedState()
    state.targets.ascension.ranges[0] = { start: 2, end: 4 }
    const { setState } = renderCard(state, { onStartChange })

    const pips = document.querySelectorAll('.c-sum-pip')
    fireEvent.pointerDown(pips[2]) // index 2 → value 3
    vi.advanceTimersByTime(500)
    // No long-press timer runs for pips, so nothing fires while held.
    expect(onStartChange).not.toHaveBeenCalled()
    fireEvent.pointerUp(pips[2])
    fireEvent.click(pips[2])

    // The click after release is a normal pip click: start 2 → 3.
    expect(onStartChange).toHaveBeenCalledTimes(1)
    expect(onStartChange).toHaveBeenCalledWith('ascension', 0, 2, 3)
    expect(setState).toHaveBeenCalledTimes(1)
  })

  it('a left-click right after a right-click on a pip still applies (the click-suppression flag does not leak across gestures)', () => {
    const onStartChange = vi.fn()
    const state = ownedState()
    state.targets.ascension.ranges[0] = { start: 2, end: 4 }
    renderCard(state, { onStartChange })

    const pips = document.querySelectorAll('.c-sum-pip')
    fireEvent.contextMenu(pips[1]) // right-click → -1 (2 → 1), sets the suppression flag
    expect(onStartChange).toHaveBeenCalledWith('ascension', 0, 2, 1)

    // Desktop right-click fires no click event, so the flag would linger.
    // The pip's pointerdown must reset it before the next click applies.
    fireEvent.pointerDown(pips[2])
    fireEvent.pointerUp(pips[2])
    fireEvent.click(pips[2]) // value 3

    expect(onStartChange).toHaveBeenCalledTimes(2)
    expect(onStartChange).toHaveBeenLastCalledWith('ascension', 0, 2, 3)
  })

  it('releasing before 500ms does not fire the long-press decrement, and the click still applies normally', () => {
    const onStartChange = vi.fn()
    const state = ownedState()
    state.targets.ascension.ranges[0] = { start: 1, end: 4 }
    renderCard(state, { onStartChange })

    const pips = document.querySelectorAll('.c-sum-pip')
    fireEvent.pointerDown(pips[2]) // index 2 → value 3
    vi.advanceTimersByTime(200)
    fireEvent.pointerUp(pips[2])
    fireEvent.click(pips[2])

    expect(onStartChange).toHaveBeenCalledTimes(1)
    expect(onStartChange).toHaveBeenCalledWith('ascension', 0, 1, 3)
  })

  it('right-click (contextmenu) on a skill chip decrements start by 1 without opening the browser context menu', () => {
    const onStartChange = vi.fn()
    const state = ownedState()
    state.targets.skill.ranges[1] = { start: 5, end: 10 }
    renderCard(state, { onStartChange })

    const skillChips = document.querySelectorAll('.c-sum-card.sk')
    const event = fireEvent.contextMenu(skillChips[1])

    expect(event).toBe(false) // fireEvent returns false when preventDefault() was called
    expect(onStartChange).toHaveBeenCalledWith('skill', 1, 5, 4)
  })

  it('does not decrement skill below its minimum (1)', () => {
    const onStartChange = vi.fn()
    const state = ownedState()
    state.targets.skill.ranges[0] = { start: 1, end: 10 }
    renderCard(state, { onStartChange })

    const skillChips = document.querySelectorAll('.c-sum-card.sk')
    fireEvent.contextMenu(skillChips[0])

    expect(onStartChange).not.toHaveBeenCalled()
  })
})

describe('ServantCard - owned toggle', () => {
  it('toggling the owned button flips `disabled` via setState and does not touch start values', () => {
    const state = ownedState()
    const setState = vi.fn()
    const globalState = createServantState()
    render(
      <ServantCard
        servant={servant}
        state={state}
        globalState={globalState}
        setState={(update) => setState(update(state))}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '✓ 所持' }))

    expect(setState).toHaveBeenCalledTimes(1)
    const next = setState.mock.calls[0][0] as ServantState
    expect(next.disabled).toBe(true)
    expect(next.targets).toBe(state.targets)
  })
})
