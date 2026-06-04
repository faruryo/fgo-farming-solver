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

export type PopulateWaveCountsOptions = {
  concurrency?: number
  /**
   * aaQuestId → waveCount のキャッシュ(前回 all_drops_json 由来)。
   * ここに載っている aaQuestId は Atlas を再取得せずキャッシュ値を使う。
   * stage 数はほぼ不変なので、これで毎回の per-quest fetch(180+件 = subrequest
   * 上限超過の主因)を新規クエスト分だけに削減できる。
   */
  seed?: Map<number, number>
}

/**
 * `quests` を in-place で更新し、各クエストに waveCount を付与する。
 * @returns 付与の内訳(ログ用)。
 */
export const populateWaveCounts = async (
  quests: WaveQuest[],
  options: PopulateWaveCountsOptions = {},
): Promise<{ pod: number; fetched: number; cached: number }> => {
  const { concurrency = 8, seed } = options
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

  const candidates = quests.filter(
    q => !questConsumesPod(q.area) && q.aaQuestId != null && freq.get(q.aaQuestId) === 1,
  )

  // seed にある aaQuestId はキャッシュ値を流用し、fetch 対象から外す。
  let cached = 0
  const toFetch: WaveQuest[] = []
  for (const q of candidates) {
    const c = seed?.get(q.aaQuestId as number)
    if (c != null) {
      q.waveCount = c
      cached++
    } else {
      toFetch.push(q)
    }
  }

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

  return { pod, fetched, cached }
}
