'use client'

import { useEffect, useState } from 'react'
import { signIn, useSession } from 'next-auth/react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Switch } from '@/components/ui/switch'
import { useLocalStorage } from '../../hooks/use-local-storage'
import { DEFAULT_TODO_SETTINGS } from '../../lib/todo/settings'
import { urlBase64ToUint8Array, isPushSupported, isIosFamily, PushSubscribeError } from '../../lib/todo/push'
import type { TodoSettings } from '../../types/todo'

// プッシュ通知 ON/OFF の端末ローカル専用キー。todoSettings(クラウド同期対象)からは
// 分離済み(openspec/changes/push-settings-isolation design.md Decisions #1)。
const PUSH_ENABLED_KEY = 'fgo_push_enabled'

const ROWS: { key: keyof TodoSettings; labelKey: string }[] = [
  { key: 'autoDaily', labelKey: 'デイリーミッションの自動追加' },
  { key: 'autoWeekly', labelKey: 'ウィークリーミッションの自動追加' },
  { key: 'autoEvent', labelKey: 'イベント交換ショップの自動追加' },
]

/**
 * 通知許可の要求 → Service Worker 経由での購読 → サーバーへの登録、の順で行う
 * (specs/todo-notifications/spec.md「プッシュ通知の許諾と登録」のシナリオ順)。
 * 途中で失敗した場合は理由別の PushSubscribeError を投げ、呼び出し側で fgo_push_enabled
 * を false のまま保つ。
 */
const subscribeToPush = async (): Promise<void> => {
  if (!isPushSupported()) throw new PushSubscribeError('unsupported')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new PushSubscribeError('permission-denied')

  const [keyRes, registration] = await Promise.all([
    fetch('/api/notifications/subscribe'),
    navigator.serviceWorker.ready,
  ])
  if (!keyRes.ok) throw new PushSubscribeError('server-error', 'Failed to fetch VAPID public key')
  const { publicKey } = (await keyRes.json()) as { publicKey: string }

  let subscription: PushSubscription
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    })
  } catch (error) {
    throw new PushSubscribeError('subscribe-failed', error instanceof Error ? error.message : undefined)
  }

  const res = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  })
  if (!res.ok) throw new PushSubscribeError('server-error', 'Failed to register subscription')
}

/**
 * ブラウザ側の購読解除自体は行うが、D1 への DELETE が失敗した場合は unsubscribe-failed
 * を投げる。呼び出し側はこれを受けてトグルを OFF にせず維持する（D1 に購読レコードが
 * 残っていても、次回 ON 操作では pushManager.subscribe が既存購読を返すため再 POST で
 * 復旧できる）。
 */
const unsubscribeFromPush = async (): Promise<void> => {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return

  try {
    await subscription.unsubscribe()
  } catch (error) {
    throw new PushSubscribeError('unsubscribe-failed', error instanceof Error ? error.message : undefined)
  }

  const res = await fetch('/api/notifications/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
  if (!res.ok) throw new PushSubscribeError('unsubscribe-failed', 'Failed to delete subscription on server')
}

/**
 * 旧 todoSettings.pushEnabled はクラウド同期されていたため、この端末では「他端末で ON
 * にした値」が同期されているだけの可能性がある。専用キー(fgo_push_enabled)が未作成の
 * 場合のみ、当該端末の実際のブラウザ購読(pushManager.getSubscription())の有無を確認
 * し、旧値 && 購読ありのときだけ true として一度だけ移行する
 * (openspec/changes/push-settings-isolation design.md Decisions #1)。
 */
const migratePushEnabled = async (): Promise<void> => {
  if (localStorage.getItem(PUSH_ENABLED_KEY) !== null) return // 移行済み、またはユーザーが既に操作済み

  let legacyEnabled = false
  try {
    const raw = localStorage.getItem('todoSettings')
    if (raw) legacyEnabled = (JSON.parse(raw) as { pushEnabled?: boolean }).pushEnabled === true
  } catch (e) {
    console.error('Failed to parse legacy todoSettings during pushEnabled migration', e)
  }
  if (!legacyEnabled || !isPushSupported()) return

  try {
    const registration = await navigator.serviceWorker.getRegistration()
    const subscription = await registration?.pushManager.getSubscription()
    if (!subscription) return // 購読の実在が無ければ移行しない(表示だけONになる不整合を防ぐ)
    localStorage.setItem(PUSH_ENABLED_KEY, 'true')
    // 同一タブで既にマウント済みの useLocalStorage(PUSH_ENABLED_KEY) 側へ反映する
    window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key: PUSH_ENABLED_KEY } }))
  } catch (e) {
    console.error('Failed to migrate pushEnabled to fgo_push_enabled', e)
  }
}

/**
 * TODO 自動生成(daily/weekly/event)の ON/OFF を localStorage の `todoSettings` に永続化
 * するトグル群。useLocalStorage が ls-sync を発火するため、useCloudSync の autosave に
 * そのまま乗る。
 * プッシュ通知の ON/OFF は `todoSettings` から分離した端末ローカル専用キー
 * `fgo_push_enabled` で管理し、クラウド同期・autosave の対象外にする
 * (openspec/changes/push-settings-isolation。use-cloud-sync 側の allowlist によって
 * KEYS に含まれないこのキーの ls-sync では dirty/autosave が発火しない)。
 * プッシュ通知は未ログイン時はトグルを disabled にしてサインイン導線を出し
 * (specs/todo-notifications/spec.md「未ログインユーザーのプッシュ通知ゲーティング」)、
 * ON 時は Service Worker 経由で購読しサーバーに登録、OFF 時は購読解除する。
 */
export const TodoSettingsPanel: React.FC = () => {
  const { t } = useTranslation('common')
  const { data: session } = useSession()
  const [settings, setSettings] = useLocalStorage<TodoSettings>('todoSettings', DEFAULT_TODO_SETTINGS)
  const [pushEnabled, setPushEnabled] = useLocalStorage<boolean>(PUSH_ENABLED_KEY, false)
  const [pushBusy, setPushBusy] = useState(false)
  // 判定中(null)はトグルを disabled にし、SSR/ハイドレーション不一致を避けるためマウント後に評価する
  const [pushSupported, setPushSupported] = useState<boolean | null>(null)

  useEffect(() => {
    setPushSupported(isPushSupported())
  }, [])

  useEffect(() => {
    void migratePushEnabled()
  }, [])

  const toggle = (key: keyof TodoSettings) => (checked: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: checked }))
  }

  const togglePush = async (checked: boolean) => {
    if (!session) return
    setPushBusy(true)
    try {
      if (checked) {
        await subscribeToPush()
      } else {
        await unsubscribeFromPush()
      }
      setPushEnabled(checked)
    } catch (error) {
      console.error(error)
      if (error instanceof PushSubscribeError) {
        switch (error.reason) {
          case 'unsupported':
            toast.error(t('このブラウザはプッシュ通知に対応していません'))
            break
          case 'permission-denied':
            toast.error(
              isIosFamily()
                ? t(
                    '通知が許可されませんでした。iOSでは一度拒否すると再確認が表示されないため、ホーム画面に追加したアプリを削除して入れ直す必要がある場合があります',
                  )
                : t('通知が許可されませんでした。ブラウザのサイト設定から通知の許可をブロック解除して再度お試しください'),
            )
            break
          case 'server-error':
          case 'subscribe-failed':
            toast.error(
              t(
                'プッシュ通知の登録に失敗しました。通信環境が不安定か、ログインセッションが切れている可能性があります。時間をおいて再試行するか、再度ログインしてください',
              ),
            )
            break
          case 'unsubscribe-failed':
            // D1 の解除に失敗しただけの可能性があるため、ここでは pushEnabled を false へ
            // 倒さずトグル ON を維持する（次回 ON 操作で既存のブラウザ購読を再 POST し復旧できる）。
            toast.error(t('プッシュ通知の解除に失敗しました。時間をおいて再度お試しください'))
            break
        }
      } else {
        toast.error(checked ? t('プッシュ通知の登録に失敗しました') : t('プッシュ通知の解除に失敗しました'))
      }
    } finally {
      setPushBusy(false)
    }
  }

  return (
    <div className="rounded-lg p-3.5" style={{ background: 'var(--bg2)', border: '1px solid var(--gold-dim)' }}>
      <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text)' }}>
        {t('TODO自動生成・通知設定')}
      </p>
      <div className="flex flex-col gap-3">
        {ROWS.map(({ key, labelKey }) => (
          <label key={key} className="flex items-center justify-between gap-3">
            <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
              {t(labelKey)}
            </span>
            <Switch checked={settings[key]} onCheckedChange={toggle(key)} aria-label={t(labelKey)} />
          </label>
        ))}

        <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <label className="flex items-center justify-between gap-3">
            <span className="text-[11px]" style={{ color: 'var(--text2)' }}>
              {t('プッシュ通知を有効にする')}
            </span>
            <Switch
              checked={pushEnabled}
              onCheckedChange={(checked) => {
                void togglePush(checked)
              }}
              disabled={!session || pushBusy || pushSupported !== true}
              aria-label={t('プッシュ通知を有効にする')}
            />
          </label>
          {!session && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px]" style={{ color: 'var(--text3)' }}>
                {t('プッシュ通知にはログインが必要です')}
              </span>
              <button
                type="button"
                onClick={() => {
                  signIn('google').catch((error) => console.error(error))
                }}
                className="text-[11px] underline underline-offset-2"
                style={{ color: 'var(--gold)' }}
              >
                {t('サインイン')}
              </button>
            </div>
          )}
          {pushSupported === false && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px]" style={{ color: 'var(--text3)' }}>
                {isIosFamily()
                  ? t('共有メニューから『ホーム画面に追加』し、追加したアイコンから開くとプッシュ通知を利用できます')
                  : t('このブラウザはプッシュ通知に対応していません')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
