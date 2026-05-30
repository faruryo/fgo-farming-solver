/**
 * mocks/all.json の各クエストに waveCount(=ターン数)を付与する(ローカル開発用)。
 * 本番データは master-data パイプライン(lib/master-data/update.ts)が同じ
 * populateWaveCounts を呼んで付与する。
 */
import { promises as fs } from 'fs'
import path from 'path'
import { populateWaveCounts } from '../lib/master-data/wave-count'

type Quest = { id: string; area: string; name: string; aaQuestId?: number; waveCount?: number }

const main = async () => {
  const file = path.join(process.cwd(), 'mocks', 'all.json')
  const json = JSON.parse(await fs.readFile(file, 'utf-8')) as { quests: Quest[] }

  const { pod, fetched } = await populateWaveCounts(json.quests)

  await fs.writeFile(file, JSON.stringify(json, null, 2) + '\n')
  const withWave = json.quests.filter(q => q.waveCount != null).length
  console.log(
    `Done — pod(1ターン固定): ${pod}, Atlas取得: ${fetched}, waveCount付与計: ${withWave}/${json.quests.length}`,
  )
}

void main()
