import { NextRequest, NextResponse } from 'next/server'
import { getResult } from '../../../../../lib/get-result'
import { auth } from '../../../../../lib/auth'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { CloudflareEnv } from '../../../../../types/cloudflare-env'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, session] = await Promise.all([params, auth()])
    const result = await getResult(id, session?.user?.id)
    return NextResponse.json(result)
  } catch (e) {
    console.error('Failed to get result:', e)
    return NextResponse.json({ error: 'Not Found' }, { status: 404 })
  }
}

async function updateResultVisibility(
  db: D1Database,
  id: string,
  userId: string,
  isPublic: boolean
): Promise<boolean> {
  const target = await db
    .prepare('SELECT batch_id, user_id FROM farming_results WHERE id = ?')
    .bind(id)
    .first<{ batch_id: string | null; user_id: string }>()

  if (!target || target.user_id !== userId) {
    return false
  }

  const newVisibility = isPublic ? 1 : 0
  const statement = target.batch_id
    ? db
        .prepare(
          'UPDATE farming_results SET is_public = ? WHERE batch_id = ? AND user_id = ?'
        )
        .bind(newVisibility, target.batch_id, userId)
    : db
        .prepare(
          'UPDATE farming_results SET is_public = ? WHERE id = ? AND user_id = ?'
        )
        .bind(newVisibility, id, userId)

  const result = await statement.run()
  return result.meta.changes > 0
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { isPublic?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || typeof body.isPublic !== 'boolean') {
    return NextResponse.json({ error: 'isPublic must be a boolean' }, { status: 400 })
  }

  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json({ ok: true, isPublic: body.isPublic })
  }

  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }
  const db = env?.DB || (process.env as unknown as CloudflareEnv).DB

  if (!db) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  try {
    const { id } = await params
    const updated = await updateResultVisibility(db, id, session.user.id, body.isPublic)
    if (!updated) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, isPublic: body.isPublic })
  } catch (e) {
    console.error('Failed to update result visibility:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// Soft delete: sets deleted_at so the row drops out of history (and all
// history-driven charts) while the result page / shared links keep working.
// batch_id を持つ行は A/B 両行を同時に論理削除する(連動削除・D4)。
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json({ ok: true })
  }

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { env } = (await getCloudflareContext({ async: true })) as unknown as {
    env: CloudflareEnv
  }
  const db = env?.DB || (process.env as unknown as CloudflareEnv).DB

  if (!db) {
    return NextResponse.json({ error: 'Database not available' }, { status: 500 })
  }

  try {
    const { id } = await params

    // 対象行の所有者と batch_id を確認する。
    const target = await db.prepare(
      'SELECT batch_id, user_id FROM farming_results WHERE id = ? AND deleted_at IS NULL'
    )
      .bind(id)
      .first<{ batch_id: string | null; user_id: string }>()

    if (!target || target.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 })
    }

    if (target.batch_id) {
      // batch_id 単位で A/B 両行を同時に論理削除する。
      const result = await db.prepare(
        'UPDATE farming_results SET deleted_at = CURRENT_TIMESTAMP WHERE batch_id = ? AND user_id = ? AND deleted_at IS NULL'
      )
        .bind(target.batch_id, session.user.id)
        .run()
      if (result.meta.changes === 0) {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 })
      }
    } else {
      // 単独行の論理削除(従来挙動)。
      const result = await db.prepare(
        'UPDATE farming_results SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND deleted_at IS NULL'
      )
        .bind(id, session.user.id)
        .run()
      if (result.meta.changes === 0) {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Failed to delete result:', e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
