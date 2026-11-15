import { getCloudflareContext } from '@opennextjs/cloudflare'
import { canAccessFs, readLocalJson } from '../../../lib/data-source'
import { SERVANT_FACE_ICONS_KEY, SERVANT_FACE_ICONS_LOCAL_PATH } from '../../../lib/servant-face-icons/face-icons'
import type { FaceIconData } from '../../../lib/servant-roster-import/types'

export const dynamic = 'force-dynamic'

const unavailable = () => new Response('Servant face icons unavailable', {
  status: 503,
  headers: { 'Cache-Control': 'no-store' },
})

// dev server には KV の値が無いので、更新ジョブを DRY_RUN=1 で走らせて書き出したファイルを読む
const loadLocalFaceIcons = () => readLocalJson<FaceIconData>(SERVANT_FACE_ICONS_LOCAL_PATH)

export const servantFaceIconsResponse = async ({
  kv,
  isLocal,
  loadLocal = loadLocalFaceIcons,
}: {
  kv?: Pick<KVNamespace, 'get'>
  isLocal: boolean
  loadLocal?: () => Promise<FaceIconData | null>
}): Promise<Response> => {
  if (kv) {
    try {
      const stream = await kv.get(SERVANT_FACE_ICONS_KEY, { type: 'stream', cacheTtl: 300 })
      if (stream) {
        return new Response(stream, {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
        })
      }
    } catch {
      // A local Miniflare binding can exist before the data is seeded.
    }
  }
  if (!isLocal) return unavailable()
  try {
    const local = await loadLocal()
    return local ? Response.json(local, { headers: { 'Cache-Control': 'no-store' } }) : unavailable()
  } catch {
    return unavailable()
  }
}

export async function GET() {
  try {
    const { env } = (await getCloudflareContext({ async: true })) as unknown as {
      env: { MASTER_DATA?: KVNamespace }
    }
    return servantFaceIconsResponse({ kv: env.MASTER_DATA, isLocal: await canAccessFs() })
  } catch {
    return servantFaceIconsResponse({ isLocal: await canAccessFs() })
  }
}
