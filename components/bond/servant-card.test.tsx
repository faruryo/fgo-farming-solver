// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ObservedPerRunInput } from './servant-card'
import type { BondTrackerEntry } from '../../lib/bond/state'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}))

const baseEntry: BondTrackerEntry = {
  servantId: 1,
  questId: 'quest-B',
  currentLevel: 0,
  remainingToNext: 100,
  targetLevel: 15,
  observedPerRun: 50,
  observedTeapotRun: false,
  measuredQuestId: 'quest-A',
}

describe('ObservedPerRunInput teapot checkbox', () => {
  it('keeps measuredQuestId unchanged when toggling the teapot checkbox', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const remeasure = vi.fn()

    render(
      <ObservedPerRunInput entry={baseEntry} questBase={undefined} remeasure={remeasure} onChange={onChange} />,
    )

    await user.click(screen.getByRole('checkbox'))

    expect(remeasure).not.toHaveBeenCalled()
    expect(onChange).toHaveBeenCalledTimes(1)
    const updated = onChange.mock.calls[0][0] as BondTrackerEntry
    expect(updated.measuredQuestId).toBe('quest-A')
    expect(updated.questId).toBe('quest-B')
    expect(updated.observedTeapotRun).toBe(true)
  })
})
