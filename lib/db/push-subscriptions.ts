import type { D1Database } from '@cloudflare/workers-types'

export const upsertPushSubscription = async (
  db: D1Database,
  params: { id: string; userId: string; endpoint: string; p256dh: string; auth: string }
): Promise<void> => {
  await db
    .prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth`
    )
    .bind(params.id, params.userId, params.endpoint, params.p256dh, params.auth)
    .run()
}

export const deletePushSubscriptionByEndpoint = async (
  db: D1Database,
  userId: string,
  endpoint: string
): Promise<void> => {
  await db
    .prepare(`DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?`)
    .bind(endpoint, userId)
    .run()
}
