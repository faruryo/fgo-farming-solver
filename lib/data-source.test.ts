import { describe, it, expect } from 'vitest'
import { canAccessFs } from './data-source'

describe('canAccessFs', () => {
  it('returns true in Node.js environment (real fs available)', async () => {
    const result = await canAccessFs()
    expect(result).toBe(true)
  })

  it('returns false when readFile throws without ENOENT code (simulates Cloudflare Workers unenv)', () => {
    // Directly test the error-classification logic used by canAccessFs.
    // In Cloudflare Workers, unenv stubs throw Error without a .code property.
    const classifyError = (e: unknown): boolean =>
      e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT'

    const unenvError = new Error('[unenv] fs.readFile is not implemented yet!')
    expect(classifyError(unenvError)).toBe(false)

    const enoentError = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
    expect(classifyError(enoentError)).toBe(true)

    const permError = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' })
    expect(classifyError(permError)).toBe(false)
  })
})
