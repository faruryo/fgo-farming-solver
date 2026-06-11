/**
 * nice_war(約23MB)の compact マッピングを生成し、KV 投入用ファイルに書き出す。
 *
 * 背景: fgo-data-updater(Workers 無料プラン)では 23MB の fetch+parse が
 * exceededCpu をほぼ確実に招き、殺されると KV キャッシュが未更新のまま次回も
 * full fetch に入って失敗が連鎖する。CPU 無制限の GitHub Actions 側で compact 化
 * して KV(nice_war_aaquests)を更新し、worker は KV を読むだけにする。
 *
 * 実行: pnpm exec tsx scripts/refresh-nice-war-cache.ts [出力パス]
 *   出力: { etag, lastModified, aaQuests } の JSON(既定 ./nice_war_aaquests.json)。
 *   後続の `wrangler kv key put nice_war_aaquests --path <出力パス>` で KV へ投入する
 *   (.github/workflows/refresh-nice-war.yml 参照)。
 */
import { writeFileSync } from 'node:fs'

import { origin, region } from '../constants/atlasacademy'
import { compactNiceWarQuests, normalizeEtag } from '../lib/master-data/update'

async function main() {
  const outPath = process.argv[2] ?? './nice_war_aaquests.json'

  console.log(`Fetching ${origin}/export/${region}/nice_war.json (~23MB)...`)
  const res = await fetch(`${origin}/export/${region}/nice_war.json`)
  if (!res.ok) throw new Error(`nice_war fetch failed: ${res.status}`)

  const wars = (await res.json()) as any[]
  const aaQuests = compactNiceWarQuests(wars)
  if (aaQuests.length < 10000) {
    // 既知の規模(15,000+ 件)から大きく欠けるペイロードで KV を壊さないためのガード
    throw new Error(`Refusing degraded payload: only ${aaQuests.length} quests extracted`)
  }

  const value = {
    etag: normalizeEtag(res.headers.get('etag') ?? ''),
    lastModified: res.headers.get('last-modified') ?? '',
    aaQuests,
  }
  writeFileSync(outPath, JSON.stringify(value))
  console.log(
    `Wrote ${aaQuests.length} quests (etag ${value.etag || 'n/a'}) to ${outPath}`
  )
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
