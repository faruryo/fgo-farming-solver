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

const ROWS: { key: keyof Omit<TodoSettings, 'pushEnabled'>; labelKey: string }[] = [
  { key: 'autoDaily', labelKey: 'デイリーミッションの自動追加' },
  { key: 'autoWeekly', labelKey: 'ウィークリーミッションの自動追加' },
  { key: 'autoEvent', labelKey: 'イベント交換ショップの自動追加' },
]

/**
 * 通知許可の要求 → Service Worker 経由での購読 → サーバーへの登録、の順で行う
 * (specs/todo-notifications/spec.md「プッシュ通知の許諾と登録」のシナリオ順)。
 * 途中で失敗した場合は理由別の PushSubscribeError を投げ、呼び出し側で pushEnabled を false のまま保つ。
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

const unsubscribeFromPush = async (): Promise<void> => {
  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (!subscription) return
  await subscription.unsubscribe()
  await fetch('/api/notifications/subscribe', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  })
}

/**
 * TODO 自動生成(daily/weekly/event)・プッシュ通知の ON/OFF を localStorage の
 * `todoSettings` に永続化するトグル群。useLocalStorage が ls-sync を発火するため、
 * useCloudSync の autosave にそのまま乗る。
 * プッシュ通知は未ログイン時はトグルを disabled にしてサインイン導線を出し
 * (specs/todo-notifications/spec.md「未ログインユーザーのプッシュ通知ゲーティング」)、
 * ON 時は Service Worker 経由で購読しサーバーに登録、OFF 時は購読解除する。
 */
export const TodoSettingsPanel: React.FC = () => {
  const { t } = useTranslation('common')
  const { data: session } = useSession()
  const [settings, setSettings] = useLocalStorage<TodoSettings>('todoSettings', DEFAULT_TODO_SETTINGS)
  const [pushBusy, setPushBusy] = useState(false)
  // 判定中(null)はトグルを disabled にし、SSR/ハイドレーション不一致を避けるためマウント後に評価する
  const [pushSupported, setPushSupported] = useState<boolean | null>(null)

  useEffect(() => {
    setPushSupported(isPushSupported())
  }, [])

  const toggle = (key: keyof Omit<TodoSettings, 'pushEnabled'>) => (checked: boolean) => {
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
      setSettings((prev) => ({ ...prev, pushEnabled: checked }))
    } catch (error) {
      console.error(error)
      if (error instanceof PushSubscribeError) {
        switch (error.reason) {
          case 'unsupported':
            toast.error(t('このブラウザはプッシュ通知に対応していません'))
            break
          case 'permission-denied':
            toast.error(
              t(
                '通知が許可されませんでした。iOSでは一度拒否すると再確認が表示されないため、ホーム画面に追加したアプリを削除して入れ直す必要がある場合があります',
              ),
            )
            break
          case 'server-error':
            toast.error(t('サーバーへの登録に失敗しました。通信環境を確認して再度お試しください'))
            break
          case 'subscribe-failed':
            toast.error(t('プッシュ通知の登録に失敗しました'))
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
              checked={settings.pushEnabled}
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
