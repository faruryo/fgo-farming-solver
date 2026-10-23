import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const FILTER = path.join(__dirname, '../.github/actions/setup-node/pick-version.jq')
// 2026-10-22 の7日前
const CUTOFF = '2026-10-15'

type Release = { version: string; date: string; security: boolean }

const pick = (releases: Release[]) =>
  execFileSync(
    'jq',
    ['-er', '--arg', 'major', '24', '--arg', 'cutoff', CUTOFF, '-f', FILTER],
    { input: JSON.stringify(releases), stdio: 'pipe' },
  )
    .toString()
    .trim()

describe('.github/actions/setup-node/pick-version.jq', () => {
  it('takes a security release on the day it ships', () => {
    expect(
      pick([
        { version: 'v24.22.1', date: '2026-10-22', security: true },
        { version: 'v24.22.0', date: '2026-10-14', security: false },
      ]),
    ).toBe('24.22.1')
  })

  it('skips a non-security release younger than 7 days', () => {
    expect(
      pick([
        { version: 'v24.23.0', date: '2026-10-16', security: false },
        { version: 'v24.22.1', date: '2026-10-01', security: true },
      ]),
    ).toBe('24.22.1')
  })

  it('takes a non-security release once it is 7 days old', () => {
    expect(
      pick([
        { version: 'v24.23.0', date: CUTOFF, security: false },
        { version: 'v24.22.1', date: '2026-10-01', security: true },
      ]),
    ).toBe('24.23.0')
  })

  it('ignores other major lines', () => {
    expect(
      pick([
        { version: 'v26.12.1', date: '2026-10-01', security: true },
        { version: 'v240.0.0', date: '2026-10-01', security: true },
        { version: 'v24.21.0', date: '2026-09-07', security: false },
      ]),
    ).toBe('24.21.0')
  })

  it('compares versions numerically regardless of input order', () => {
    expect(
      pick([
        { version: 'v24.9.0', date: '2025-09-25', security: false },
        { version: 'v24.22.0', date: '2026-10-14', security: false },
      ]),
    ).toBe('24.22.0')
  })

  it('fails when no release qualifies', () => {
    expect(() =>
      pick([{ version: 'v24.23.0', date: '2026-10-20', security: false }]),
    ).toThrow()
  })
})
