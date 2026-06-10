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

/**
 * 前回公開ペイロードから aaQuestId → waveCount の seed を導出する純粋ヘルパー。
 * worker / bench の双方で、per-quest fetch を新規クエスト分だけに削減するために使う。
 */
export const waveCountSeedFrom = (
  previous?: { quests?: Array<{ aaQuestId?: number; waveCount?: number }> } | null
): Map<number, number> | undefined => {
  const seed = new Map<number, number>()
  for (const q of previous?.quests ?? []) {
    if (typeof q.aaQuestId === 'number' && typeof q.waveCount === 'number') {
      seed.set(q.aaQuestId, q.waveCount)
    }
  }
  return seed.size > 0 ? seed : undefined
}

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
  /**
   * 1 回の呼び出しで新規 fetch するクエスト数の上限。無料プランの subrequest 上限
   * (1 invocation あたり ~50)内に収めるため、cold start でも 1 回で全件取得せず
   * 数回に分けて埋める。未指定なら無制限(ローカルの mock 再生成用)。
   * seed と併用すれば数回の cron で全件キャッシュされ、以後の fetch は 0 になる。
   */
  maxFetch?: number
}

/**
 * `quests` を in-place で更新し、各クエストに waveCount を付与する。
 * @returns 付与の内訳(ログ用)。
 */
export const populateWaveCounts = async (
  quests: WaveQuest[],
  options: PopulateWaveCountsOptions = {},
): Promise<{ pod: number; fetched: number; cached: number; deferred: number }> => {
  const { concurrency = 8, seed, maxFetch } = options
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
  const uncached: WaveQuest[] = []
  for (const q of candidates) {
    const c = seed?.get(q.aaQuestId as number)
    if (c != null) {
      q.waveCount = c
      cached++
    } else {
      uncached.push(q)
    }
  }

  // 1 回の fetch 件数を maxFetch で制限(subrequest 上限対策)。残りは次回以降に回す。
  const toFetch = maxFetch != null ? uncached.slice(0, maxFetch) : uncached
  const deferred = uncached.length - toFetch.length

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

  return { pod, fetched, cached, deferred }
}
