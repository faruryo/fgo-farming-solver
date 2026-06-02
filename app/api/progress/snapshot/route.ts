import { NextRequest } from 'next/server'
import { auth } from '../../../../lib/auth'
import { saveSnapshot } from '../../../../lib/progress/snapshot'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import type { CloudflareEnv } from '../../../../types/cloudflare-env'

export const dynamic = 'force-dynamic'

// Persists a full-state snapshot (including `material`) to `state_snapshots`
// only — it does NOT touch the cloud KV (`cloud:<userId>`). Called by the
// client after a successful solver run so progress comparisons have the chaldea
// state needed for new-servant detection. See sync spec: 状態スナップショットの保存.
type SnapshotRequestBody = {
  storage?: Record<string, string>
}

const hasMaterial = (body: SnapshotRequestBody): boolean => {
  const material = body.storage?.material
  return typeof material === 'string' && material.trim().length > 0
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: SnapshotRequestBody
  try {
    body = (await req.json()) as SnapshotRequestBody
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  // Do not let a material-less payload overwrite a material-containing snapshot.
  if (!hasMaterial(body)) {
    return new Response(null, { status: 204 })
  }

  let env: CloudflareEnv | undefined = undefined
  try {
    const context = (await getCloudflareContext({ async: true })) as unknown as {
      env: CloudflareEnv
    }
    env = context?.env || (context as unknown as CloudflareEnv)
  } catch (err) {
    console.warn('[api/progress/snapshot] Failed to get Cloudflare context locally:', err)
  }

  const db = env?.DB || (process.env as unknown as CloudflareEnv).DB
  if (!db) {
    // No DB locally → no-op (snapshot persistence is best-effort).
    return new Response(null, { status: 204 })
  }

  try {
    await saveSnapshot(db, session.user.id, body)
  } catch (e) {
    console.error('[api/progress/snapshot] snapshot save failed:', e)
    return Response.json({ error: 'Save failed' }, { status: 500 })
  }

  return new Response(null, { status: 204 })
}
