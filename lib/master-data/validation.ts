import type { DashboardMeta, MasterData } from './types'

export interface ValidationResult {
  ok: boolean
  reason?: string
}

// Atlas Academy が空配列や 5xx を返したケース、スプレッドシートが取得できなかったケースなど、
// 「throw はしないが中身が空」のレスポンスで KV を上書きしないためのガード。
// 既存 KV のデータ（直近の正常な値）を温存することを優先する。
// ID空間の整合性検証（一意性・形状・参照整合）も兼ね、不整合な採番結果が
// KV に書き込まれてレジストリが汚染されるのを防ぐ。

// クエスト短縮ID形式: {2文字エリアプレフィックス}{base36 index(1文字以上)}
const QUEST_ID_PATTERN = /^[0-9a-z]{3,}$/

export function validateMasterData(data: MasterData): ValidationResult {
  if (data.items.length === 0) {
    return { ok: false, reason: 'items is empty' }
  }
  if (data.quests.length === 0) {
    return { ok: false, reason: 'quests is empty' }
  }
  if (data.drop_rates.length === 0) {
    return { ok: false, reason: 'drop_rates is empty' }
  }

  // クエストID: 一意性・形式・Dailyプレフィックス形状（'0' 始まり ⇔ Daily セクション）
  const questIds = new Set<string>()
  for (const q of data.quests) {
    if (!QUEST_ID_PATTERN.test(q.id)) {
      return { ok: false, reason: `quest id "${q.id}" does not match ${QUEST_ID_PATTERN}` }
    }
    if (questIds.has(q.id)) {
      return { ok: false, reason: `duplicate quest id "${q.id}"` }
    }
    questIds.add(q.id)
    const isDailyPrefix = q.id[0] === '0'
    if (isDailyPrefix !== (q.section === 'Daily')) {
      return {
        ok: false,
        reason: `quest id "${q.id}" prefix conflicts with section "${q.section}"`,
      }
    }
  }

  // アイテムID: 一意性
  const itemIds = new Set<string>()
  for (const item of data.items) {
    if (itemIds.has(item.id)) {
      return { ok: false, reason: `duplicate item id "${item.id}"` }
    }
    itemIds.add(item.id)
  }

  // drop_rates の参照整合: quest_id は必ず quests に存在すること
  for (const dr of data.drop_rates) {
    if (!questIds.has(dr.quest_id)) {
      return { ok: false, reason: `drop_rate references unknown quest id "${dr.quest_id}"` }
    }
  }

  return { ok: true }
}

export function validateDashboardMeta(data: DashboardMeta): ValidationResult {
  // FGO では常時 1 件以上のイベント／キャンペーンが走っている前提。
  // events も gachas も空のときは Atlas 側の空応答を疑う。
  // 片方だけ空なケース（ガチャ無し期間など）は正常として扱う。
  if (data.events.length === 0 && data.gachas.length === 0) {
    return { ok: false, reason: 'events and gachas are both empty' }
  }
  if (data.recentServants.length === 0) {
    // basic_servant.json は常に数千件返るので、recentServants=0 は
    // フィルタの結果としては起こりうるが、Atlas のレスポンスが壊れた可能性も。
    // 致命とまでは言えないので警告レベルにとどめる（後段で書き込みは許可）。
    return { ok: true, reason: 'warning: recentServants is empty' }
  }
  return { ok: true }
}
