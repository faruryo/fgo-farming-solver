import type { D1Database } from '@cloudflare/workers-types'

const INSERT_JTI =
  'INSERT INTO preview_auth_jti (jti) VALUES (?) ON CONFLICT(jti) DO NOTHING'

export const d1ConsumeJti =
  (db: D1Database) =>
  async (jti: string): Promise<boolean> => {
    try {
      const result = await db.prepare(INSERT_JTI).bind(jti).run()
      return result.meta.changes === 1
    } catch {
      return false
    }
  }
