import { origin, region } from '../../constants/atlasacademy'
import { questConsumesPod } from '../quest-consumes-pod'

// クエストの waveCount(=ターン数)を付与する共有ロジック。
// 周回効率(ターン割り)の分母に使う。master-data パイプラインとローカル mock 生成の双方で利用。
//
// - ポッドクエスト(冠位研鑽戦/戴冠戦/オーディール・コール)は単一 wave なので 1 固定。
//   これらは aaQuestId が衝突していて Atlas 取得が信用できないため固定値が安全。
// - それ以外は aaQuestId が一意なものだけ Atlas から stages 数を取得。
// - 取得できないもの(衝突・未マッピング・エラー)は未設定のまま(実行時に 1 ターン扱い)。

type WaveQuest = { id: string; area: string; name: string; aaQuestId?: number; waveCount?: number }

const fetchWaveCount = async (aaQuestId: number): Promise<number | null> => {
  try {
    const res = await fetch(`${origin}/nice/${region}/quest/${aaQuestId}/1`)
    if (!res.ok) return null
    const data = (await res.json()) as { stages?: unknown[] }
    return Array.isArray(data.stages) && data.stages.length > 0 ? data.stages.length : null
  } catch {
    return null
  }
}

/**
 * `quests` を in-place で更新し、各クエストに waveCount を付与する。
 * @returns 付与の内訳(ログ用)。
 */
export const populateWaveCounts = async (
  quests: WaveQuest[],
  concurrency = 8,
): Promise<{ pod: number; fetched: number }> => {
  const freq = new Map<number, number>()
  for (const q of quests) {
    if (q.aaQuestId != null) freq.set(q.aaQuestId, (freq.get(q.aaQuestId) ?? 0) + 1)
  }

  let pod = 0
  for (const q of quests) {
    if (questConsumesPod(q.area)) {
      q.waveCount = 1
      pod++
    }
  }

  const toFetch = quests.filter(
    q => !questConsumesPod(q.area) && q.aaQuestId != null && freq.get(q.aaQuestId) === 1,
  )

  let fetched = 0
  for (let i = 0; i < toFetch.length; i += concurrency) {
    const batch = toFetch.slice(i, i + concurrency)
    const counts = await Promise.all(batch.map(q => fetchWaveCount(q.aaQuestId as number)))
    batch.forEach((q, j) => {
      const c = counts[j]
      if (c != null) {
        q.waveCount = c
        fetched++
      }
    })
  }

  return { pod, fetched }
}
