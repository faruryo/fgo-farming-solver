import type { DashboardMeta, MasterData } from './types'

export interface ValidationResult {
  ok: boolean
  reason?: string
}

// Atlas Academy が空配列や 5xx を返したケース、スプレッドシートが取得できなかったケースなど、
// 「throw はしないが中身が空」のレスポンスで KV を上書きしないためのガード。
// 既存 KV のデータ（直近の正常な値）を温存することを優先する。

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
