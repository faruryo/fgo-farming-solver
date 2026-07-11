export interface TodoTask {
  id: string
  title: string
  category: 'daily' | 'weekly' | 'event' | 'custom'
  deadline: string // ISO datetime string
  completed: boolean
  completedAt?: string
}

// プッシュ通知の ON/OFF (旧 pushEnabled) はクラウド同期対象から除外し、端末ローカルキー
// `fgo_push_enabled` でのみ管理する（openspec/changes/push-settings-isolation）。
export interface TodoSettings {
  autoDaily: boolean
  autoWeekly: boolean
  autoEvent: boolean
}

// D1 push_subscriptions row shape (snake_case columns, matches migrations/0004_todo_notifications.sql)
export interface PushSubscriptionRow {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: string
}

// D1 notification_log row shape (matches migrations/0004_todo_notifications.sql)
export interface NotificationLogRow {
  subscription_id: string
  notification_key: string
  sent_at: string
}
