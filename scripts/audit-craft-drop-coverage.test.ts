import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const tsx = join(process.cwd(), 'node_modules', '.bin', 'tsx')
const script = join(process.cwd(), 'scripts', 'audit-craft-drop-coverage.ts')

const run = (dropsPath: string, itemsPath: string) => {
  try {
    const stdout = execFileSync(tsx, [script, dropsPath, itemsPath], { encoding: 'utf8' })
    return { code: 0, stdout }
  } catch (error) {
    const failed = error as { status?: number; stdout?: string | Buffer }
    const stdout = typeof failed.stdout === 'string' ? failed.stdout : ''
    return { code: failed.status ?? -1, stdout }
  }
}

describe('audit-craft-drop-coverage CLI', () => {
  it('穴があると exit 1 で id・名前・reason を出す', () => {
    const result = run('scripts/fixtures/craft-audit-hole-drops.json', 'scripts/fixtures/craft-audit-hole-items.json')
    expect(result.code).toBe(1)
    expect(result.stdout).toContain('6518\t素材6518\tabsent')
  })

  it('穴が無ければ exit 0', () => {
    const result = run('scripts/fixtures/craft-audit-ok-drops.json', 'scripts/fixtures/craft-audit-ok-items.json')
    expect(result.code).toBe(0)
    expect(result.stdout.trim()).toBe('gaps=0')
  })
})
