/**
 * イベントページ（/events/[id]）で使える機能の静的レジストリ。
 * KV `event_data_json` に無いイベントでも、meta だけで一覧・ヘッダーが成立するよう meta は必須。
 * 載せるのはゲーム内・Atlas Academy で公開済みの値のみ。
 */

export type EventFeature = 'box' | 'craft'

export interface EventFeatureEntry {
  features: EventFeature[]
  meta: {
    name: string
    startedAt: number
    endedAt: number
  }
}

export const EVENT_FEATURES: Record<number, EventFeatureEntry> = {
  80614: {
    features: ['craft'],
    meta: {
      name: 'カルデア南海大決戦！ ～マジムンアイランドに謎の巨人の影を見た～',
      startedAt: 1786532400,
      endedAt: 1788321599,
    },
  },
}
