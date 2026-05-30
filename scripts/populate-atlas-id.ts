/**
 * mocks/all.json の各アイテムに atlasId(Atlas Academy のアイテムID)を付与する(ローカル開発用)。
 * get-local-items と同じ手順(getItems → toApiItemId)で 短縮ID → Atlas ID を対応付ける。
 * 本番データは get-local-items が atlasId を付与する。
 */
import { promises as fs } from 'fs'
import path from 'path'
import { getItems } from '../lib/get-items'
import { toApiItemId } from '../lib/to-api-item-id'

type MockItem = { id: string; name: string; atlasId?: number }

const main = async () => {
  const atlasItems = await getItems('ja')
  const shortToAtlas = new Map<string, number>()
  for (const it of atlasItems) {
    const shortId = toApiItemId(it, atlasItems)
    if (shortId) shortToAtlas.set(shortId, it.id)
  }

  const file = path.join(process.cwd(), 'mocks', 'all.json')
  const json = JSON.parse(await fs.readFile(file, 'utf-8')) as { items: MockItem[] }
  let matched = 0
  for (const item of json.items) {
    const atlasId = shortToAtlas.get(item.id)
    if (atlasId != null) {
      item.atlasId = atlasId
      matched++
    }
  }
  await fs.writeFile(file, JSON.stringify(json, null, 2) + '\n')
  console.log(`Done — atlasId 付与: ${matched}/${json.items.length}`)
}

void main()
