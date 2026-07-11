/**
 * VAPID public key（base64url）を PushManager.subscribe() の applicationServerKey に渡せる
 * Uint8Array に変換する（Web Push 購読の定型処理）。
 */
export const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

/**
 * ブラウザが Web Push（Service Worker / PushManager / Notification）に対応しているかを判定する。
 * SSR ではサポート判定不可のため false を返す。
 */
export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

/**
 * iOS 系デバイス（iPhone/iPad/iPod、および MacIntel を偽装する iPadOS）かどうかを判定する。
 * ホーム画面追加の案内を出すべきかの補助判定に使う。
 */
export const isIosFamily = (): boolean => {
  if (typeof navigator === 'undefined') return false
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export type PushSubscribeErrorReason =
  | 'unsupported'
  | 'permission-denied'
  | 'subscribe-failed'
  | 'server-error'
  | 'unsubscribe-failed'

/** プッシュ通知の購読失敗を理由別に区別して呼び出し側に伝えるための Error サブクラス。 */
export class PushSubscribeError extends Error {
  readonly reason: PushSubscribeErrorReason

  constructor(reason: PushSubscribeErrorReason, message?: string) {
    super(message ?? reason)
    this.name = 'PushSubscribeError'
    this.reason = reason
  }
}
