import path from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  collectInventory,
  compareInventory,
  mergeBaselineViolations,
  normalizeFile,
  parseCliArgs,
  type LintResultLike,
  type LintViolation,
} from './lint-ratchet-inventory'

const warning = (
  file: string,
  rule: string,
  count: number,
): LintViolation => ({ file, rule, count })

describe('parseCliArgs', () => {
  it.each([
    {
      name: 'no args → full-repo check',
      argv: [],
      expected: { writeBaseline: false, fix: false, files: [] },
    },
    {
      name: '--write and --fix with files',
      argv: ['--write', '--fix', 'lib/a.ts', 'app/b.tsx'],
      expected: {
        writeBaseline: true,
        fix: true,
        files: ['lib/a.ts', 'app/b.tsx'],
      },
    },
    {
      name: 'ignores -- separator',
      argv: ['--', 'lib/a.ts'],
      expected: { writeBaseline: false, fix: false, files: ['lib/a.ts'] },
    },
  ])('$name', ({ argv, expected }) => {
    expect(parseCliArgs(argv)).toEqual(expected)
  })

  it('rejects unknown flags', () => {
    expect(() => parseCliArgs(['--quiet'])).toThrow('Unknown flag: --quiet')
  })
})

describe('normalizeFile', () => {
  const cwd = '/repo'

  it('keeps repo-relative paths and uses forward slashes', () => {
    expect(normalizeFile(path.join('lib', 'a.ts'), cwd)).toBe('lib/a.ts')
  })

  it('strips cwd from absolute paths', () => {
    expect(normalizeFile(`${cwd}/lib/a.ts`, cwd)).toBe('lib/a.ts')
  })

  it('drops a leading ./ from lint-staged relative paths', () => {
    expect(normalizeFile('./lib/a.ts', cwd)).toBe('lib/a.ts')
  })
})

describe('collectInventory', () => {
  const cwd = '/repo'

  it('counts warnings per file/rule and ignores errors and null rules', () => {
    const results: LintResultLike[] = [
      {
        filePath: '/repo/lib/a.ts',
        messages: [
          { severity: 1, ruleId: 'complexity' },
          { severity: 1, ruleId: 'complexity' },
          { severity: 2, ruleId: 'no-undef' },
          { severity: 1, ruleId: null },
        ],
      },
      {
        filePath: '/repo/lib/b.ts',
        messages: [{ severity: 1, ruleId: 'max-depth' }],
      },
    ]

    expect(collectInventory(results, cwd)).toEqual([
      warning('lib/a.ts', 'complexity', 2),
      warning('lib/b.ts', 'max-depth', 1),
    ])
  })
})

describe('compareInventory', () => {
  const baseline = [
    warning('lib/a.ts', 'complexity', 2),
    warning('lib/b.ts', 'max-depth', 3),
  ]

  it('reports increases against the baseline', () => {
    const current = [
      warning('lib/a.ts', 'complexity', 3),
      warning('lib/b.ts', 'max-depth', 3),
    ]
    const { increases, reductions } = compareInventory(current, baseline)
    expect(increases).toEqual([warning('lib/a.ts', 'complexity', 3)])
    expect(reductions).toEqual([])
  })

  it('treats a new file/rule as an increase from 0', () => {
    const current = [
      ...baseline,
      warning('lib/c.ts', 'no-explicit-any', 1),
    ]
    const { increases } = compareInventory(current, baseline)
    expect(increases).toEqual([warning('lib/c.ts', 'no-explicit-any', 1)])
  })

  it('reports reductions when a file/rule count drops', () => {
    const current = [warning('lib/a.ts', 'complexity', 1)]
    const { increases, reductions } = compareInventory(current, baseline)
    expect(increases).toEqual([])
    expect(reductions).toEqual([
      warning('lib/a.ts', 'complexity', 2),
      warning('lib/b.ts', 'max-depth', 3),
    ])
  })

  it('does not treat unlinted files as reductions when scoped to staged files', () => {
    const current = [warning('lib/a.ts', 'complexity', 2)]
    const { increases, reductions } = compareInventory(
      current,
      baseline,
      new Set(['lib/a.ts']),
    )
    expect(increases).toEqual([])
    expect(reductions).toEqual([])
  })

  it('still reports an increase on a staged file when scoped', () => {
    const current = [warning('lib/a.ts', 'complexity', 4)]
    const { increases, reductions } = compareInventory(
      current,
      baseline,
      new Set(['lib/a.ts']),
    )
    expect(increases).toEqual([warning('lib/a.ts', 'complexity', 4)])
    expect(reductions).toEqual([])
  })

  it('still reports a reduction on a staged file when scoped', () => {
    const current: LintViolation[] = []
    const { reductions } = compareInventory(
      current,
      baseline,
      new Set(['lib/a.ts']),
    )
    expect(reductions).toEqual([warning('lib/a.ts', 'complexity', 2)])
  })
})

describe('mergeBaselineViolations', () => {
  it('replaces only the updated files and keeps the rest', () => {
    const existing = [
      warning('lib/a.ts', 'complexity', 2),
      warning('lib/b.ts', 'max-depth', 3),
    ]
    const next = [warning('lib/a.ts', 'complexity', 1)]
    expect(
      mergeBaselineViolations(existing, next, new Set(['lib/a.ts'])),
    ).toEqual([
      warning('lib/a.ts', 'complexity', 1),
      warning('lib/b.ts', 'max-depth', 3),
    ])
  })

  it('drops a file from the baseline when its staged inventory is empty', () => {
    const existing = [
      warning('lib/a.ts', 'complexity', 2),
      warning('lib/b.ts', 'max-depth', 3),
    ]
    expect(mergeBaselineViolations(existing, [], new Set(['lib/a.ts']))).toEqual([
      warning('lib/b.ts', 'max-depth', 3),
    ])
  })
})
