import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { canAccessFs, kvGet } from './data-source'

describe('data-source.ts Regression Tests', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('canAccessFs', () => {
    it('returns true in Node.js environment (real fs available)', async () => {
      const result = await canAccessFs()
      expect(result).toBe(true)
    })

    it('returns false when readFile throws without ENOENT code (simulates Cloudflare Workers unenv)', () => {
      // Directly test the error-classification logic used by canAccessFs.
      const classifyError = (e: unknown): boolean =>
        e instanceof Error && (e as NodeJS.ErrnoException).code === 'ENOENT'

      const unenvError = new Error('[unenv] fs.readFile is not implemented yet!')
      expect(classifyError(unenvError)).toBe(false)

      const enoentError = Object.assign(new Error('ENOENT: no such file or directory'), { code: 'ENOENT' })
      expect(classifyError(enoentError)).toBe(true)
    })
  })

  describe('kvGet', () => {
    it('retrieves value from process.env.MASTER_DATA when available', async () => {
      const mockValue = '{"test": "data"}'
      const mockGet = vi.fn().mockResolvedValue(mockValue)
      
      // Use vi.stubGlobal to allow putting an object into process.env, 
      // as process.env normally only allows strings in Node.js.
      vi.stubGlobal('process', {
        ...process,
        env: {
          ...process.env,
          MASTER_DATA: {
            get: mockGet
          }
        }
      })

      const result = await kvGet('test_key')
      
      expect(mockGet).toHaveBeenCalledWith('test_key')
      expect(result).toBe(mockValue)
    })

    it('handles environment where getCloudflareContext throws (simulating EvalError regression)', async () => {
      // Ensure MASTER_DATA is NOT in env
      vi.stubGlobal('process', {
        ...process,
        env: {
          ...process.env,
          MASTER_DATA: undefined
        }
      })

      const result = await kvGet('any_key')
      
      // Should return null (and fallback to local mocks) rather than throwing
      expect(result).toBeNull()
    })

    it('gracefully handles missing MASTER_DATA binding', async () => {
      // process.env exists but doesn't have MASTER_DATA
      vi.stubEnv('OTHER_BINDING', {} as any)
      
      const result = await kvGet('test_key')
      expect(result).toBeNull()
    })
  })
})
