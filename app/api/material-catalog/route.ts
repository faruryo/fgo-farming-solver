import { getCloudflareContext } from '@opennextjs/cloudflare'
import { canAccessFs } from '../../../lib/data-source'
import { loadLocalMaterialCatalog } from '../../../lib/material-catalog-local'
import { MATERIAL_CATALOG_KEY } from '../../../lib/material-catalog'

export const dynamic = 'force-dynamic'

const unavailable = () => new Response('Material Catalog unavailable', {
  status: 503,
  headers: { 'Cache-Control': 'no-store' },
})

export const materialCatalogResponse = async ({
  kv,
  isLocal,
  loadLocal = loadLocalMaterialCatalog,
}: {
  kv?: Pick<KVNamespace, 'get'>
  isLocal: boolean
  loadLocal?: typeof loadLocalMaterialCatalog
}): Promise<Response> => {
  if (kv) {
    try {
      const stream = await kv.get(MATERIAL_CATALOG_KEY, { type: 'stream', cacheTtl: 300 })
      if (stream) {
        return new Response(stream, {
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
        })
      }
    } catch {
      // A local Miniflare binding can exist before the catalog is seeded.
    }
  }
  if (!isLocal) return unavailable()
  try {
    return Response.json(await loadLocal(), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return unavailable()
  }
}

export async function GET() {
  try {
    const { env } = (await getCloudflareContext({ async: true })) as unknown as {
      env: { MASTER_DATA?: KVNamespace }
    }
    return materialCatalogResponse({ kv: env.MASTER_DATA, isLocal: await canAccessFs() })
  } catch {
    return materialCatalogResponse({ isLocal: await canAccessFs() })
  }
}
